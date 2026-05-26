// 视频预览模块

const Preview = {
  _video: null,
  _currentTimeEl: null,
  _totalDurationEl: null,
  _previewSection: null,
  _toolsSection: null,

  init() {
    this._video = document.getElementById('videoPlayer');
    this._currentTimeEl = document.getElementById('currentTime');
    this._totalDurationEl = document.getElementById('totalDuration');
    this._previewSection = document.getElementById('previewSection');
    this._toolsSection = document.getElementById('toolsSection');

    // 视频上传事件
    document.addEventListener('video-uploaded', (e) => {
      this.loadVideo(e.detail.url);
    });

    // 视频重置事件
    document.addEventListener('video-reset', () => {
      this.reset();
    });

    // 时间更新
    this._video.addEventListener('timeupdate', () => {
      this._currentTimeEl.textContent = Utils.formatTime(this._video.currentTime);
    });

    // 视频加载完成后获取时长
    this._video.addEventListener('loadedmetadata', () => {
      this._totalDurationEl.textContent = Utils.formatTime(this._video.duration);
    });

    // 快捷设置裁剪时间
    document.getElementById('setStartBtn').addEventListener('click', () => {
      document.getElementById('trimStart').value = this._video.currentTime.toFixed(1);
      document.getElementById('gifStart').value = this._video.currentTime.toFixed(1);
      // 切换到裁剪标签
      document.querySelector('.tab[data-tab="trim"]').click();
    });

    document.getElementById('setEndBtn').addEventListener('click', () => {
      document.getElementById('trimEnd').value = this._video.currentTime.toFixed(1);
      // 切换到裁剪标签
      document.querySelector('.tab[data-tab="trim"]').click();
    });
  },

  loadVideo(url) {
    this._video.src = url;
    this._previewSection.style.display = '';
    this._toolsSection.style.display = '';
  },

  reset() {
    this._video.src = '';
    this._currentTimeEl.textContent = '00:00';
    this._totalDurationEl.textContent = '00:00';
    this._previewSection.style.display = 'none';
    this._toolsSection.style.display = 'none';
  },

  getCurrentTime() {
    return this._video.currentTime;
  },

  getDuration() {
    return this._video.duration || 0;
  }
};
