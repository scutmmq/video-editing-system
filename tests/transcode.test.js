const test = require('node:test');
const assert = require('node:assert/strict');

const Transcode = require('../src/modules/transcode.js');

test('buildArgs produces H.264/AAC for mp4 with correct crf', () => {
  const { args, outputName, mime } = Transcode.buildArgs('in.mov', {
    format: 'mp4', resolution: 'keep', quality: 'medium',
  });
  assert.equal(outputName, 'transcode-video.mp4');
  assert.equal(mime, 'video/mp4');
  assert.ok(args.includes('libx264'));
  assert.ok(args.includes('aac'));
  assert.equal(args[args.indexOf('-crf') + 1], '26');
  assert.ok(args.includes('+faststart'));
});

test('buildArgs produces VP9/Opus for webm with -b:v 0', () => {
  const { args, outputName, mime } = Transcode.buildArgs('in.mp4', {
    format: 'webm', resolution: '720', quality: 'high',
  });
  assert.equal(outputName, 'transcode-video.webm');
  assert.equal(mime, 'video/webm');
  assert.ok(args.includes('libvpx-vp9'));
  assert.ok(args.includes('libopus'));
  assert.equal(args[args.indexOf('-crf') + 1], '20');
  assert.equal(args[args.indexOf('-b:v') + 1], '0');
});

test('buildArgs adds scale only when resolution is not keep', () => {
  const keep = Transcode.buildArgs('in.mp4', { format: 'mp4', resolution: 'keep', quality: 'low' });
  assert.ok(!keep.args.includes('-vf'));

  const scaled = Transcode.buildArgs('in.mp4', { format: 'mp4', resolution: '480', quality: 'low' });
  assert.equal(scaled.args[scaled.args.indexOf('-vf') + 1], 'scale=-2:480');
});

test('validate rejects bad format, quality and resolution', () => {
  assert.match(Transcode.validate({ format: 'avi', resolution: 'keep', quality: 'high' }), /输出格式/);
  assert.match(Transcode.validate({ format: 'mp4', resolution: 'keep', quality: 'ultra' }), /质量等级/);
  assert.match(Transcode.validate({ format: 'mp4', resolution: '4k', quality: 'high' }), /分辨率/);
  assert.equal(Transcode.validate({ format: 'webm', resolution: '1080', quality: 'medium' }), null);
});
