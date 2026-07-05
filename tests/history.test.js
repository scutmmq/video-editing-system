
const test = require('node:test');
const assert = require('node:assert/strict');
const { createFakeSupabase } = require('./fakeSupabase.js');

// Mock HistoryModule methods for testing _persistResult
const HistoryMeta = require('../src/services/historyMeta.js');

function createMockHistory() {
  const calls = { saveLocalJob: [], saveLocalAsset: [], refresh: [] };
  const history = {
    _localMode: true,
    _enabled: true,
    _db: { name: 'mock' },
    _listEl: null,
    _emptyStateEl: null,
    _jobs: [],
    _uuid() { return 'test-uuid-' + Date.now(); },
    async _saveLocalJob(job) { calls.saveLocalJob.push(job); },
    async _saveLocalAsset(asset) { calls.saveLocalAsset.push(asset); },
    async _refresh() { calls.refresh.push(true); },
    async _persistResult(detail) {
      if (!detail || !detail.meta || !detail.meta.operation) return;
      const { blob, type, filename, meta } = detail;
      const kind = HistoryMeta.resultKindForOperation(meta.operation);
      if (!kind) return;
      const jobId = this._uuid();
      const assetId = this._uuid();
      const timestamp = new Date().toISOString();
      const job = { id: jobId, operation: meta.operation, params: meta.params || {}, status: "succeeded", result_asset_id: assetId, created_at: timestamp, updated_at: timestamp, local: true };
      const asset = { id: assetId, kind: kind, original_filename: filename, mime_type: blob.type, size_bytes: blob.size, blob: blob, created_at: timestamp };
      await this._saveLocalJob(job);
      await this._saveLocalAsset(asset);
      await this._refresh();
    },
    async _getLocalJobs() { return []; },
    calls
  };
  return history;
}

test('history._persistResult ignores result without meta', async () => {
  const history = createMockHistory();
  await history._persistResult({ blob: new Blob(), type: 'video', filename: 'test.mp4', meta: null });
  assert.equal(history.calls.saveLocalJob.length, 0);
  assert.equal(history.calls.saveLocalAsset.length, 0);
});

test('history._persistResult ignores result without operation in meta', async () => {
  const history = createMockHistory();
  await history._persistResult({ blob: new Blob(), type: 'video', filename: 'test.mp4', meta: {} });
  assert.equal(history.calls.saveLocalJob.length, 0);
});

test('history._persistResult saves job and asset in local mode', async () => {
  const history = createMockHistory();
  const blob = new Blob(['test-data'], { type: 'video/mp4' });

  // Mock HistoryMeta
  const HistoryMeta = require('../src/services/historyMeta.js');

  await history._persistResult({
    blob: blob,
    type: 'video',
    filename: 'trim-result.mp4',
    meta: { operation: 'trim', params: { start: 1, end: 5 } }
  });

  assert.equal(history.calls.saveLocalJob.length, 1);
  assert.equal(history.calls.saveLocalAsset.length, 1);
  assert.equal(history.calls.saveLocalJob[0].operation, 'trim');
  assert.equal(history.calls.saveLocalJob[0].status, 'succeeded');
  assert.equal(history.calls.saveLocalJob[0].params.start, 1);
  assert.equal(history.calls.saveLocalJob[0].params.end, 5);
  assert.equal(history.calls.saveLocalAsset[0].kind, 'trimmed_video');
  assert.equal(history.calls.saveLocalAsset[0].mime_type, 'video/mp4');
  assert.ok(history.calls.saveLocalAsset[0].blob instanceof Blob);
});
