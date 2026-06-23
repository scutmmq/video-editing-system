const test = require('node:test');
const assert = require('node:assert/strict');

const { createFakeSupabase } = require('./fakeSupabase.js');
const ProjectService = require('../src/services/projectService.js');
const JobService = require('../src/services/jobService.js');
const AssetService = require('../src/services/assetService.js');
const StorageService = require('../src/services/storageService.js');

test('projectService returns existing default project without inserting', async () => {
  const { client, calls } = createFakeSupabase({
    responders: {
      'projects.select': () => ({ data: [{ id: 'p1', title: '我的项目' }], error: null }),
    },
  });
  const svc = ProjectService.createProjectService(client);
  const project = await svc.getOrCreateDefaultProject('user-1');
  assert.equal(project.id, 'p1');
  assert.equal(calls.inserts.length, 0);
  assert.equal(calls.rpcs.length, 0);
});

test('projectService creates default project via RPC when none exists', async () => {
  const { client, calls } = createFakeSupabase({
    responders: {
      'projects.select': () => ({ data: [], error: null }),
      'rpc.create_project_for_owner': () => ({ data: { id: 'p2', title: '我的项目' }, error: null }),
    },
  });
  const svc = ProjectService.createProjectService(client);
  const project = await svc.getOrCreateDefaultProject('user-1');
  assert.equal(project.id, 'p2');
  assert.equal(calls.rpcs.length, 1);
  assert.equal(calls.rpcs[0].fn, 'create_project_for_owner');
  assert.equal(calls.rpcs[0].params._title, '我的项目');
  assert.equal(calls.inserts.length, 0); // 走 RPC 不应触发 INSERT
});

test('projectService surfaces RPC errors', async () => {
  const { client } = createFakeSupabase({
    responders: {
      'projects.select': () => ({ data: [], error: null }),
      'rpc.create_project_for_owner': () => ({ data: null, error: new Error('用户资料未同步') }),
    },
  });
  const svc = ProjectService.createProjectService(client);
  await assert.rejects(
    () => svc.getOrCreateDefaultProject('user-1'),
    /用户资料未同步/,
  );
});

test('jobService.startJob inserts a processing row and returns id', async () => {
  const { client, calls } = createFakeSupabase({
    responders: { 'processing_jobs.insert': () => ({ data: { id: 'job-9' }, error: null }) },
  });
  const svc = JobService.createJobService(client);
  const id = await svc.startJob({ projectId: 'p1', operation: 'trim', params: { start: 1, end: 2 }, createdBy: 'user-1' });
  assert.equal(id, 'job-9');
  const row = calls.inserts[0].row;
  assert.equal(row.status, 'processing');
  assert.equal(row.operation, 'trim');
  assert.equal(row.created_by, 'user-1');
  assert.deepEqual(row.params, { start: 1, end: 2 });
});

test('jobService.completeJob and failJob update status', async () => {
  const { client, calls } = createFakeSupabase({
    responders: { 'processing_jobs.update': () => ({ data: null, error: null }) },
  });
  const svc = JobService.createJobService(client);
  await svc.completeJob('job-9', 'asset-1');
  assert.equal(calls.updates[0].obj.status, 'succeeded');
  assert.equal(calls.updates[0].obj.result_asset_id, 'asset-1');

  await svc.failJob('job-9', 'boom');
  assert.equal(calls.updates[1].obj.status, 'failed');
  assert.equal(calls.updates[1].obj.error_message, 'boom');
});

test('jobService surfaces insert errors', async () => {
  const { client } = createFakeSupabase({
    responders: { 'processing_jobs.insert': () => ({ data: null, error: new Error('rls denied') }) },
  });
  const svc = JobService.createJobService(client);
  await assert.rejects(() => svc.startJob({ projectId: 'p1', operation: 'trim', createdBy: 'u1' }), /rls denied/);
});

test('assetService.insertResultAsset uses client-generated id and storage path', async () => {
  const { client, calls } = createFakeSupabase({
    responders: { 'media_assets.insert': (state) => ({ data: { id: state.payload.id }, error: null }) },
  });
  const svc = AssetService.createAssetService(client);
  await svc.insertResultAsset({
    id: 'a1', projectId: 'p1', ownerId: 'u1', kind: 'trimmed_video',
    bucket: 'media-results', storagePath: 'u1/p1/a1/clip.mp4', mimeType: 'video/mp4', sizeBytes: 123,
  });
  const row = calls.inserts[0].row;
  assert.equal(row.id, 'a1');
  assert.equal(row.storage_path, 'u1/p1/a1/clip.mp4');
  assert.equal(row.kind, 'trimmed_video');
});

test('assetService.listProjectAssets queries by project and returns rows', async () => {
  const { client, calls } = createFakeSupabase({
    responders: {
      'media_assets.select': () => ({
        data: [{ id: 'a1', bucket: 'media-results', storage_path: 'u1/p1/a1/clip.mp4', mime_type: 'video/mp4', kind: 'trimmed_video' }],
        error: null,
      }),
    },
  });
  const svc = AssetService.createAssetService(client);
  const assets = await svc.listProjectAssets('p1');
  assert.equal(assets.length, 1);
  assert.equal(assets[0].id, 'a1');
});

test('assetService.listProjectAssets surfaces query errors', async () => {
  const { client } = createFakeSupabase({
    responders: { 'media_assets.select': () => ({ data: null, error: new Error('rls denied') }) },
  });
  const svc = AssetService.createAssetService(client);
  await assert.rejects(() => svc.listProjectAssets('p1'), /rls denied/);
});

test('storageService uploads and signs urls', async () => {
  const { client, calls } = createFakeSupabase();
  const svc = StorageService.createStorageService(client);
  await svc.uploadResult('media-results', 'u1/p1/a1/clip.mp4', { type: 'video/mp4', size: 10 }, 'video/mp4');
  assert.equal(calls.uploads[0].bucket, 'media-results');
  assert.equal(calls.uploads[0].options.contentType, 'video/mp4');

  const url = await svc.getSignedUrl('media-results', 'u1/p1/a1/clip.mp4');
  assert.match(url, /^https:\/\/signed\//);
});
