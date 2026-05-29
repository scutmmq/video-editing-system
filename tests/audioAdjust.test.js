const test = require('node:test');
const assert = require('node:assert/strict');

const AudioAdjust = require('../src/modules/audioAdjust.js');

test('buildArgs drops audio when muted', () => {
  const args = AudioAdjust.buildArgs('in.mp4', 'out.mp4', { mute: true });
  assert.ok(args.includes('-an'));
  assert.ok(!args.includes('-af'));
  assert.ok(args.includes('copy')); // video stream copied
});

test('buildAudioFilter composes volume and fades', () => {
  const af = AudioAdjust.buildAudioFilter({ volumeDb: 6, fadeIn: 2, fadeOut: 3, duration: 10 });
  assert.equal(af, 'volume=6dB,afade=t=in:st=0:d=2,afade=t=out:st=7:d=3');
});

test('buildAudioFilter omits parts that are zero', () => {
  assert.equal(AudioAdjust.buildAudioFilter({ volumeDb: 0, fadeIn: 0, fadeOut: 0 }), '');
  assert.equal(AudioAdjust.buildAudioFilter({ volumeDb: -3 }), 'volume=-3dB');
});

test('buildArgs uses -af and re-encodes audio when not muted', () => {
  const args = AudioAdjust.buildArgs('in.mp4', 'out.mp4', { volumeDb: 6 });
  assert.equal(args[args.indexOf('-af') + 1], 'volume=6dB');
  assert.ok(args.includes('aac'));
});

test('validate enforces volume range and fade bounds', () => {
  assert.match(AudioAdjust.validate({ volumeDb: 40 }), /音量调整范围/);
  assert.match(AudioAdjust.validate({ volumeDb: 0, fadeIn: 5, fadeOut: 6, duration: 10 }), /总时长/);
  assert.match(AudioAdjust.validate({ volumeDb: 0, fadeIn: 0, fadeOut: 0 }), /至少选择一种/);
  assert.equal(AudioAdjust.validate({ mute: true }), null);
  assert.equal(AudioAdjust.validate({ volumeDb: 6, duration: 10 }), null);
});
