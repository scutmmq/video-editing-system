// 文字水印模块（Canvas 渲染 + FFmpeg overlay 滤镜）
// 不依赖 FFmpeg drawtext（需要系统字体，WASM 环境不可用）

const WatermarkModule = {
  _textInput: null,
  _fontSizeInput: null,
  _colorInput: null,
  _positionSelect: null,
  _btn: null,

  _positionMap: {
    'top-left':     'top-left',
    'top-right':    'top-right',
    'bottom-left':  'bottom-left',
    'bottom-right': 'bottom-right',
    'center':       'center',
  },

  init() {
    this._textInput = document.getElementById('wmText');
    this._fontSizeInput = document.getElementById('wmFontSize');
    this._colorInput = document.getElementById('wmColor');
    this._positionSelect = document.getElementById('wmPosition');
    this._btn = document.getElementById('watermarkBtn');

    this._btn.addEventListener('click', () => this._handleWatermark());
  },

  validate(text) {
    if (!text || text.trim() === '') return '请输入水印文字';
    if (text.length > 50) return '水印文字过长，请适当缩短（不超过50字）';
    return null;
  },

  // 在 Canvas 上渲染水印文字，输出 PNG 的 Uint8Array
  _createWatermarkImage(text, fontSize, color, position, videoWidth, videoHeight) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = videoWidth;
      canvas.height = videoHeight;
      const ctx = canvas.getContext('2d');

      // 透明背景
      ctx.clearRect(0, 0, videoWidth, videoHeight);

      // 设置文字样式
      ctx.font = `bold ${fontSize}px "Microsoft YaHei", "PingFang SC", "Noto Sans SC", "SimHei", sans-serif`;
      ctx.fillStyle = color;

      // 文字阴影（增强可读性）
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      const metrics = ctx.measureText(text);
      const textWidth = metrics.width;
      const textHeight = fontSize; // 近似高度
      const padding = 16;

      let x, y;
      switch (position) {
        case 'top-left':
          x = padding;
          y = textHeight + padding;
          break;
        case 'top-right':
          x = videoWidth - textWidth - padding;
          y = textHeight + padding;
          break;
        case 'bottom-left':
          x = padding;
          y = videoHeight - padding;
          break;
        case 'bottom-right':
          x = videoWidth - textWidth - padding;
          y = videoHeight - padding;
          break;
        case 'center':
        default:
          x = (videoWidth - textWidth) / 2;
          y = videoHeight / 2;
          break;
      }

      // 半透明背景框
      const boxPadding = 8;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(
        x - boxPadding,
        y - textHeight - boxPadding + 4,
        textWidth + boxPadding * 2,
        textHeight + boxPadding * 2
      );

      // 绘制文字
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);

      // 导出为 PNG Blob
      canvas.toBlob((blob) => {
        const reader = new FileReader();
        reader.onload = () => resolve(new Uint8Array(reader.result));
        reader.readAsArrayBuffer(blob);
      }, 'image/png');
    });
  },

  async _handleWatermark() {
    const file = Upload.getFile();
    if (!file) {
      Status.toast('请先上传视频文件', 'warning');
      return;
    }

    const text = this._textInput.value;
    const fontSize = parseInt(this._fontSizeInput.value) || 24;
    const color = this._colorInput.value;
    const position = this._positionSelect.value;

    const error = this.validate(text);
    if (error) {
      Status.toast(error, 'error');
      Status.setState('invalid', error);
      return;
    }

    // 获取视频尺寸
    const video = document.getElementById('videoPlayer');
    const videoWidth = video.videoWidth || 1280;
    const videoHeight = video.videoHeight || 720;

    Status.startProcessing();

    try {
      const inputData = await Upload.getFileData();
      const ext = Utils.getFileExtension(file.name);
      const inputName = 'input_wm.' + ext;
      const wmName = 'watermark.png';
      const outputName = 'watermark-video.mp4';

      // 生成水印图片
      const wmData = await this._createWatermarkImage(
        text.trim(), fontSize, color, position, videoWidth, videoHeight
      );

      await ffmpegService.load();
      await ffmpegService.writeFile(inputName, inputData);
      await ffmpegService.writeFile(wmName, wmData);

      await ffmpegService.run([
        '-i', inputName,
        '-i', wmName,
        '-filter_complex', '[0:v][1:v]overlay=0:0',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'copy',
        '-movflags', '+faststart',
        '-y', outputName
      ]);

      const outputData = await ffmpegService.readFile(outputName);
      await ffmpegService.cleanup([inputName, wmName, outputName]);

      if (outputData.length < 1024) {
        throw new Error('水印处理输出文件异常（文件过小）');
      }

      const blob = new Blob([outputData], { type: 'video/mp4' });
      App.showResult(blob, 'video', 'watermark-video.mp4', {
        operation: 'watermark',
        params: { text: text.trim(), fontSize: fontSize, color: color, position: position }
      });
      Status.handleSuccess('水印添加完成');
    } catch (err) {
      Status.handleError(err, '水印添加失败，请重试');
    } finally {
      Status.endProcessing();
    }
  }
};
