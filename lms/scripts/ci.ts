import {spawn} from 'node:child_process';
import {appendFile, mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const APP_ROOT = fileURLToPath(new URL('../', import.meta.url));
const REPORT_DIRECTORY = resolve(APP_ROOT, 'artifacts/ci');
const HEARTBEAT_MS = 15_000;
const AUDIT_TIMEOUT_MS = 45_000;
const INSTALL_TIMEOUT_MS = 180_000;
const STEP_TIMEOUT_MS = 15 * 60_000;
const TERMINATION_GRACE_MS = 2_000;

export const INSTALL_ARGS = [
  'ci', '--no-audit', '--no-fund', '--prefer-offline',
  '--fetch-timeout=30000', '--fetch-retries=1',
  '--fetch-retry-mintimeout=1000', '--fetch-retry-maxtimeout=5000',
];
export const AUDIT_ARGS = [
  'audit', '--audit=true', '--package-lock-only', '--json', '--audit-level=low',
  '--include=dev', '--include=optional', '--include=peer',
  '--offline=false', '--prefer-offline=false', '--prefer-online=true',
  '--fetch-timeout=15000', '--fetch-retries=0',
];

interface CommandResult {
  code: number;
  timedOut: boolean;
  interrupted: boolean;
  durationMs: number;
  stdout: string;
}

interface CommandOptions {
  label?: string;
  cwd?: string;
  timeoutMs: number;
  heartbeatMs?: number;
  captureStdout?: boolean;
  log?: (message: string) => void;
}

/** Bound the whole command, not just each network request. Kill its subprocesses too. */
export function runCommand(command: string, args: string[], options: CommandOptions): Promise<CommandResult> {
  const started = Date.now();
  const log = options.log ?? ((message: string) => process.stdout.write(`${message}\n`));
  const label = options.label ?? `${command} ${args.join(' ')}`;
  log(`[ci] START ${label}`);
  return new Promise(resolveResult => {
    const grouped = process.platform !== 'win32';
    const child = spawn(command, args, {
      cwd: options.cwd ?? APP_ROOT,
      detached: grouped,
      stdio: ['ignore', options.captureStdout ? 'pipe' : 'inherit', 'inherit'],
    });
    let stdout = '';
    let timedOut = false;
    let interrupted = false;
    let finished = false;
    let forceKill: ReturnType<typeof setTimeout> | undefined;
    child.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    const kill = (signal: NodeJS.Signals) => {
      if (!child.pid) return;
      try {
        if (grouped) process.kill(-child.pid, signal);
        else child.kill(signal);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') log(`[ci] Unable to signal child: ${String(error)}`);
      }
    };
    const stop = () => {
      kill('SIGTERM');
      forceKill ??= setTimeout(() => kill('SIGKILL'), TERMINATION_GRACE_MS);
    };
    const interrupt = () => { interrupted = true; stop(); };
    process.once('SIGINT', interrupt);
    process.once('SIGTERM', interrupt);
    const heartbeat = setInterval(() => {
      log(`[ci] RUNNING ${label} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
    }, options.heartbeatMs ?? HEARTBEAT_MS);
    const timeout = setTimeout(() => {
      timedOut = true;
      log(`[ci] TIMEOUT ${label}`);
      stop();
    }, options.timeoutMs);
    const finish = (code: number) => {
      if (finished) return;
      finished = true;
      clearInterval(heartbeat);
      clearTimeout(timeout);
      clearTimeout(forceKill);
      // The npm parent may exit before a child that ignored SIGTERM.
      if (timedOut || interrupted) kill('SIGKILL');
      process.removeListener('SIGINT', interrupt);
      process.removeListener('SIGTERM', interrupt);
      const durationMs = Date.now() - started;
      const resultCode = timedOut ? 124 : interrupted ? 130 : code;
      log(`[ci] END ${label}: exit=${resultCode}, ${(durationMs / 1000).toFixed(1)}s`);
      resolveResult({code: resultCode, timedOut, interrupted, durationMs, stdout});
    };
    child.once('error', error => { log(`[ci] Cannot start command: ${error.message}`); finish(1); });
    child.once('close', code => finish(code ?? 1));
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function classifyAudit(result: Pick<CommandResult, 'code' | 'timedOut' | 'interrupted' | 'stdout'>) {
  let report: unknown;
  try { report = JSON.parse(result.stdout); } catch { /* Missing/invalid output is incomplete, never clean. */ }
  if (result.timedOut || result.interrupted || !isObject(report) || report.error ||
      !isObject(report.metadata) || !isObject(report.metadata.vulnerabilities) || !isObject(report.vulnerabilities)) {
    return {status: 'incomplete' as const, exitCode: 2};
  }
  const counts = report.metadata.vulnerabilities;
  const severities = ['info', 'low', 'moderate', 'high', 'critical'] as const;
  if (![...severities, 'total'].every(key => Number.isInteger(counts[key]) && Number(counts[key]) >= 0) ||
      severities.reduce((sum, key) => sum + Number(counts[key]), 0) !== counts.total ||
      Object.keys(report.vulnerabilities).length !== counts.total || ![0, 1].includes(result.code)) {
    return {status: 'incomplete' as const, exitCode: 2};
  }
  if (Number(counts.total) > 0) return {status: 'vulnerabilities' as const, exitCode: 1, counts};
  return result.code === 0
    ? {status: 'clean' as const, exitCode: 0, counts}
    : {status: 'incomplete' as const, exitCode: 2};
}

async function summary(message: string) {
  process.stdout.write(`${message}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${message}\n\n`);
}

async function main() {
  const [mode, script, ...extra] = process.argv.slice(2);
  // Invoke the npm belonging to the current runtime; do not introduce another CLI install.
  const npmCommand = process.env.npm_execpath;
  const runNpm = (args: string[], options: CommandOptions) => {
    const labeledOptions = {...options, label: `npm ${args.join(' ')}`};
    return npmCommand
      ? runCommand(process.execPath, [npmCommand, ...args], labeledOptions)
      : runCommand('npm', args, labeledOptions);
  };
  if (mode === 'audit') {
    await mkdir(REPORT_DIRECTORY, {recursive: true});
    // Invalidate earlier success before starting a request that could be interrupted.
    await writeFile(resolve(REPORT_DIRECTORY, 'audit-status.json'), JSON.stringify({status: 'incomplete', reason: 'started'}));
    await writeFile(resolve(REPORT_DIRECTORY, 'npm-audit.json'), '{}\n');
    const result = await runNpm(AUDIT_ARGS, {timeoutMs: AUDIT_TIMEOUT_MS, captureStdout: true});
    const outcome = classifyAudit(result);
    await writeFile(resolve(REPORT_DIRECTORY, 'npm-audit.json'), result.stdout || '{}\n');
    await writeFile(resolve(REPORT_DIRECTORY, 'audit-status.json'), JSON.stringify({
      ...outcome, durationMs: result.durationMs, timedOut: result.timedOut,
      interrupted: result.interrupted, npmExitCode: result.code, checkedAt: new Date().toISOString(),
    }, null, 2));
    await summary(`Dependency audit: **${outcome.status}** (${(result.durationMs / 1000).toFixed(1)}s).`);
    if (outcome.counts) await summary(`Vulnerability counts: ${JSON.stringify(outcome.counts)}`);
    process.exitCode = outcome.exitCode;
    return;
  }
  let args: string[];
  if (mode === 'install' && !script) args = INSTALL_ARGS;
  else if (mode === 'step' && script) {
    const manifest = JSON.parse(await readFile(resolve(APP_ROOT, 'package.json'), 'utf8')) as {scripts: Record<string, string>};
    if (!Object.hasOwn(manifest.scripts, script) || ['ci:step', 'deps:ci', 'deps:audit'].includes(script)) {
      throw new Error(`Unsupported CI step: ${script}`);
    }
    args = ['run', script, ...(extra.length ? ['--', ...extra] : [])];
  } else throw new Error('Use npm run deps:ci, npm run deps:audit, or npm run ci:step -- <script> [arguments].');
  const result = await runNpm(args, {timeoutMs: mode === 'install' ? INSTALL_TIMEOUT_MS : STEP_TIMEOUT_MS});
  await summary(`${mode === 'install' ? 'Locked install' : script}: exit ${result.code}, ${(result.durationMs / 1000).toFixed(1)}s.`);
  process.exitCode = result.code;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { process.stderr.write(`${String(error)}\n`); process.exitCode = 1; });
}
