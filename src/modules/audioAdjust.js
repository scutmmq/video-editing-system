// 音频调整模块（静音 / 音量 / 淡入淡出）
// UMD：纯函数（buildArgs / buildAudioFilter / validate）可在 Node 下单测，init 仅在浏览器绑定 DOM。

(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.AudioAdjustModule = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const VOLUME_MIN_DB = -20;
  const VOLUME_MAX_DB = 20;

  function hasAudioChange(p) {
    return Number(p.volumeDb) !== 0 || Number(p.fadeIn) > 0 || Number(p.fadeOut) > 0;
  }

  function validate(params) {
    const p = params || {};

    if (p.mute) return null;

    const volumeDb = Number(p.volumeDb) || 0;
    if (volumeDb < VOLUME_MIN_DB || volumeDb > VOLUME_MAX_DB) {
      return `音量调整范围为 ${VOLUME_MIN_DB}dB ~ +${VOLUME_MAX_DB}dB`;
    }

    const fadeIn = Number(p.fadeIn) || 0;
    const fadeOut = Number(p.fadeOut) || 0;
    if (fadeIn < 0 || fadeOut < 0) {
      return '淡入 / 淡出时长不能为负数';
    }

    const duration = Number(p.duration) || 0;
    if (duration > 0 && fadeIn + fadeOut > duration) {
      return '淡入与淡出时长之和不能超过视频总时长';
    }

    if (!hasAudioChange(p)) {
      return '请至少选择一种音频调整';
    }
    return null;
  }

  // 构建 -af 滤镜链（静音时返回空字符串，由调用方改用 -an）
  function buildAudioFilter(params) {
    const p = params || {};
    const parts = [];

    const volumeDb = Number(p.volumeDb) || 0;
    if (volumeDb !== 0) {
      parts.push('volume=' + volumeDb + 'dB');
    }

    const fadeIn = Number(p.fadeIn) || 0;
    if (fadeIn > 0) {
      parts.push('afade=t=in:st=0:d=' + fadeIn);
    }

    const fadeOut = Number(p.fadeOut) || 0;
    const duration = Number(p.duration) || 0;
    if (fadeOut > 0 && duration > 0) {
      const start = Math.max(0, duration - fadeOut);
      parts.push('afade=t=out:st=' + start + ':d=' + fadeOut);
    }

    return parts.join(',');
  }

  // 返回完整的 ffmpeg 参数数组
  function buildArgs(inputName, outputName, params) {
    const p = params || {};
    const args = ['-i', inputName, '-c:v', 'copy'];

    if (p.mute) {
      args.push('-an');
    } else {
      const af = buildAudioFilter(p);
      if (af) args.push('-af', af);
      args.push('-c:a', 'aac');
    }

    args.push('-movflags', '+faststart', '-y', outputName);
    return args;
  }

  function init() {
    const btn = document.getElementById('audioAdjustBtn');
    if (!btn) return;
    btn.addEventListener('click', _handleAudioAdjust);
  }

  function readParams() {
    return {
      mute: document.getElementById('aaMute').checked,
      volumeDb: Number.parseFloat(document.getElementById('aaVolume').value) || 0,
      fadeIn: Number.parseFloat(document.getElementById('aaFadeIn').value) || 0,
      fadeOut: Number.parseFloat(document.getElementById('aaFadeOut').value) || 0,
      duration: Preview.getDuration(),
    };
  }

  async function _handleAudioAdjust() {
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
      const inputName = 'input_audioadj.' + Utils.getFileExtension(file.name);
      const outputName = 'audio-adjusted.mp4';
      const args = buildArgs(inputName, outputName, params);

      const outputData = await ffmpegService.process(inputName, inputData, args, outputName);
      const blob = new Blob([outputData], { type: 'video/mp4' });

      App.showResult(blob, 'video', 'audio-adjusted.mp4', { operation: 'audio_adjust', params: params });
      Status.handleSuccess('音频调整完成');
    } catch (err) {
      Status.handleError(err, '音频调整失败，请重试');
    } finally {
      Status.endProcessing();
    }
  }

  return {
    buildArgs,
    buildAudioFilter,
    validate,
    VOLUME_MIN_DB,
    VOLUME_MAX_DB,
    init,
  };
});
