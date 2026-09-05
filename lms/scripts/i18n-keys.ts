import {readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import ts from 'typescript';

const root = resolve('src');
const localeRoot = resolve(root, 'i18n/resources');
const locales = ['en', 'zh-CN', 'zh-TW'];
const keys = new Map<string, Set<string>>();
const namespaces = new Set<string>();
const interpolations = new Map<string, Set<string>>();

function collect(value: unknown, prefix: string, target: Set<string>): void {
  if (typeof value === 'string') {
    target.add(prefix);
    const base = prefix.replace(/_(one|other)$/, '');
    const parameters = interpolations.get(base) ?? new Set<string>();
    for (const match of value.matchAll(/{{\s*(\w+)(?:,[^}]*)?\s*}}/g)) parameters.add(match[1]);
    interpolations.set(base, parameters);
    return;
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [name, child] of Object.entries(value)) collect(child, prefix + '.' + name, target);
  }
}

for (const locale of locales) {
  const found = new Set<string>();
  for (const file of readdirSync(resolve(localeRoot, locale)).filter(file => file.endsWith('.json'))) {
    const namespace = file.slice(0, -5);
    namespaces.add(namespace);
    const resource: unknown = JSON.parse(readFileSync(resolve(localeRoot, locale, file), 'utf8'));
    if (!resource || typeof resource !== 'object' || Array.isArray(resource)) throw new Error(`Invalid resource: ${locale}/${file}`);
    for (const [name, value] of Object.entries(resource)) collect(value, namespace + ':' + name, found);
  }
  keys.set(locale, found);
}

const errors: string[] = [];
// Resolve the nearest hook binding so namespace-local references such as
// useTranslation('auth') / t('login.loggingIn') receive the same checks as
// fully qualified keys. Do not guess for unrelated functions named t.
function boundNamespace(call: ts.CallExpression): string | undefined {
  const expression = call.expression;
  if (expression.getText() === 'i18n.t') return 'common';
  if (!ts.isIdentifier(expression)) return undefined;
  for (let scope: ts.Node | undefined = call.parent; scope; scope = scope.parent) {
    if (!ts.isBlock(scope) && !ts.isSourceFile(scope)) continue;
    for (const statement of scope.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isObjectBindingPattern(declaration.name) || !declaration.initializer || !ts.isCallExpression(declaration.initializer)) continue;
        const binding = declaration.name.elements.find(element => (element.propertyName?.getText() ?? element.name.getText()) === 't' && element.name.getText() === expression.text);
        if (!binding || declaration.initializer.expression.getText() !== 'useTranslation') continue;
        const namespace = declaration.initializer.arguments[0];
        return !namespace ? 'common' : ts.isStringLiteral(namespace) ? namespace.text : undefined;
      }
    }
  }
  return undefined;
}
// Validate semantic references, including key arrays outside React. Dynamic keys
// remain covered by resource parity and workflow tests; this is not a copy audit.
for (const file of readdirSync(root, {recursive: true, encoding: 'utf8'}).filter(file => /\.[jt]sx?$/.test(file) && !/(\.test\.|\.spec\.|\.d\.ts$| 2\.)/.test(file) && !file.startsWith('i18n/'))) {
  const tree = ts.createSourceFile(file, readFileSync(resolve(root, file), 'utf8'), ts.ScriptTarget.Latest, true);
  const visit = (node: ts.Node) => {
    if (ts.isJsxAttribute(node) && node.name.getText(tree) === 'key' && node.initializer && ts.isJsxExpression(node.initializer)) {
      const checkKey = (part: ts.Node): void => {
        if (ts.isCallExpression(part) && boundNamespace(part) !== undefined) {
          errors.push(`${file}:${tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1} React keys must not depend on translated labels`);
        }
        ts.forEachChild(part, checkKey);
      };
      checkKey(node.initializer);
    }
    if (ts.isBinaryExpression(node) && [ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(node.operatorToken.kind)) {
      for (const operand of [node.left, node.right]) {
        if (ts.isCallExpression(operand) && boundNamespace(operand) !== undefined) {
          errors.push(`${file}:${tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1} translated labels must not be compared with business values`);
        }
      }
    }
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(tree) === 'option') {
      const explicitValue = node.openingElement.attributes.properties.some(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(tree) === 'value');
      // Without value, HTML submits the translated label, changing the API enum.
      if (!explicitValue && /\b(?:t|translate)\(/.test(node.getText(tree))) {
        errors.push(`${file}:${tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1} translated option requires an explicit stable value`);
      }
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const match = /^([\w-]+):([\w.-]+)$/.exec(node.text);
      const parent = node.parent;
      const call = ts.isCallExpression(parent) && parent.arguments[0] === node ? parent : undefined;
      const namespace = call ? boundNamespace(call) : undefined;
      const translatedCall = call && (namespace !== undefined || /^(?:t|translate|i18n\.t)$/.test(call.expression.getText(tree)));
      const transAttribute = ts.isJsxAttribute(parent) && parent.name.getText(tree) === 'i18nKey';
      const reference = match && (namespaces.has(match[1]) || translatedCall || transAttribute) ? node.text
        : namespace && /^[\w.-]+$/.test(node.text) ? `${namespace}:${node.text}` : undefined;
      if (reference) {
        // Only inspect explicit option objects; variable/spread options need
        // runtime coverage. Never accept untranslated {{placeholders}} as UI.
        const options = call?.arguments[1];
        if (translatedCall && (!options || (ts.isObjectLiteralExpression(options) && !options.properties.some(ts.isSpreadAssignment)))) {
          const provided = new Set(options && ts.isObjectLiteralExpression(options) ? options.properties.flatMap(property => property.name ? [property.name.getText(tree).replace(/^['"]|['"]$/g, '')] : []) : []);
          for (const parameter of interpolations.get(reference) ?? []) {
            if (!provided.has(parameter)) errors.push(`${file}:${tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1} ${reference} missing interpolation ${parameter}`);
          }
        }
        for (const [locale, available] of keys) {
          const exists = available.has(reference) || (available.has(reference + '_one') && available.has(reference + '_other'));
          if (!exists) errors.push(`${file}:${tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1} ${locale} missing ${reference}`);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
}

if (errors.length) {
  process.stderr.write(errors.join('\n') + '\n');
  process.exitCode = 1;
} else process.stdout.write('Static semantic translation references exist in all three locales.\n');
