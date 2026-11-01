import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { DigestRow } from '../src/digest/types.js';

const configBase = {
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
};

function appWith(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(dir, name), body);
  }
  return createApp({ ...configBase, runsDir: dir });
}

const good = '{"at":"2026-10-28T23:00:02+01:00","job":"rig/rotate-logs","status":"ok","owner":"lane-07"}\n';
const later = '{"at":"2026-10-29T01:00:00+01:00","job":"lane/sync","status":"fail","owner":null,"error":"disk full"}\n';

describe('digest routes', () => {
  it('returns 200 and the same job order from the page and the JSON', async () => {
    const app = appWith({ '2026-10-28.jsonl': good + later });
    const page = await app.request('/digest/2026-10-28');
    const api = await app.request('/api/digest/2026-10-28');
    expect(page.status).toBe(200);
    expect(api.status).toBe(200);
    const html = await page.text();
    const rows = (await api.json()) as DigestRow[];
    expect(rows.map((row) => row.job)).toEqual(['lane/sync', 'rig/rotate-logs']);
    let at = 0;
    for (const row of rows) {
      const found = html.indexOf(row.job, at);
      expect(found).toBeGreaterThanOrEqual(0);
      at = found + row.job.length;
    }
    expect(html).toContain('—');
    expect(html).toContain('disk full');
    expect(html).toContain('class="warn"');
  });

  it('returns 404 when the night file is missing', async () => {
    const app = appWith({});
    expect((await app.request('/digest/2026-10-28')).status).toBe(404);
    expect((await app.request('/api/digest/2026-10-28')).status).toBe(404);
  });

  it('renders nothing ran for an empty night', async () => {
    const app = appWith({ '2026-10-28.jsonl': '' });
    const page = await app.request('/digest/2026-10-28');
    const api = await app.request('/api/digest/2026-10-28');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');
    expect(await api.json()).toEqual([]);
  });

  it('renders a night that contains a bad line', async () => {
    const app = appWith({ '2026-10-28.jsonl': `${good}{"job":"lane/sy\n` });
    const page = await app.request('/digest/2026-10-28');
    const api = await app.request('/api/digest/2026-10-28');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('rig/rotate-logs');
    const rows = (await api.json()) as DigestRow[];
    expect(rows.map((row) => row.job)).toEqual(['rig/rotate-logs']);
  });
});
