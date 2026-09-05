import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs';
import {dirname, relative, resolve} from 'node:path';
import ts from 'typescript';
import {isReviewedCopy, visibleCopyAttributes} from './i18n-copy-policy.ts';

interface Candidate {file: string; line: number; kind: string; text: string}
const root = resolve('src');
const candidates: Candidate[] = [];
const sourceFiles = readdirSync(root, {recursive: true, encoding: 'utf8'}).filter(file => /\.[jt]sx?$/.test(file) && !/(\.test\.|\.spec\.|\.d\.ts$| 2\.)/.test(file));
const attributes = visibleCopyAttributes;
const uiOnly = process.argv.includes('--ui-only');

function resolveImport(owner: string, specifier: string): string | undefined {
  const base = specifier.startsWith('@/') ? resolve(root, specifier.slice(2))
    : specifier.startsWith('src/') ? resolve(root, specifier.slice(4))
      : specifier.startsWith('.') ? resolve(dirname(owner), specifier) : undefined;
  if (!base) return;
  return ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx']
    .map(suffix => base + suffix)
    .find(file => /\.[jt]sx?$/.test(file) && existsSync(file) && statSync(file).isFile());
}

const reachable = new Set<string>();
function trace(file: string): void {
  if (reachable.has(file)) return;
  reachable.add(file);
  const tree = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const visit = (node: ts.Node) => {
    const reference = (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) ? node.moduleSpecifier
      : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword ? node.arguments[0] : undefined;
    if (reference && ts.isStringLiteral(reference)) {
      const dependency = resolveImport(file, reference.text);
      if (dependency) trace(dependency);
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
}
if (process.argv.includes('--active')) trace(resolve(root, 'main.tsx'));
const files = process.argv.includes('--active') ? [...reachable].map(file => relative(root, file)) : sourceFiles;

// Deliberately read-only: classification and key design require human review.
// Candidate counts are not proof of active-route coverage or translation quality.
for (const file of files) {
  if (file.startsWith('i18n/')) continue;
  const source = ts.createSourceFile(file, readFileSync(resolve(root, file), 'utf8'), ts.ScriptTarget.Latest, true);
  const add = (node: ts.Node, kind: string, text: string) => {
    if (/^[a-z][\w-]+:[\w.-]+$/.test(text)) return;
    if (/[a-zA-Z\u3400-\u9fff]{2}/.test(text.replaceAll('{{value}}', ''))) candidates.push({file: `src/${file}`, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, kind, text: text.trim()});
  };
  const visibleExpression = (node: ts.Expression): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) add(node, 'JSX computed copy', node.text);
    else if (ts.isTemplateExpression(node)) add(node, 'JSX computed copy', [node.head.text, ...node.templateSpans.map(span => span.literal.text)].join('{{value}}'));
    else if (ts.isConditionalExpression(node)) {visibleExpression(node.whenTrue); visibleExpression(node.whenFalse);}
    else if (ts.isBinaryExpression(node) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind)) visibleExpression(node.right);
    else if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node)) visibleExpression(node.expression);
    else if (ts.isElementAccessExpression(node) && ts.isArrayLiteralExpression(node.expression)) {
      for (const item of node.expression.elements) if (ts.isExpression(item)) visibleExpression(item);
    }
  };
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) add(node, 'JSX text', node.text);
    if (ts.isJsxAttribute(node) && attributes.has(node.name.getText(source)) && node.initializer && ts.isStringLiteral(node.initializer)) {
      add(node, 'JSX attribute', node.initializer.text);
    }
    if (ts.isPropertyAssignment(node) && attributes.has(node.name.getText(source)) && ts.isStringLiteral(node.initializer)) {
      add(node, 'presentation property', node.initializer.text);
    }
    if (ts.isJsxExpression(node) && node.expression && ts.isStringLiteral(node.expression)) {
      // value={"Student"}, className, IDs and paths are machine data, not copy.
      if (!ts.isJsxAttribute(node.parent) || attributes.has(node.parent.name.getText(source))) add(node, 'JSX string expression', node.expression.text);
    }
    if (ts.isJsxExpression(node) && node.expression && !ts.isStringLiteral(node.expression)
      && (!ts.isJsxAttribute(node.parent) || attributes.has(node.parent.name.getText(source)))) visibleExpression(node.expression);
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const parent = node.parent;
      if (ts.isConditionalExpression(parent) && (node === parent.whenTrue || node === parent.whenFalse)) add(node, 'conditional (requires classification)', node.text);
      if (ts.isBinaryExpression(parent) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(parent.operatorToken.kind) && node === parent.right) add(node, 'fallback (requires classification)', node.text);
      if (ts.isCallExpression(parent) || ts.isNewExpression(parent)) {
        const callee = parent.expression.getText(source);
        if (/(?:ErrorMessage|errorMessage|Error|alert|confirm|prompt|setMessage|setError|setSuccess|setNotice|setStatus|toast|notify)$/.test(callee)) add(node, 'message (requires classification)', node.text);
      }
    }
    if (ts.isTemplateExpression(node)) {
      // Keep machine templates distinguishable from UI; do not rewrite URLs or
      // identifiers automatically simply because they contain English letters.
      const copy = [node.head.text, ...node.templateSpans.map(span => span.literal.text)].join('{{value}}');
      add(node, 'template (requires classification)', copy);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

// This strict gate covers direct UI literals only. The broader audit retains
// templates/fallbacks for semantic review; machine strings must not be translated.
const results = uiOnly ? candidates.filter(candidate => /^(JSX|presentation)/.test(candidate.kind) && !isReviewedCopy(candidate)) : candidates;
if (process.argv.includes('--summary')) {
  const byFile = new Map<string, number>();
  for (const candidate of results) byFile.set(candidate.file, (byFile.get(candidate.file) ?? 0) + 1);
  process.stdout.write(JSON.stringify({scope: process.argv.includes('--active') ? 'entry-point dependency graph' : 'all source', sourceFiles: files.length, candidateFiles: byFile.size, candidates: results.length, largestFiles: Object.fromEntries([...byFile].sort((a, b) => b[1] - a[1]).slice(0, 20))}, null, 2) + '\n');
} else {
  process.stdout.write(JSON.stringify(results, null, 2) + '\n');
}
if (process.argv.includes('--strict') && results.length) process.exitCode = 1;
