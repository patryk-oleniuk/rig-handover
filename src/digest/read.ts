import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, DigestStatus, NightDigest } from './types.js';

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = new Set<DigestStatus>(['ok', 'retry', 'fail']);

type Line = {
  at: string;
  job: string;
  status: DigestStatus;
  owner: string | null;
  error: string | null;
};

function parseLine(raw: string): Line | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.at !== 'string' || typeof row.job !== 'string') return null;
  if (typeof row.status !== 'string' || !STATUSES.has(row.status as DigestStatus)) return null;
  if (row.owner !== null && typeof row.owner !== 'string') return null;
  if (row.error !== undefined && row.error !== null && typeof row.error !== 'string') return null;
  return {
    at: row.at,
    job: row.job,
    status: row.status as DigestStatus,
    owner: row.owner,
    error: typeof row.error === 'string' ? row.error : null,
  };
}

function time(at: string): number {
  const parsed = Date.parse(at);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function readNight(runsDir: string, night: string): NightDigest | null {
  if (!NIGHT.test(night)) return null;
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }

  const byJob = new Map<string, Line[]>();
  const counts = { ok: 0, retry: 0, fail: 0 };
  let badLines = 0;

  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    const line = parseLine(raw);
    if (!line) {
      badLines += 1;
      continue;
    }
    counts[line.status] += 1;
    const group = byJob.get(line.job);
    if (group) group.push(line);
    else byJob.set(line.job, [line]);
  }

  const rows: DigestRow[] = [...byJob.entries()]
    .map(([job, lines]) => {
      let first = lines[0];
      let last = lines[0];
      let retries = 0;
      for (const line of lines) {
        if (line.status === 'retry') retries += 1;
        if (time(line.at) <= time(first.at)) first = line;
        if (time(line.at) >= time(last.at)) last = line;
      }
      return {
        job,
        owner: last.owner,
        runs: lines.length,
        retries,
        lastStatus: last.status,
        lastError: last.error,
        first: first.at,
        last: last.at,
      };
    })
    .sort((a, b) => a.job.localeCompare(b.job));

  return { rows, badLines, counts };
}
