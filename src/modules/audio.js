// 音频提取模块

const AudioModule = {
  _formatSelect: null,
  _btn: null,

  init() {
    this._formatSelect = document.getElementById('audioFormat');
    this._btn = document.getElementById('audioBtn');

    this._btn.addEventListener('click', () => this._handleAudio());
  },

  async _handleAudio() {
    const file = Upload.getFile();
    if (!file) {
      Status.toast('请先上传视频文件', 'warning');
      return;
    }

    const format = this._formatSelect.value;
    Status.startProcessing();

    try {
      const inputData = await Upload.getFileData();
      const ext = Utils.getFileExtension(file.name);
      const inputName = 'input_audio.' + ext;
      const outputName = 'audio.' + format;

      let args;
      if (format === 'mp3') {
        args = ['-i', inputName, '-vn', '-acodec', 'libmp3lame', '-q:a', '2', '-y', outputName];
      } else {
        args = ['-i', inputName, '-vn', '-acodec', 'pcm_s16le', '-y', outputName];
      }

      const outputData = await ffmpegService.process(inputName, inputData, args, outputName);

      if (outputData.length < 1024) {
        throw new Error('当前视频不包含音频轨道');
      }

      const mimeType = format === 'mp3' ? 'audio/mpeg' : 'audio/wav';
      const blob = new Blob([outputData], { type: mimeType });

      App.showResult(blob, 'audio', 'audio.' + format, { operation: 'extract_audio', params: { format: format } });
      Status.handleSuccess('音频提取完成');
    } catch (err) {
      Status.handleError(err, '音频提取失败，请重试');
    } finally {
      Status.endProcessing();
    }
  }
};
