// GIF 转换模块

const GifModule = {
  _startInput: null,
  _durationInput: null,
  _widthSelect: null,
  _fpsSelect: null,
  _btn: null,

  init() {
    this._startInput = document.getElementById('gifStart');
    this._durationInput = document.getElementById('gifDuration');
    this._widthSelect = document.getElementById('gifWidth');
    this._fpsSelect = document.getElementById('gifFps');
    this._btn = document.getElementById('gifBtn');

    this._btn.addEventListener('click', () => this._handleGif());
  },

  validate(start, duration, videoDuration) {
    if (isNaN(start)) return '请输入起始时间';
    if (isNaN(duration) || duration <= 0) return '请输入有效的持续时长';
    if (start < 0) return '起始时间不能小于 0';
    if (start + duration > videoDuration) return 'GIF 时长超过视频总时长';
    if (duration > 15) return 'GIF 时长不宜超过 15 秒';
    return null;
  },

  async _handleGif() {
    const file = Upload.getFile();
    if (!file) {
      Status.toast('请先上传视频文件', 'warning');
      return;
    }

    const start = parseFloat(this._startInput.value) || 0;
    const gifDur = parseFloat(this._durationInput.value) || 3;
    const width = parseInt(this._widthSelect.value);
    const fps = parseInt(this._fpsSelect.value);
    const videoDuration = Preview.getDuration();

    const error = this.validate(start, gifDur, videoDuration);
    if (error) {
      Status.toast(error, 'error');
      Status.setState('invalid', error);
      return;
    }

    Status.startProcessing();

    try {
      const inputData = await Upload.getFileData();
      const ext = Utils.getFileExtension(file.name);
      const inputName = 'input_gif.' + ext;
      const paletteName = 'palette.png';
      const outputName = 'output.gif';

      await ffmpegService.load();
      await ffmpegService.writeFile(inputName, inputData);

      // 第一遍：生成调色板
      await ffmpegService.run([
        '-ss', start.toString(),
        '-t', gifDur.toString(),
        '-i', inputName,
        '-vf', `fps=${fps},scale=${width}:-1:flags=lanczos,palettegen`,
        '-y', paletteName
      ]);

      // 第二遍：使用调色板生成 GIF
      await ffmpegService.run([
        '-ss', start.toString(),
        '-t', gifDur.toString(),
        '-i', inputName,
        '-i', paletteName,
        '-lavfi', `fps=${fps},scale=${width}:-1:flags=lanczos [x]; [x][1:v] paletteuse=dither=bayer`,
        '-y', outputName
      ]);

      const outputData = await ffmpegService.readFile(outputName);
      await ffmpegService.cleanup([inputName, paletteName, outputName]);

      const blob = new Blob([outputData], { type: 'image/gif' });
      App.showResult(blob, 'gif', 'output.gif');
      Status.handleSuccess('GIF 生成完成');
    } catch (err) {
      Status.handleError(err, 'GIF 生成失败，请重试');
    } finally {
      Status.endProcessing();
    }
  }
};
