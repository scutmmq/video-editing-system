// 视频裁剪模块

const TrimModule = {
  _startInput: null,
  _endInput: null,
  _btn: null,

  init() {
    this._startInput = document.getElementById('trimStart');
    this._endInput = document.getElementById('trimEnd');
    this._btn = document.getElementById('trimBtn');

    this._btn.addEventListener('click', () => this._handleTrim());
  },

  validate(start, end, duration) {
    if (isNaN(start) || start === '') return '请输入开始时间';
    if (isNaN(end) || end === '') return '请输入结束时间';
    if (start < 0) return '开始时间不能小于 0';
    if (end > duration) return `结束时间不能超过视频总时长（${Utils.formatTime(duration)}）`;
    if (start >= end) return '开始时间必须小于结束时间';
    return null;
  },

  async _handleTrim() {
    const file = Upload.getFile();
    if (!file) {
      Status.toast('请先上传视频文件', 'warning');
      return;
    }

    const start = parseFloat(this._startInput.value);
    const end = parseFloat(this._endInput.value);
    const videoDuration = Preview.getDuration();

    const error = this.validate(start, end, videoDuration);
    if (error) {
      Status.toast(error, 'error');
      Status.setState('invalid', error);
      return;
    }

    Status.startProcessing();

    try {
      const inputData = await Upload.getFileData();
      const inputName = 'input_trim.' + Utils.getFileExtension(file.name);
      const outputName = 'clip-video.mp4';

      const clipDuration = end - start;
      const args = [
        '-ss', start.toString(),
        '-i', inputName,
        '-t', clipDuration.toString(),
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'aac',
        '-movflags', '+faststart',
        '-y', outputName
      ];

      const outputData = await ffmpegService.process(inputName, inputData, args, outputName);
      const blob = new Blob([outputData], { type: 'video/mp4' });

      App.showResult(blob, 'video', 'clip-video.mp4');
      Status.handleSuccess('视频裁剪完成');
    } catch (err) {
      Status.handleError(err, '视频裁剪失败，请重试');
    } finally {
      Status.endProcessing();
    }
  }
};
