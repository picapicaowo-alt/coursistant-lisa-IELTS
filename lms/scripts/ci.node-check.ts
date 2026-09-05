import assert from 'node:assert/strict';
import {test} from 'node:test';
import {AUDIT_ARGS, classifyAudit, INSTALL_ARGS, runCommand} from './ci.ts';

function auditResult(total: number, code = total ? 1 : 0) {
  return {
    code, timedOut: false, interrupted: false,
    stdout: JSON.stringify({
      metadata: {vulnerabilities: {info: 0, low: 0, moderate: total, high: 0, critical: 0, total}},
      vulnerabilities: Object.fromEntries(Array.from({length: total}, (_, i) => [`package-${i}`, {severity: 'moderate'}])),
    }),
  };
}

test('only a complete zero-vulnerability report with exit 0 is clean', () => {
  assert.equal(classifyAudit(auditResult(0)).status, 'clean');
  assert.equal(classifyAudit(auditResult(0)).exitCode, 0);
});

test('known moderate findings remain a failing audit, not a blanket exemption', () => {
  const result = classifyAudit(auditResult(5));
  assert.equal(result.status, 'vulnerabilities');
  assert.equal(result.exitCode, 1);
  assert.equal(classifyAudit(auditResult(5, 0)).status, 'vulnerabilities');
});

test('timeouts and interruptions cannot reuse a seemingly clean report', () => {
  assert.equal(classifyAudit({...auditResult(0), timedOut: true}).status, 'incomplete');
  assert.equal(classifyAudit({...auditResult(0), interrupted: true}).exitCode, 2);
});

test('empty, malformed and error responses are incomplete', () => {
  for (const stdout of ['', '{}', 'not JSON', '{"error":{"code":"ETIMEDOUT"}}', 'null']) {
    assert.equal(classifyAudit({...auditResult(0), stdout}).status, 'incomplete');
  }
});

test('unexpected exit codes and inconsistent counts are incomplete', () => {
  assert.equal(classifyAudit(auditResult(0, 1)).status, 'incomplete');
  assert.equal(classifyAudit(auditResult(5, 2)).status, 'incomplete');
  const response = JSON.parse(auditResult(1).stdout);
  response.metadata.vulnerabilities.total = 0;
  assert.equal(classifyAudit({...auditResult(0), stdout: JSON.stringify(response)}).status, 'incomplete');
  response.metadata.vulnerabilities.total = 1;
  response.vulnerabilities = {};
  assert.equal(classifyAudit({...auditResult(0), stdout: JSON.stringify(response)}).status, 'incomplete');
});

test('installation does not audit; explicit audit stays online and includes all severities', () => {
  assert.ok(INSTALL_ARGS.includes('--no-audit'));
  assert.ok(INSTALL_ARGS.includes('--prefer-offline'));
  assert.ok(AUDIT_ARGS.includes('--offline=false'));
  assert.ok(AUDIT_ARGS.includes('--audit-level=low'));
  assert.ok(AUDIT_ARGS.includes('--package-lock-only'));
  assert.ok(AUDIT_ARGS.includes('--include=dev'));
  assert.ok(AUDIT_ARGS.includes('--include=optional'));
  assert.ok(AUDIT_ARGS.includes('--include=peer'));
  assert.ok(!AUDIT_ARGS.some(arg => arg.startsWith('--omit')));
});

test('runner captures audit output and reports command duration', async () => {
  const messages: string[] = [];
  const result = await runCommand(process.execPath, ['-e', 'process.stdout.write("result")'], {
    timeoutMs: 5000, captureStdout: true, log: message => messages.push(message),
  });
  assert.equal(result.code, 0);
  assert.equal(result.stdout, 'result');
  assert.ok(result.durationMs >= 0);
  assert.ok(messages.some(message => message.includes('START')));
  assert.ok(messages.some(message => message.includes('END')));
});

test('runner preserves nonzero exit codes', async () => {
  const result = await runCommand(process.execPath, ['-e', 'process.exit(7)'], {
    timeoutMs: 5000, log: () => {},
  });
  assert.equal(result.code, 7);
});

test('runner reports heartbeats and bounds a hanging command', async () => {
  const messages: string[] = [];
  const result = await runCommand(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
    timeoutMs: 200, heartbeatMs: 30, log: message => messages.push(message),
  });
  assert.equal(result.code, 124);
  assert.equal(result.timedOut, true);
  assert.ok(result.durationMs < 5000);
  assert.ok(messages.some(message => message.includes('RUNNING')));
});

test('runner handles failure to spawn without leaking its timers', async () => {
  const result = await runCommand('/nonexistent/coursistant-ci-test', [], {
    timeoutMs: 5000, log: () => {},
  });
  assert.equal(result.code, 1);
  assert.equal(result.timedOut, false);
});

test('timeout also terminates grandchildren on POSIX', {skip: process.platform === 'win32'}, async () => {
  const result = await runCommand(process.execPath, ['-e', `
    const {spawn} = require('node:child_process');
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {stdio: 'ignore'});
    process.stdout.write(String(child.pid));
    setInterval(() => {}, 1000);
  `], {timeoutMs: 1000, captureStdout: true, log: () => {}});
  assert.equal(result.code, 124);
  const pid = Number(result.stdout);
  assert.ok(pid > 0);
  // Let the operating system reap the terminated child before probing it.
  for (let attempt = 0; attempt < 20; attempt++) {
    try { process.kill(pid, 0); } catch (error) {
      assert.equal((error as NodeJS.ErrnoException).code, 'ESRCH');
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  assert.fail('grandchild survived timeout');
});
