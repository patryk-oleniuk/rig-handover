import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/types.js';

describe('readNight', () => {
  it('reads 2026-10-28 into 5 jobs and 1 bad line', () => {
    const night = readNight('runs', '2026-10-28');
    expect(night).not.toBeNull();
    expect(night?.badLines).toBe(1);
    expect(night?.rows.map((row) => row.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(night?.counts).toEqual({ ok: 10, retry: 4, fail: 1 });

    const render = night?.rows.find((row) => row.job === 'digest/render');
    expect(render).toMatchObject({
      owner: null,
      runs: 1,
      retries: 0,
      lastStatus: 'ok',
      lastError: null,
      first: '2026-10-29T05:41:09+01:00',
      last: '2026-10-29T05:41:09+01:00',
    });

    const refresh = night?.rows.find((row) => row.job === 'fixtures/refresh');
    expect(refresh).toMatchObject({
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: null,
      first: '2026-10-29T01:30:00+01:00',
      last: '2026-10-29T01:37:00+01:00',
    });

    const sync = night?.rows.find((row) => row.job === 'lane/sync');
    expect(sync).toMatchObject({
      runs: 8,
      retries: 1,
      lastStatus: 'ok',
      lastError: null,
      first: '2026-10-28T23:00:06+01:00',
      last: '2026-10-29T05:00:04+01:00',
    });

    const backup = night?.rows.find((row) => row.job === 'notes/backup');
    expect(backup).toMatchObject({
      owner: 'lane-07',
      runs: 1,
      retries: 0,
      lastStatus: 'fail',
      lastError: 'quota exceeded',
      first: '2026-10-29T04:00:01+01:00',
      last: '2026-10-29T04:00:01+01:00',
    });
  });

  it('returns null when the night file is missing', () => {
    expect(readNight('runs', '1999-01-01')).toBeNull();
  });
});
