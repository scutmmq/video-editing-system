// 封面截取模块

const CoverModule = {
  _timeInput: null,
  _btn: null,

  init() {
    this._timeInput = document.getElementById('coverTime');
    this._btn = document.getElementById('coverBtn');

    this._btn.addEventListener('click', () => this._handleCover());

    document.querySelector('.tab[data-tab="cover"]').addEventListener('click', () => {
      if (!this._timeInput.value) {
        this._timeInput.value = Preview.getCurrentTime().toFixed(1);
      }
    });
  },

  validate(time, duration) {
    if (isNaN(time) || time === '') return '请输入截图时间点';
    if (time < 0) return '时间点不能小于 0';
    if (time > duration) return `时间点不能超过视频总时长（${Utils.formatTime(duration)}）`;
    return null;
  },

  async _handleCover() {
    const file = Upload.getFile();
    if (!file) {
      Status.toast('请先上传视频文件', 'warning');
      return;
    }

    const time = parseFloat(this._timeInput.value);
    const duration = Preview.getDuration();

    const error = this.validate(time, duration);
    if (error) {
      Status.toast(error, 'error');
      Status.setState('invalid', error);
      return;
    }

    Status.startProcessing();

    try {
      const inputData = await Upload.getFileData();
      const ext = Utils.getFileExtension(file.name);
      const inputName = 'input_cover.' + ext;
      const outputName = 'cover.png';

      const args = ['-ss', time.toString(), '-i', inputName, '-vframes', '1', '-q:v', '2', '-y', outputName];

      const outputData = await ffmpegService.process(inputName, inputData, args, outputName);
      const blob = new Blob([outputData], { type: 'image/png' });

      App.showResult(blob, 'image', 'cover.png');
      Status.handleSuccess('封面截取完成');
    } catch (err) {
      Status.handleError(err, '封面截取失败，请重试');
    } finally {
      Status.endProcessing();
    }
  }
};
