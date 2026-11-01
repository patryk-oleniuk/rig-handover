export type DigestStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: DigestStatus;
  lastError: string | null;
  first: string;
  last: string;
};

export type NightDigest = {
  rows: DigestRow[];
  badLines: number;
  counts: { ok: number; retry: number; fail: number };
};

export { readNight } from './read.js';
