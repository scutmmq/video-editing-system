const test = require('node:test');
const assert = require('node:assert/strict');

const Transform = require('../src/modules/transform.js');

test('buildVideoFilter maps rotation angles to transpose', () => {
  assert.equal(Transform.buildVideoFilter({ rotate: '90' }), 'transpose=1');
  assert.equal(Transform.buildVideoFilter({ rotate: '270' }), 'transpose=2');
  assert.equal(Transform.buildVideoFilter({ rotate: '180' }), 'transpose=2,transpose=2');
  assert.equal(Transform.buildVideoFilter({ rotate: '0' }), '');
});

test('buildPreviewState maps transform options to CSS preview state', () => {
  const state = Transform.buildPreviewState({
    rotate: '90',
    scale: '50',
    fit: '9:16',
    hflip: true,
    vflip: false,
  });

  assert.equal(state.fit, '9:16');
  assert.equal(state.videoTransform, 'rotate(90deg) scale(-0.5, 0.5)');
  assert.equal(state.videoMaxHeight, '');
  assert.match(state.text, /旋转 90°/);
  assert.match(state.text, /水平翻转/);
  assert.match(state.text, /缩放 50%/);
  assert.match(state.text, /适配 9:16/);
});

test('buildPreviewState maps output heights to preview max height', () => {
  assert.equal(
    Transform.buildPreviewState({ rotate: '0', scale: '720', fit: '9:16' }).videoMaxHeight,
    'min(52vh, 360px)'
  );
  assert.equal(
    Transform.buildPreviewState({ rotate: '0', scale: '720', fit: '9:16' }).containerMaxWidth,
    'min(100%, 315px)'
  );
  assert.equal(
    Transform.buildPreviewState({ rotate: '0', scale: '480', fit: '9:16' }).videoMaxHeight,
    'min(42vh, 260px)'
  );
  assert.equal(
    Transform.buildPreviewState({ rotate: '0', scale: '480', fit: '9:16' }).containerMaxWidth,
    'min(100%, 235px)'
  );
});

test('buildPreviewState reports original preview for unchanged transform settings', () => {
  const state = Transform.buildPreviewState({ rotate: '0', scale: 'none', fit: 'none' });
  assert.equal(state.fit, 'none');
  assert.equal(state.videoTransform, '');
  assert.equal(state.text, '画面预览：原始画面');
});

test('buildVideoFilter chains flips in order', () => {
  assert.equal(Transform.buildVideoFilter({ hflip: true, vflip: true }), 'hflip,vflip');
  assert.equal(Transform.buildVideoFilter({ hflip: true }), 'hflip');
});

test('buildVideoFilter builds scale expressions with even dimensions', () => {
  assert.equal(Transform.buildScaleFilter('50'), 'scale=trunc(iw*0.5/2)*2:trunc(ih*0.5/2)*2');
  assert.equal(Transform.buildScaleFilter('720'), 'scale=-2:720');
  assert.equal(Transform.buildScaleFilter('none'), '');
});

test('buildVideoFilter builds fit padding for portrait/landscape', () => {
  assert.equal(
    Transform.buildFitFilter('9:16'),
    'scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2'
  );
  assert.match(Transform.buildFitFilter('16:9'), /pad=1280:720/);
  assert.equal(Transform.buildFitFilter('none'), '');
});

test('buildVideoFilter composes rotate, flip, scale and fit in order', () => {
  const vf = Transform.buildVideoFilter({ rotate: '90', hflip: true, scale: '720', fit: 'none' });
  assert.equal(vf, 'transpose=1,hflip,scale=-2:720');
});

test('validate requires at least one transform', () => {
  assert.equal(Transform.validate({ rotate: '0', scale: 'none', fit: 'none' }), '请至少选择一种画面变换');
  assert.equal(Transform.validate({ rotate: '90' }), null);
  assert.equal(Transform.validate({ hflip: true }), null);
});
