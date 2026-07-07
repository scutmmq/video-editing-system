const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const HistoryMeta = require('../src/services/historyMeta.js');

test('resultKindForOperation maps every operation', () => {
  assert.equal(HistoryMeta.resultKindForOperation('trim'), 'trimmed_video');
  assert.equal(HistoryMeta.resultKindForOperation('transform'), 'transformed_video');
  assert.equal(HistoryMeta.resultKindForOperation('transcode'), 'transcoded_video');
  assert.equal(HistoryMeta.resultKindForOperation('speed'), 'speed_video');
  assert.equal(HistoryMeta.resultKindForOperation('audio_adjust'), 'audio_adjusted_video');
  assert.equal(HistoryMeta.resultKindForOperation('image_watermark'), 'watermarked_video');
  assert.equal(HistoryMeta.resultKindForOperation('audio_mix'), 'audio_mixed_video');
  assert.equal(HistoryMeta.resultKindForOperation('concat'), 'concatenated_video');
  assert.equal(HistoryMeta.resultKindForOperation('subtitle_burn'), 'subtitled_video');
  assert.equal(HistoryMeta.resultKindForOperation('unknown'), null);
});

test('bucketForKind routes derived kinds to media-derived', () => {
  assert.equal(HistoryMeta.bucketForKind('gif'), 'media-derived');
  assert.equal(HistoryMeta.bucketForKind('audio'), 'media-derived');
  assert.equal(HistoryMeta.bucketForKind('cover_image'), 'media-derived');
  assert.equal(HistoryMeta.bucketForKind('trimmed_video'), 'media-results');
  assert.equal(HistoryMeta.bucketForKind('transcoded_video'), 'media-results');
  assert.equal(HistoryMeta.bucketForKind('subtitled_video'), 'media-results');
});

test('Supabase migrations allow every history operation and result kind', () => {
  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
  const migrationSql = fs.readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .map((name) => fs.readFileSync(path.join(migrationsDir, name), 'utf8'))
    .join('\n');

  for (const operation of Object.keys(HistoryMeta.OPERATION_KIND)) {
    assert.match(migrationSql, new RegExp("'" + operation + "'"), `missing operation ${operation}`);
  }

  for (const kind of new Set(Object.values(HistoryMeta.OPERATION_KIND))) {
    assert.match(migrationSql, new RegExp("'" + kind + "'"), `missing kind ${kind}`);
  }
});

test('buildStoragePath puts user id first (RLS requirement)', () => {
  assert.equal(
    HistoryMeta.buildStoragePath('u1', 'p1', 'a1', 'clip-video.mp4'),
    'u1/p1/a1/clip-video.mp4'
  );
  assert.throws(() => HistoryMeta.buildStoragePath('', 'p1', 'a1', 'x.mp4'), /storage 路径/);
});

test('summarizeParams produces readable summaries', () => {
  assert.equal(HistoryMeta.summarizeParams('trim', { start: 1, end: 5 }), '1s → 5s');
  assert.equal(HistoryMeta.summarizeParams('speed', { reverse: true }), '倒放');
  assert.equal(HistoryMeta.summarizeParams('speed', { speed: '2' }), '2x');
  assert.equal(HistoryMeta.summarizeParams('audio_adjust', { mute: true }), '静音');
  assert.match(HistoryMeta.summarizeParams('transform', { rotate: '90', hflip: true }), /旋转90° \/ 水平翻转/);
  assert.equal(HistoryMeta.summarizeParams('transcode', { format: 'webm', resolution: '720', quality: 'high' }), 'WEBM / 720 / high');
});
