import fs from 'node:fs';

const LOG_FILE = '/tmp/liveassist-debug.log';

/**
 * Synchronous, disk-flushed debug logger. Uses appendFileSync deliberately —
 * safe to call even moments before the process might be killed (e.g. by the
 * Extension Host's own bring-up timeout), unlike buffered stdout which can
 * be lost in that case.
 */
export function dbg(...args: unknown[]): void {
  const line = `[${new Date().toISOString()}] ${args.map(String).join(' ')}\n`;
  try {
    fs.appendFileSync(LOG_FILE, line);
  } catch {
    // intentionally swallow — log writes are best-effort
  }
  console.log(...args);
}
