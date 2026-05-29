// 播放速度模块（变速 + 倒放）
// UMD：纯函数（buildFilters / validate）可在 Node 下单测，init 仅在浏览器绑定 DOM。

(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.SpeedModule = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const ALLOWED_SPEEDS = new Set([0.5, 1.25, 1.5, 2]);
  // 倒放需要在内存中缓冲全部帧，对 wasm 内存压力大，限制时长
  const REVERSE_MAX_DURATION = 30;

  function parseSpeed(value) {
    return Number.parseFloat(value);
  }

  function validate(params) {
    const p = params || {};
    const reverse = Boolean(p.reverse);

    if (reverse) {
      const duration = Number(p.duration) || 0;
      if (duration > REVERSE_MAX_DURATION) {
        return `倒放仅支持 ${REVERSE_MAX_DURATION} 秒以内的视频，请先裁剪后再倒放`;
      }
      return null;
    }

    const speed = parseSpeed(p.speed);
    if (!ALLOWED_SPEEDS.has(speed)) {
      return '请选择有效的播放速度';
    }
    return null;
  }

  // 返回 { vf, af }
  // 倒放模式下忽略倍速，按 1x 反向输出
  function buildFilters(params) {
    const p = params || {};
    if (p.reverse) {
      return { vf: 'reverse', af: 'areverse' };
    }
    const speed = parseSpeed(p.speed);
    return {
      vf: 'setpts=PTS/' + speed,
      af: 'atempo=' + speed,
    };
  }

  function init() {
    const btn = document.getElementById('speedBtn');
    if (!btn) return;
    btn.addEventListener('click', _handleSpeed);
  }

  function readParams() {
    return {
      speed: document.getElementById('spSpeed').value,
      reverse: document.getElementById('spReverse').checked,
      duration: Preview.getDuration(),
    };
  }

  async function _handleSpeed() {
    const file = Upload.getFile();
    if (!file) {
      Status.toast('请先上传视频文件', 'warning');
      return;
    }

    const params = readParams();
    const error = validate(params);
    if (error) {
      Status.toast(error, 'error');
      Status.setState('invalid', error);
      return;
    }

    Status.startProcessing();

    try {
      const inputData = await Upload.getFileData();
      const inputName = 'input_speed.' + Utils.getFileExtension(file.name);
      const outputName = 'speed-video.mp4';
      const { vf, af } = buildFilters(params);

      const args = [
        '-i', inputName,
        '-filter:v', vf,
        '-filter:a', af,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'aac',
        '-movflags', '+faststart',
        '-y', outputName,
      ];

      const outputData = await ffmpegService.process(inputName, inputData, args, outputName);
      const blob = new Blob([outputData], { type: 'video/mp4' });

      App.showResult(blob, 'video', 'speed-video.mp4', { operation: 'speed', params: params });
      Status.handleSuccess(params.reverse ? '视频倒放完成' : '变速处理完成');
    } catch (err) {
      Status.handleError(err, '变速处理失败，请重试');
    } finally {
      Status.endProcessing();
    }
  }

  return {
    buildFilters,
    validate,
    ALLOWED_SPEEDS,
    REVERSE_MAX_DURATION,
    init,
  };
});
