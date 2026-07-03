const test = require('node:test');
const assert = require('node:assert/strict');

const { FFmpegService } = require('../src/modules/ffmpeg.js');

function createFakeFFmpeg(options) {
  const opts = options || {};
  const calls = [];
  const fake = {
    calls,
    async writeFile(name, data) {
      calls.push(['writeFile', name, Array.from(data)]);
    },
    async exec(args, timeout) {
      calls.push(['exec', args, timeout]);
      if (opts.onExec) opts.onExec();
      if (opts.execError) throw opts.execError;
      return opts.exitCode == null ? 0 : opts.exitCode;
    },
    async readFile(name) {
      calls.push(['readFile', name]);
      return opts.readResult || new Uint8Array([7, 8, 9]);
    },
    async deleteFile(name) {
      calls.push(['deleteFile', name]);
      if (opts.deleteError) throw opts.deleteError;
    },
    terminate() {
      calls.push(['terminate']);
      if (opts.terminateError) throw opts.terminateError;
    }
  };
  return fake;
}

function createService(fake) {
  const service = new FFmpegService();
  service.ffmpeg = fake;
  service.loaded = true;
  service.load = async () => {
    service.ffmpeg = fake;
    service.loaded = true;
  };
  return service;
}

test('run rejects non-string argument arrays', async () => {
  const service = createService(createFakeFFmpeg());
  await assert.rejects(
    () => service.run(['-i', 123]),
    /FFmpeg run/
  );
});

test('run throws non-zero exit errors with recent logs', async () => {
  const service = new FFmpegService();
  const fake = createFakeFFmpeg({
    exitCode: 1,
    onExec() {
      service._collectLog('encoder failed');
    }
  });
  service.ffmpeg = fake;

  await assert.rejects(
    () => service.run(['-i', 'in.mp4']),
    /encoder failed/
  );
});

test('process writes input, runs ffmpeg, reads output, and cleans files', async () => {
  const fake = createFakeFFmpeg({ readResult: new Uint8Array([1, 2, 3]) });
  const service = createService(fake);

  const result = await service.process(
    'input.mp4',
    new Uint8Array([9, 8]),
    ['-i', 'input.mp4', '-y', 'output.mp4'],
    'output.mp4',
    { timeout: 123 }
  );

  assert.deepEqual(Array.from(result), [1, 2, 3]);
  assert.deepEqual(fake.calls, [
    ['writeFile', 'input.mp4', [9, 8]],
    ['exec', ['-i', 'input.mp4', '-y', 'output.mp4'], 123],
    ['readFile', 'output.mp4'],
    ['deleteFile', 'input.mp4'],
    ['deleteFile', 'output.mp4'],
    ['deleteFile', 'palette.png']
  ]);
});

test('process cleans input and output files after exec failure', async () => {
  const fake = createFakeFFmpeg({ exitCode: 1 });
  const service = createService(fake);

  await assert.rejects(
    () => service.process('input.mp4', new Uint8Array([1]), ['-bad'], 'output.mp4'),
    /FFmpeg/
  );

  assert.deepEqual(fake.calls, [
    ['writeFile', 'input.mp4', [1]],
    ['exec', ['-bad'], -1],
    ['deleteFile', 'input.mp4'],
    ['deleteFile', 'output.mp4'],
    ['deleteFile', 'palette.png']
  ]);
});

test('cancel terminates ffmpeg and resets service state', () => {
  const fake = createFakeFFmpeg();
  const service = createService(fake);
  service.loading = true;
  service.loadPromise = Promise.resolve();

  service.cancel();

  assert.deepEqual(fake.calls, [['terminate']]);
  assert.equal(service.ffmpeg, null);
  assert.equal(service.loaded, false);
  assert.equal(service.loading, false);
  assert.equal(service.loadPromise, null);
});

test('readFile supports Uint8Array and object-wrapped Uint8Array results', async () => {
  const direct = createService(createFakeFFmpeg({ readResult: new Uint8Array([4, 5]) }));
  assert.deepEqual(Array.from(await direct.readFile('direct.mp4')), [4, 5]);

  const wrapped = createService(createFakeFFmpeg({ readResult: { data: new Uint8Array([6, 7]) } }));
  assert.deepEqual(Array.from(await wrapped.readFile('wrapped.mp4')), [6, 7]);
});
