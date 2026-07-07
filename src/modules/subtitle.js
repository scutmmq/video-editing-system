// 字幕烧录模块：Canvas 渲染字幕 PNG + FFmpeg overlay 按时间叠加
(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.SubtitleModule = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function parseTimestamp(value) {
    const text = String(value || '').trim().replace(',', '.');
    const match = text.match(/^(?:(\d+):)?(\d{2}):(\d{2})(?:\.(\d{1,3}))?/);
    if (!match) return NaN;

    const hours = Number(match[1] || 0);
    const minutes = Number(match[2] || 0);
    const seconds = Number(match[3] || 0);
    const millis = Number((match[4] || '').padEnd(3, '0') || 0);
    return hours * 3600 + minutes * 60 + seconds + millis / 1000;
  }

  function stripSubtitleMarkup(text) {
    return String(text || '')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .trim();
  }

  function parseSubtitleCues(content) {
    const normalized = String(content || '')
      .replace(/^\uFEFF/, '')
      .replace(/\r\n?/g, '\n')
      .trim();
    if (!normalized) return [];

    return normalized
      .split(/\n{2,}/)
      .map(function (block) {
        const lines = block.split('\n').map(function (line) { return line.trim(); });
        if (!lines.length || /^WEBVTT/i.test(lines[0]) || /^NOTE(?:\s|$)/i.test(lines[0])) return null;

        const timeLineIndex = lines.findIndex(function (line) { return line.indexOf('-->') !== -1; });
        if (timeLineIndex === -1) return null;

        const timeParts = lines[timeLineIndex].split(/\s+-->\s+/);
        if (timeParts.length < 2) return null;

        const start = parseTimestamp(timeParts[0]);
        const end = parseTimestamp(timeParts[1].split(/\s+/)[0]);
        const text = stripSubtitleMarkup(lines.slice(timeLineIndex + 1).join('\n'));

        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !text) return null;
        return { start, end, text };
      })
      .filter(Boolean);
  }

  function validateCues(cues) {
    if (!Array.isArray(cues) || cues.length === 0) {
      return '没有解析到有效字幕，请检查 SRT / VTT 文件格式';
    }
    return null;
  }

  function formatTime(value) {
    return Number(value).toFixed(3).replace(/\.?0+$/, '');
  }

  function buildOverlayFilter(cues) {
    let currentLabel = '0:v';
    const parts = cues.map(function (cue, index) {
      const inputLabel = (index + 1) + ':v';
      const outputLabel = 'v' + (index + 1);
      const start = formatTime(Math.max(0, cue.start));
      const end = formatTime(Math.max(cue.start, cue.end));
      const filter = '[' + currentLabel + '][' + inputLabel + ']overlay=0:0:enable=\'between(t,' + start + ',' + end + ')\'[' + outputLabel + ']';
      currentLabel = outputLabel;
      return filter;
    });

    return {
      filter: parts.join(';'),
      outputLabel: '[' + currentLabel + ']',
    };
  }

  function buildSubtitleArgs(inputName, overlayNames, cues, outputName) {
    const args = ['-i', inputName];
    overlayNames.forEach(function (name) {
      args.push('-i', name);
    });

    const overlay = buildOverlayFilter(cues);
    args.push(
      '-filter_complex', overlay.filter,
      '-map', overlay.outputLabel,
      '-map', '0:a?',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'copy',
      '-movflags', '+faststart',
      '-y', outputName
    );
    return args;
  }

  function wrapLine(ctx, text, maxWidth) {
    const hasSpaces = /\s/.test(text);
    const chunks = hasSpaces ? text.split(/\s+/) : text.split('');
    const lines = [];
    let line = '';

    chunks.forEach(function (chunk) {
      const separator = hasSpaces && line ? ' ' : '';
      const next = line + separator + chunk;
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line);
        line = chunk;
      } else {
        line = next;
      }
    });

    if (line) lines.push(line);
    return lines;
  }

  function getSubtitleLines(ctx, text, maxWidth) {
    return String(text || '')
      .split('\n')
      .flatMap(function (line) { return wrapLine(ctx, line.trim(), maxWidth); })
      .filter(Boolean);
  }

  function resolveSubtitleBox(position, width, height, boxWidth, boxHeight) {
    const margin = Math.max(16, Math.round(height * 0.06));
    const x = Math.round((width - boxWidth) / 2);
    if (position === 'top') return { x, y: margin };
    if (position === 'middle') return { x, y: Math.round((height - boxHeight) / 2) };
    return { x, y: height - boxHeight - margin };
  }

  function createSubtitleImage(text, options) {
    if (typeof document === 'undefined') {
      return Promise.reject(new Error('Canvas 渲染只支持浏览器环境'));
    }

    const width = options.width || 1280;
    const height = options.height || 720;
    const fontSize = options.fontSize || 24;
    const position = options.position || 'bottom';
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    ctx.font = 'bold ' + fontSize + 'px "Microsoft YaHei", "PingFang SC", "Noto Sans SC", "SimHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const maxTextWidth = Math.round(width * 0.86);
    const lines = getSubtitleLines(ctx, text, maxTextWidth);
    const lineHeight = Math.round(fontSize * 1.35);
    const boxPaddingX = Math.round(fontSize * 0.65);
    const boxPaddingY = Math.round(fontSize * 0.45);
    const widestLine = Math.max.apply(null, lines.map(function (line) { return ctx.measureText(line).width; }).concat([0]));
    const boxWidth = Math.min(width - 32, Math.ceil(widestLine + boxPaddingX * 2));
    const boxHeight = Math.ceil(lines.length * lineHeight + boxPaddingY * 2);
    const box = resolveSubtitleBox(position, width, height, boxWidth, boxHeight);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(box.x, box.y, boxWidth, boxHeight);

    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = '#ffffff';

    lines.forEach(function (line, index) {
      ctx.fillText(line, width / 2, box.y + boxPaddingY + index * lineHeight);
    });

    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (!blob) {
          reject(new Error('字幕图片生成失败'));
          return;
        }
        const reader = new FileReader();
        reader.onload = function () { resolve(new Uint8Array(reader.result)); };
        reader.onerror = reject;
        reader.readAsArrayBuffer(blob);
      }, 'image/png');
    });
  }

  function readTextFile(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = reject;
      reader.readAsText(file, 'utf-8');
    });
  }

  const SubtitleModule = {
    _fileInput: null,
    _positionSelect: null,
    _fontSizeInput: null,
    _btn: null,
    _currentFile: null,

    parseTimestamp,
    parseSubtitleCues,
    validateCues,
    buildOverlayFilter,
    buildSubtitleArgs,
    createSubtitleImage,

    init() {
      this._fileInput = document.getElementById('subFileInput');
      this._positionSelect = document.getElementById('subPosition');
      this._fontSizeInput = document.getElementById('subFontSize');
      this._btn = document.getElementById('subtitleBtn');

      this._btn.addEventListener('click', () => this._handleSubtitle());

      var self = this;
      this._fileInput.addEventListener('change', function (e) {
        if (e.target.files.length > 0) {
          self._currentFile = e.target.files[0];
          var infoEl = document.getElementById('subFileInfo');
          if (infoEl) infoEl.textContent = '已选择: ' + self._currentFile.name + ' (' + Utils.formatFileSize(self._currentFile.size) + ')';
        }
      });
    },

    async _handleSubtitle() {
      const file = Upload.getFile();
      if (!file) { Status.toast('请先上传视频文件', 'warning'); return; }
      if (!this._currentFile) { Status.toast('请先选择 SRT / VTT 字幕文件', 'warning'); return; }

      const position = this._positionSelect.value;
      const fontSize = parseInt(this._fontSizeInput.value, 10) || 24;
      const video = document.getElementById('videoPlayer');
      const width = video && video.videoWidth ? video.videoWidth : 1280;
      const height = video && video.videoHeight ? video.videoHeight : 720;
      let tempFiles = [];

      Status.startProcessing();
      try {
        const subtitleText = await readTextFile(this._currentFile);
        const cues = parseSubtitleCues(subtitleText);
        const error = validateCues(cues);
        if (error) { Status.toast(error, 'error'); Status.setState('invalid', error); return; }

        const inputData = await Upload.getFileData();
        const ext = Utils.getFileExtension(file.name);
        const inputName = 'input_sub.' + ext;
        const outputName = 'subtitle-video.mp4';
        const overlayNames = cues.map(function (_, index) { return 'subtitle_' + index + '.png'; });
        tempFiles = [inputName].concat(overlayNames, [outputName]);

        await ffmpegService.load();
        await ffmpegService.writeFile(inputName, inputData);

        for (let i = 0; i < cues.length; i++) {
          const imageData = await createSubtitleImage(cues[i].text, { width, height, fontSize, position });
          await ffmpegService.writeFile(overlayNames[i], imageData);
        }

        await ffmpegService.run(buildSubtitleArgs(inputName, overlayNames, cues, outputName));

        const outputData = await ffmpegService.readFile(outputName);
        if (outputData.length < 1024) throw new Error('字幕烧录输出文件异常');

        const blob = new Blob([outputData], { type: 'video/mp4' });
        App.showResult(blob, 'video', 'subtitle-video.mp4', { operation: 'subtitle_burn', params: { filename: this._currentFile.name, position: position, fontSize: fontSize } });
        Status.handleSuccess('字幕烧录完成');
      } catch (err) {
        Status.handleError(err, '字幕烧录失败，请查验字幕文件格式后重试');
      } finally {
        if (tempFiles.length) await ffmpegService.cleanup(tempFiles);
        Status.endProcessing();
      }
    },
  };

  return SubtitleModule;
});
