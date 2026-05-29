// 画面变换模块（旋转 / 翻转 / 缩放 / 横竖屏适配）
// UMD：纯函数（buildVideoFilter / validate）可在 Node 下单测，init 仅在浏览器绑定 DOM。

(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.TransformModule = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const ROTATE_VF = {
    '0': '',
    '90': 'transpose=1',
    '180': 'transpose=2,transpose=2',
    '270': 'transpose=2',
  };

  // 横竖屏适配目标尺寸
  const FIT_SIZE = {
    '16:9': { w: 1280, h: 720 },
    '9:16': { w: 720, h: 1280 },
  };

  function buildScaleFilter(scale) {
    switch (scale) {
      case '75':
        return 'scale=trunc(iw*0.75/2)*2:trunc(ih*0.75/2)*2';
      case '50':
        return 'scale=trunc(iw*0.5/2)*2:trunc(ih*0.5/2)*2';
      case '720':
        return 'scale=-2:720';
      case '480':
        return 'scale=-2:480';
      default:
        return '';
    }
  }

  function buildFitFilter(fit) {
    const size = FIT_SIZE[fit];
    if (!size) return '';
    return `scale=${size.w}:${size.h}:force_original_aspect_ratio=decrease,` +
      `pad=${size.w}:${size.h}:(ow-iw)/2:(oh-ih)/2`;
  }

  function hasAnyTransform(params) {
    const p = params || {};
    const rotate = String(p.rotate || '0');
    return (rotate !== '0' && ROTATE_VF[rotate]) ||
      Boolean(p.hflip) || Boolean(p.vflip) ||
      (p.scale && p.scale !== 'none') ||
      (p.fit && p.fit !== 'none');
  }

  // 按 旋转 → 翻转 → 缩放 → 横竖屏适配 的顺序拼接 -vf 链
  function buildVideoFilter(params) {
    const p = params || {};
    const parts = [];

    const rotate = ROTATE_VF[String(p.rotate || '0')];
    if (rotate) parts.push(rotate);
    if (p.hflip) parts.push('hflip');
    if (p.vflip) parts.push('vflip');

    const scale = buildScaleFilter(p.scale);
    if (scale) parts.push(scale);

    const fit = buildFitFilter(p.fit);
    if (fit) parts.push(fit);

    return parts.join(',');
  }

  function validate(params) {
    if (!hasAnyTransform(params)) {
      return '请至少选择一种画面变换';
    }
    return null;
  }

  function init() {
    const btn = document.getElementById('transformBtn');
    if (!btn) return;
    btn.addEventListener('click', _handleTransform);
  }

  function readParams() {
    return {
      rotate: document.getElementById('tfRotate').value,
      scale: document.getElementById('tfScale').value,
      fit: document.getElementById('tfFit').value,
      hflip: document.getElementById('tfHflip').checked,
      vflip: document.getElementById('tfVflip').checked,
    };
  }

  async function _handleTransform() {
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
      const inputName = 'input_transform.' + Utils.getFileExtension(file.name);
      const outputName = 'transform-video.mp4';
      const vf = buildVideoFilter(params);

      const args = [
        '-i', inputName,
        '-vf', vf,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'copy',
        '-movflags', '+faststart',
        '-y', outputName,
      ];

      const outputData = await ffmpegService.process(inputName, inputData, args, outputName);
      const blob = new Blob([outputData], { type: 'video/mp4' });

      App.showResult(blob, 'video', 'transform-video.mp4', { operation: 'transform', params: params });
      Status.handleSuccess('画面变换完成');
    } catch (err) {
      Status.handleError(err, '画面变换失败，请重试');
    } finally {
      Status.endProcessing();
    }
  }

  return {
    buildVideoFilter,
    buildScaleFilter,
    buildFitFilter,
    validate,
    init,
  };
});
