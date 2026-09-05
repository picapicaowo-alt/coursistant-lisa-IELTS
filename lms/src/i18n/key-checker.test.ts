// @vitest-environment node
import {mkdtempSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {afterEach, describe, expect, it} from 'vitest';

const directories: string[] = [];
function check(source: string) {
  const directory = mkdtempSync(join(tmpdir(), 'coursistant-key-checker-')); directories.push(directory);
  for (const locale of ['en', 'zh-CN', 'zh-TW']) {
    const resources = join(directory, 'src/i18n/resources', locale); mkdirSync(resources, {recursive: true});
    writeFileSync(join(resources, 'common.json'), JSON.stringify({actions: {save: 'Save'}, count_one: '{{count}} item', count_other: '{{count}} items'}));
    writeFileSync(join(resources, 'auth.json'), JSON.stringify({login: {pending: 'Signing in'}}));
  }
  writeFileSync(join(directory, 'src/Fixture.tsx'), source);
  return spawnSync(process.execPath, ['--experimental-strip-types', resolve('scripts/i18n-keys.ts')], {cwd: directory, encoding: 'utf8'});
}
afterEach(() => {for (const directory of directories.splice(0)) rmSync(directory, {recursive: true, force: true});});

describe('semantic-key static gate', () => {
  it('requires interpolation values without confusing business counts and rendered numbers', () => {
    const invalid = check(`const List = () => {const {t} = useTranslation(); return <p>{t('count')}</p>;};`);
    expect(invalid.status).toBe(1);
    expect(invalid.stderr).toContain('missing interpolation count');
    const valid = check(`const List = () => {const {t} = useTranslation(); return <p>{t('count', {count: 2})}</p>;};`);
    expect(valid.status, valid.stderr).toBe(0);
  });
  it('keeps component identity stable when the language changes', () => {
    const invalid = check(`const List = () => {const {t} = useTranslation(); return <div key={t('actions.save')}/>;};`);
    expect(invalid.status).toBe(1);
    expect(invalid.stderr).toContain('React keys must not depend on translated labels');
    const valid = check(`const List = () => {const {t} = useTranslation(); return <div key={id}>{t('actions.save')}</div>;};`);
    expect(valid.status, valid.stderr).toBe(0);
  });
  it('checks namespace-local keys, aliases, nested closures and plural resources', () => {
    const result = check(`
      const Auth = () => {const {t: translate} = useTranslation('auth'); return <button onClick={() => translate('login.pending')}>{translate('login.pending')}</button>;};
      const Common = () => {const {t} = useTranslation(); return <><span>{t('actions.save')}</span><span>{t('count', {count: 2})}</span></>;};
      const unrelated = (t: (x: string) => string) => t('not-a-translation');
    `);
    expect(result.status, result.stderr).toBe(0);
  });

  it('rejects missing local keys even when a component supplies an English fallback', () => {
    const result = check(`const Auth = () => {const {t} = useTranslation('auth'); return <button>{t('login.missing', {defaultValue: 'English fallback'})}</button>;};`);
    expect(result.status).toBe(1);
    for (const locale of ['en', 'zh-CN', 'zh-TW']) expect(result.stderr).toContain(`${locale} missing auth:login.missing`);
  });

  it('continues to reject translated options without stable API values', () => {
    const result = check(`const Form = () => {const {t} = useTranslation(); return <select><option>{t('actions.save')}</option></select>;};`);
    expect(result.status).toBe(1); expect(result.stderr).toContain('translated option requires an explicit stable value');
  });

  it('rejects translated business comparisons while accepting canonical values', () => {
    const invalid = check(`const Form = () => {const {t} = useTranslation(); return <button disabled={state === t('actions.save')}>{t('actions.save')}</button>;};`);
    expect(invalid.status).toBe(1);
    expect(invalid.stderr).toContain('translated labels must not be compared with business values');
    const valid = check(`const Form = () => {const {t} = useTranslation(); return <button disabled={state === 'PUBLISHED'}>{t('actions.save')}</button>;};`);
    expect(valid.status, valid.stderr).toBe(0);
  });
});
