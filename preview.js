// 视频预览模块

const Preview = {
  _video: null,
  _currentTimeEl: null,
  _totalDurationEl: null,
  _previewSection: null,

  // 预览区「设为开始/结束」按钮 → 当前功能标签的时间字段映射
  // 不在此表中的标签（音频/水印/滤镜/变换/转码/变速/音频调整）无时间点，按钮整组隐藏
  SEEK_TARGETS: {
    trim: {
      start: { field: 'trimStart', label: '设为开始', toast: '开始' },
      end: { field: 'trimEnd', label: '设为结束', toast: '结束' }
    },
    gif: {
      start: { field: 'gifStart', label: '设为开始', toast: '起始' },
      // GIF 没有"结束"，而是"时长" = 当前时间 - 起始时间
      end: { mode: 'duration', startField: 'gifStart', field: 'gifDuration', label: '设为结束' }
    },
    cover: {
      start: { field: 'coverTime', label: '设为此刻', toast: '截图时间' }
    }
  },

  init() {
    this._video = document.getElementById('videoPlayer');
    this._currentTimeEl = document.getElementById('currentTime');
    this._totalDurationEl = document.getElementById('totalDuration');
    this._previewSection = document.getElementById('previewSection');

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

    // 快捷设置：按当前功能标签映射到对应时间字段，点完留在原地（不跳转）
    var self = this;
    document.getElementById('setStartBtn').addEventListener('click', function () {
      self._applySeek('start');
    });
    document.getElementById('setEndBtn').addEventListener('click', function () {
      self._applySeek('end');
    });

    // 切换功能标签时，同步两个按钮的显示与文案
    document.querySelectorAll('.tab').forEach(function (tab) {
      tab.addEventListener('click', function () { self._syncSeekButtons(tab.dataset.tab); });
    });
    var initActive = document.querySelector('.tab.active');
    this._syncSeekButtons(initActive ? initActive.dataset.tab : 'trim');

    // 键盘快捷键
    document.addEventListener('keydown', function (e) {
      // 跳过输入框/文本域/选择框焦点时的快捷键
      var tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      // 跳过可编辑内容区域
      if (e.target.isContentEditable) return;
      // 跳过组合键（如 Ctrl+C）
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      var video = self._video;
      if (!video || !video.src) return;

      var cfg = self.SEEK_TARGETS[self._activeTab()];
      var isLeftBracket = e.code === 'BracketLeft' || e.key === '[' || e.key === '【';
      var isRightBracket = e.code === 'BracketRight' || e.key === ']' || e.key === '】';

      // Space: 播放/暂停
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (video.paused) video.play();
        else video.pause();
        return;
      }

      // [: 标记起始点
      if (isLeftBracket) {
        if (cfg && cfg.start) {
          e.preventDefault();
          self._applySeek('start');
        } else {
          Status.toast('当前功能不支持标记起始点，请切换到「裁剪」或「GIF」标签', 'warning');
        }
        return;
      }

      // ]: 标记结束点
      if (isRightBracket) {
        if (cfg && cfg.end) {
          e.preventDefault();
          self._applySeek('end');
        } else {
          Status.toast('当前功能不支持标记结束点，请切换到「裁剪」或「GIF」标签', 'warning');
        }
        return;
      }
    });
  },

  /** 当前激活的功能标签名 */
  _activeTab() {
    var t = document.querySelector('.tab.active');
    return t ? t.dataset.tab : null;
  },

  /** 把当前播放时间写入当前功能对应的起/止字段 */
  _applySeek(which) {
    var cfg = this.SEEK_TARGETS[this._activeTab()];
    if (!cfg || !cfg[which]) return;
    var spec = cfg[which];
    var t = this._video.currentTime;
    if (spec.mode === 'duration') {
      var start = parseFloat(document.getElementById(spec.startField).value) || 0;
      var dur = Math.max(0.1, Math.round((t - start) * 10) / 10);
      var durEl = document.getElementById(spec.field);
      durEl.value = dur;
      durEl.dispatchEvent(new Event('input', { bubbles: true }));
      Status.toast('已设为结束 ' + t.toFixed(1) + 's（时长 ' + dur + 's）', 'success');
    } else {
      var el = document.getElementById(spec.field);
      el.value = t.toFixed(1);
      // 派发 input 事件，让可视化裁剪滑块等监听者同步
      el.dispatchEvent(new Event('input', { bubbles: true }));
      Status.toast('已设为' + spec.toast + ' ' + t.toFixed(1) + 's', 'success');
    }
  },

  /** 根据功能标签同步预览区按钮：显示/隐藏 + 文案 */
  _syncSeekButtons(tabName) {
    var cfg = this.SEEK_TARGETS[tabName];
    var actions = document.querySelector('.preview-actions');
    var startBtn = document.getElementById('setStartBtn');
    var endBtn = document.getElementById('setEndBtn');
    if (!startBtn || !endBtn) return;
    if (!cfg) { if (actions) actions.style.display = 'none'; return; }
    if (actions) actions.style.display = '';
    if (cfg.start) { startBtn.style.display = ''; startBtn.textContent = cfg.start.label; }
    else { startBtn.style.display = 'none'; }
    if (cfg.end) { endBtn.style.display = ''; endBtn.textContent = cfg.end.label; }
    else { endBtn.style.display = 'none'; }
  },

  loadVideo(url) {
    this._video.src = url;
    this._previewSection.style.display = '';
  },

  reset() {
    this._video.src = '';
    this._currentTimeEl.textContent = '00:00';
    this._totalDurationEl.textContent = '00:00';
    this._previewSection.style.display = 'none';
  },

  getCurrentTime() {
    return this._video.currentTime;
  },

  getDuration() {
    return this._video.duration || 0;
  }
};
