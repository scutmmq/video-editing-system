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

  function buildPreviewState(params) {
    const p = params || {};
    const rotate = String(p.rotate || '0');
    const fit = (p.fit === '9:16' || p.fit === '16:9') ? p.fit : 'none';
    const transformParts = [];
    const labels = [];
    let videoMaxHeight = '';
    let containerMaxWidth = '';

    if (rotate !== '0' && ROTATE_VF[rotate] != null) {
      transformParts.push('rotate(' + rotate + 'deg)');
      labels.push('旋转 ' + rotate + '°');
    }

    let scaleX = p.hflip ? -1 : 1;
    let scaleY = p.vflip ? -1 : 1;
    if (p.hflip) labels.push('水平翻转');
    if (p.vflip) labels.push('垂直翻转');

    if (p.scale === '75') {
      scaleX *= 0.75;
      scaleY *= 0.75;
      labels.push('缩放 75%');
    } else if (p.scale === '50') {
      scaleX *= 0.5;
      scaleY *= 0.5;
      labels.push('缩放 50%');
    } else if (p.scale === '720' || p.scale === '480') {
      videoMaxHeight = p.scale === '720' ? 'min(52vh, 360px)' : 'min(42vh, 260px)';
      containerMaxWidth = p.scale === '720' ? 'min(100%, 315px)' : 'min(100%, 235px)';
      labels.push('输出高度 ' + p.scale + 'p');
    }

    if (scaleX !== 1 || scaleY !== 1) {
      transformParts.push('scale(' + scaleX + ', ' + scaleY + ')');
    }

    if (fit !== 'none') {
      labels.push('适配 ' + fit);
    }

    return {
      fit,
      videoTransform: transformParts.join(' '),
      videoMaxHeight,
      containerMaxWidth,
      text: labels.length ? '画面预览：' + labels.join(' / ') : '画面预览：原始画面'
    };
  }

  function readParamsFromDocument(doc) {
    return {
      rotate: doc.getElementById('tfRotate').value,
      scale: doc.getElementById('tfScale').value,
      fit: doc.getElementById('tfFit').value,
      hflip: doc.getElementById('tfHflip').checked,
      vflip: doc.getElementById('tfVflip').checked,
    };
  }

  function syncPreview(doc) {
    const d = doc || document;
    const video = d.getElementById('videoPlayer');
    const container = d.getElementById('videoContainer');
    const stateEl = d.getElementById('presetPreviewState');
    if (!video || !container) return;

    const state = buildPreviewState(readParamsFromDocument(d));
    video.style.transform = state.videoTransform;
    video.style.transformOrigin = 'center center';
    video.style.maxWidth = '';
    video.style.maxHeight = state.videoMaxHeight;
    container.style.maxWidth = state.containerMaxWidth || '';
    container.dataset.transformFit = state.fit;
    delete container.dataset.presetPreview;
    delete container.dataset.toolPreview;

    if (stateEl) {
      stateEl.hidden = false;
      stateEl.textContent = state.text;
    }

  }

  function clearPreview(doc) {
    const d = doc || document;
    const video = d.getElementById('videoPlayer');
    const container = d.getElementById('videoContainer');
    const stateEl = d.getElementById('presetPreviewState');

    if (video) {
      video.style.transform = '';
      video.style.transformOrigin = '';
      video.style.maxWidth = '';
      video.style.maxHeight = '';
    }

    if (container) {
      delete container.dataset.transformFit;
      delete container.dataset.presetPreview;
      delete container.dataset.toolPreview;
      container.style.maxWidth = '';
    }

    if (stateEl) {
      stateEl.hidden = true;
      stateEl.textContent = '';
    }
  }

  function init() {
    const btn = document.getElementById('transformBtn');
    if (!btn) return;
    btn.addEventListener('click', _handleTransform);

    ['tfRotate', 'tfScale', 'tfFit', 'tfHflip', 'tfVflip'].forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', function () { syncPreview(document); });
      el.addEventListener('change', function () { syncPreview(document); });
    });
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
    buildPreviewState,
    syncPreview,
    clearPreview,
    validate,
    init,
  };
});
