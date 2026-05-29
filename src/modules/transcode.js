// 压缩 / 转码模块（输出格式 + 分辨率 + 质量等级）
// UMD：纯函数（buildArgs / validate）可在 Node 下单测，init 仅在浏览器绑定 DOM。

(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.TranscodeModule = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const FORMATS = {
    mp4: { ext: 'mp4', mime: 'video/mp4', vcodec: 'libx264', acodec: 'aac' },
    webm: { ext: 'webm', mime: 'video/webm', vcodec: 'libvpx-vp9', acodec: 'libopus' },
  };

  // 质量等级 → CRF（数值越大体积越小、画质越低）
  const QUALITY_CRF = {
    high: 20,
    medium: 26,
    low: 32,
  };

  const RESOLUTIONS = new Set(['keep', '1080', '720', '480']);

  function buildScaleFilter(resolution) {
    if (!resolution || resolution === 'keep') return '';
    return 'scale=-2:' + resolution;
  }

  function validate(params) {
    const p = params || {};
    if (!FORMATS[p.format]) {
      return '请选择有效的输出格式（MP4 或 WebM）';
    }
    if (!(p.quality in QUALITY_CRF)) {
      return '请选择有效的质量等级';
    }
    if (!RESOLUTIONS.has(String(p.resolution || 'keep'))) {
      return '请选择有效的分辨率';
    }
    return null;
  }

  // 返回 { args, outputName, mime }
  function buildArgs(inputName, params) {
    const p = params || {};
    const format = FORMATS[p.format] || FORMATS.mp4;
    const qualityKey = p.quality || 'medium';
    const crf = QUALITY_CRF[qualityKey] != null ? QUALITY_CRF[qualityKey] : QUALITY_CRF.medium;
    const outputName = 'transcode-video.' + format.ext;

    const args = ['-i', inputName];

    const scale = buildScaleFilter(p.resolution);
    if (scale) {
      args.push('-vf', scale);
    }

    args.push('-c:v', format.vcodec, '-crf', String(crf));

    if (p.format === 'mp4') {
      args.push('-preset', 'fast', '-movflags', '+faststart');
    } else {
      // VP9 推荐 -b:v 0 启用恒定质量（CRF）模式
      args.push('-b:v', '0');
    }

    args.push('-c:a', format.acodec, '-y', outputName);

    return { args, outputName, mime: format.mime };
  }

  function init() {
    const btn = document.getElementById('transcodeBtn');
    if (!btn) return;
    btn.addEventListener('click', _handleTranscode);
  }

  function readParams() {
    return {
      format: document.getElementById('tcFormat').value,
      resolution: document.getElementById('tcResolution').value,
      quality: document.getElementById('tcQuality').value,
    };
  }

  async function _handleTranscode() {
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
      if (!inputData || inputData.length === 0) {
        throw new Error('文件数据为空，请重新上传');
      }
      const fileName = file.name || 'video.mp4';
      const inputName = 'input_transcode.' + Utils.getFileExtension(fileName);
      const { args, outputName, mime } = buildArgs(inputName, params);

      // 防御性校验：确保所有 args 都是有效字符串（防止 FFmpeg.wasm 内部 MEMFS 报 startsWith 等错误）
      if (!args.every(function (a) { return typeof a === 'string' && a.length > 0; })) {
        throw new Error('FFmpeg 参数无效，请重试');
      }

      const outputData = await ffmpegService.process(inputName, inputData, args, outputName);
      const blob = new Blob([outputData], { type: mime });

      App.showResult(blob, 'video', outputName, { operation: 'transcode', params: params });
      Status.handleSuccess('压缩 / 转码完成');
    } catch (err) {
      Status.handleError(err, '压缩 / 转码失败，请重试');
    } finally {
      Status.endProcessing();
    }
  }

  return {
    buildArgs,
    buildScaleFilter,
    validate,
    QUALITY_CRF,
    init,
  };
});
