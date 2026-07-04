const test = require('node:test');
const assert = require('node:assert/strict');

const { analyzeVideoRisk } = require('../src/modules/upload.js');

test('analyzeVideoRisk returns null for ordinary short videos', () => {
  assert.equal(analyzeVideoRisk({ width: 1280, height: 720, duration: 60 }), null);
});

test('analyzeVideoRisk warns for high resolution videos', () => {
  const risk = analyzeVideoRisk({ width: 2560, height: 1440, duration: 60 });
  assert.equal(risk.level, 'warning');
  assert.deepEqual(risk.reasons, ['high_resolution']);
  assert.match(risk.message, /高分辨率/);
});

test('analyzeVideoRisk warns more specifically for ultra high resolution videos', () => {
  const risk = analyzeVideoRisk({ width: 3840, height: 2160, duration: 60 });
  assert.equal(risk.level, 'warning');
  assert.deepEqual(risk.reasons, ['ultra_high_resolution']);
  assert.match(risk.message, /4K\/超高分辨率/);
});

test('analyzeVideoRisk warns for long videos', () => {
  const risk = analyzeVideoRisk({ width: 1920, height: 1080, duration: 600 });
  assert.equal(risk.level, 'warning');
  assert.deepEqual(risk.reasons, ['long_duration']);
  assert.match(risk.message, /长时长/);
});

test('analyzeVideoRisk combines resolution and duration risks', () => {
  const risk = analyzeVideoRisk({ width: 3840, height: 2160, duration: 1800 });
  assert.equal(risk.level, 'warning');
  assert.deepEqual(risk.reasons, ['ultra_high_resolution', 'very_long_duration']);
  assert.match(risk.message, /4K\/超高分辨率/);
  assert.match(risk.message, /超长时长/);
});
