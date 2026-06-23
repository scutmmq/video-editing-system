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

    this._initShortcuts();
  },

  /**
   * 全局键盘快捷键：
   *   空格 → 播放 / 暂停
   *   [    → 标记当前时间为「起始点」（按当前功能映射）
   *   ]    → 标记当前时间为「结束点」
   * 仅在预览区可见时生效；焦点位于输入控件时不拦截，避免输入文本时误触发。
   */
  _initShortcuts() {
    var self = this;
    document.addEventListener('keydown', function (e) {
      // 预览区未显示（没有加载视频）→ 不处理
      if (!self._previewSection || self._previewSection.style.display === 'none') return;

      // 焦点在输入框 / 文本域 / 下拉 / 可编辑元素时，交还给浏览器，避免误触发
      var el = document.activeElement;
      if (el) {
        var tag = el.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) return;
      }

      // 带修饰键的组合键（如复制粘贴）不处理
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key) {
        case ' ':
        case 'Spacebar': // 兼容旧版浏览器
          e.preventDefault(); // 阻止页面滚动，并避免与 <video> 原生空格行为重复触发
          if (self._video.paused) self._video.play();
          else self._video.pause();
          break;
        case '[':
          e.preventDefault();
          self._applySeek('start');
          break;
        case ']':
          e.preventDefault();
          self._applySeek('end');
          break;
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
