const test = require('node:test');
const assert = require('node:assert/strict');

const Speed = require('../src/modules/speed.js');

test('buildFilters maps speed to setpts/atempo', () => {
  assert.deepEqual(Speed.buildFilters({ speed: '2' }), { vf: 'setpts=PTS/2', af: 'atempo=2' });
  assert.deepEqual(Speed.buildFilters({ speed: '0.5' }), { vf: 'setpts=PTS/0.5', af: 'atempo=0.5' });
});

test('buildFilters uses reverse/areverse in reverse mode', () => {
  assert.deepEqual(Speed.buildFilters({ reverse: true, speed: '2' }), { vf: 'reverse', af: 'areverse' });
});

test('validate accepts allowed speeds only', () => {
  assert.equal(Speed.validate({ speed: '1.5' }), null);
  assert.match(Speed.validate({ speed: '3' }), /播放速度/);
  assert.match(Speed.validate({ speed: '1' }), /播放速度/);
});

test('validate limits reverse to short clips', () => {
  assert.equal(Speed.validate({ reverse: true, duration: 20 }), null);
  assert.match(Speed.validate({ reverse: true, duration: 40 }), /倒放/);
});
