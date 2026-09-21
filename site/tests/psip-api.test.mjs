import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('../lib/psip-api.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const ttl = 30 * 60 * 1000;
const data = { generatedAt: '2026-09-22', summary: {}, options: {}, records: [], regions: [], classroomClassifications: [], readinessCounts: [] };
function client(storage = { entry: null }, network = async () => ({ ok: true, json: async () => data })) {
  let now = 1000, calls = 0;
  const exports = {};
  vm.runInNewContext(source, {
    exports, Date: { now: () => now }, DOMException,
    require: () => ({ DASHBOARD_CACHE_TTL_MS: ttl,
      readDashboardCache: async () => storage.entry,
      writeDashboardCache: async (entry) => { storage.entry = entry; },
    }),
    fetch: async () => { calls++; return network(); },
  });
  return { api: exports, calls: () => calls, advance: (ms) => { now += ms; } };
}
test('preload and dashboard share a request, then persist across reloads for 30 minutes', async () => {
  const storage = { entry: null };
  const first = client(storage);
  await Promise.all([first.api.prefetchDashboard(), first.api.fetchDashboard()]);
  assert.equal(first.calls(), 1);
  first.advance(ttl - 1);
  await first.api.fetchDashboard();
  assert.equal(first.calls(), 1);
  const reloaded = client(storage);
  await reloaded.api.fetchDashboard();
  assert.equal(reloaded.calls(), 0);
  first.advance(1);
  await first.api.fetchDashboard();
  assert.equal(first.calls(), 2);
});
test('refresh bypasses fresh cache and replaces it', async () => {
  const c = client();
  await c.api.fetchDashboard();
  await c.api.fetchDashboard(undefined, true);
  assert.equal(c.calls(), 2);
});
test('invalid persisted data is ignored', async () => {
  const c = client({ entry: { expiresAt: 9999999, data: {} } });
  await c.api.fetchDashboard();
  assert.equal(c.calls(), 1);
});
test('failed preload can be retried', async () => {
  let attempts = 0;
  const c = client(undefined, async () => {
    if (++attempts === 1) throw new Error('offline');
    return { ok: true, json: async () => data };
  });
  await c.api.prefetchDashboard();
  await c.api.fetchDashboard();
  assert.equal(c.calls(), 2);
});
test('aborting one consumer does not cancel the shared preload', async () => {
  const c = client();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(c.api.fetchDashboard(controller.signal), { name: 'AbortError' });
  await c.api.fetchDashboard();
  assert.equal(c.calls(), 1);
});
