const test = require('node:test');
const assert = require('node:assert/strict');

const Subtitle = require('../src/modules/subtitle.js');

test('parseSubtitleCues reads SRT cues with comma timestamps', () => {
  const cues = Subtitle.parseSubtitleCues([
    '1',
    '00:00:01,500 --> 00:00:03,250',
    '第一行字幕',
    '第二行字幕',
    '',
  ].join('\n'));

  assert.deepEqual(cues, [
    { start: 1.5, end: 3.25, text: '第一行字幕\n第二行字幕' },
  ]);
});

test('parseSubtitleCues reads WebVTT cues and skips the header', () => {
  const cues = Subtitle.parseSubtitleCues([
    'WEBVTT',
    '',
    '00:00:00.000 --> 00:00:02.000',
    '<b>Hello</b>',
    '',
  ].join('\n'));

  assert.deepEqual(cues, [
    { start: 0, end: 2, text: 'Hello' },
  ]);
});

test('validateCues rejects empty or invalid subtitle content', () => {
  assert.match(Subtitle.validateCues([]), /没有解析到有效字幕/);
  assert.equal(Subtitle.validateCues([{ start: 0, end: 1, text: 'ok' }]), null);
});

test('buildSubtitleArgs overlays generated subtitle images at cue times without infinite image inputs', () => {
  const cues = [
    { start: 0, end: 2, text: 'A' },
    { start: 2.5, end: 4, text: 'B' },
  ];

  const args = Subtitle.buildSubtitleArgs('input.mp4', ['sub_0.png', 'sub_1.png'], cues, 'out.mp4');

  assert.deepEqual(args.slice(0, 6), ['-i', 'input.mp4', '-i', 'sub_0.png', '-i', 'sub_1.png']);
  assert.equal(args.includes('-loop'), false);
  assert.ok(args.includes('-filter_complex'));
  const filter = args[args.indexOf('-filter_complex') + 1];
  assert.equal(
    filter,
    "[0:v][1:v]overlay=0:0:enable='between(t,0,2)'[v1];[v1][2:v]overlay=0:0:enable='between(t,2.5,4)'[v2]"
  );
  assert.equal(args[args.indexOf('-map') + 1], '[v2]');
  assert.ok(args.includes('0:a?'));
});
