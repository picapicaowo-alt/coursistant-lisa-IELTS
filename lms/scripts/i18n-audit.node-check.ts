import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';
import {copyExceptions, isReviewedCopy} from './i18n-copy-policy.ts';

const script = fileURLToPath(new URL('./i18n-audit.ts', import.meta.url));

function audit(files: Record<string, string>) {
  const fixture = mkdtempSync(join(tmpdir(), 'coursistant-copy-check-'));
  try {
    for (const [file, source] of Object.entries(files)) {
      const destination = join(fixture, 'src', file);
      mkdirSync(dirname(destination), {recursive: true});
      writeFileSync(destination, source);
    }
    const result = spawnSync(process.execPath, ['--experimental-strip-types', script, '--active', '--ui-only', '--strict'], {cwd: fixture, encoding: 'utf8'});
    assert.equal(result.error, undefined);
    assert.equal(result.stderr, '');
    return {status: result.status, candidates: JSON.parse(result.stdout) as {file: string; text: string}[]};
  } finally {
    rmSync(fixture, {recursive: true, force: true});
  }
}

test('blocks literal text, secondary props and accessibility copy in active lazy routes', () => {
  const result = audit({
    'main.tsx': `const Page = lazy(() => import('./Page'));`,
    'Page.tsx': `export default <Panel secondary="Additional guidance"><button aria-label={'Save changes'}>Save</button></Panel>`,
  });
  assert.equal(result.status, 1);
  assert.deepEqual(result.candidates.map(item => item.text).sort(), ['Additional guidance', 'Save', 'Save changes'].sort());
});

test('accepts semantic keys and machine values without translating identifiers', () => {
  const result = audit({'main.tsx': `const x = {titleKey: 'common:actions.save'}; export default <select aria-label={t('common:roles.STUDENT')}><option value={"Student"}>{t('common:roles.STUDENT')}</option></select>`});
  assert.equal(result.status, 0);
  assert.deepEqual(result.candidates, []);
});

test('checks conditional copy, interpolated aria labels and indexed UI arrays', () => {
  const result = audit({'main.tsx': "<><button aria-label={`Remove ${name}`}/><span>{ready ? 'Ready now' : t('common:loading')}</span><span>{['Email', 'Verification'][step]}</span><span>{`${left} / ${right}`}</span></>"});
  assert.equal(result.status, 1);
  assert.deepEqual(result.candidates.map(item => item.text).sort(), ['Remove {{value}}', 'Ready now', 'Email', 'Verification'].sort());
});

test('keeps an exact original-paper exception but blocks new platform controls beside it', () => {
  const file = 'pages/MockExamSessionPage/runner/components/QuestionSections.tsx';
  const result = audit({
    'main.tsx': `import './${file}';`,
    [file]: '<><h4>Word bank</h4><button>Save answers</button></>',
  });
  assert.equal(result.status, 1);
  assert.deepEqual(result.candidates.map(item => item.text), ['Save answers']);
  assert.equal(isReviewedCopy({file: 'src/unrelated.tsx', text: 'Word bank'}), false);
});

test('does not count unreachable prototypes as active UI', () => {
  const result = audit({'main.tsx': `<p>{t('common:feedback.loading')}</p>`, 'old.tsx': '<p>Old prototype</p>'});
  assert.equal(result.status, 0);
});

test('every exception has a rationale and an exact unique file/text identity', () => {
  assert.equal(new Set(copyExceptions.map(item => `${item.file}:${item.text}`)).size, copyExceptions.length);
  for (const exception of copyExceptions) {
    assert.ok(exception.reason.trim().length > 10);
    assert.ok(!exception.file.includes('*'));
  }
});
