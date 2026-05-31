// 可视化裁剪范围选择器：在时间轴上拖动两个手柄选择起止，与 trimStart/trimEnd 双向同步

const TrimRange = {
  _trimmer: null,
  _track: null,
  _selected: null,
  _hStart: null,
  _hEnd: null,
  _startLabel: null,
  _endLabel: null,
  _startInput: null,
  _endInput: null,
  _duration: 0,

  init() {
    this._trimmer = document.getElementById('rangeTrimmer');
    this._track = document.getElementById('rangeTrack');
    this._selected = document.getElementById('rangeSelected');
    this._hStart = document.getElementById('rangeHandleStart');
    this._hEnd = document.getElementById('rangeHandleEnd');
    this._startLabel = document.getElementById('rangeStartLabel');
    this._endLabel = document.getElementById('rangeEndLabel');
    this._startInput = document.getElementById('trimStart');
    this._endInput = document.getElementById('trimEnd');
    if (!this._track) return;

    var self = this;
    var video = document.getElementById('videoPlayer');

    // 视频加载完成 → 用总时长初始化范围（默认整段）
    if (video) {
      video.addEventListener('loadedmetadata', function () {
        self._duration = video.duration || 0;
        if (self._duration > 0) {
          self._trimmer.style.display = '';
          self._setRange(0, self._duration);
        }
      });
    }

    // 视频重置 → 隐藏并清零
    document.addEventListener('video-reset', function () {
      self._duration = 0;
      self._trimmer.style.display = 'none';
    });

    // 数字输入框变化 → 同步滑块（含"设为开始/结束"按钮派发的 input 事件）
    this._startInput.addEventListener('input', function () { self._renderFromInputs(); });
    this._endInput.addEventListener('input', function () { self._renderFromInputs(); });

    // 拖拽两个手柄
    this._bindDrag(this._hStart, 'start');
    this._bindDrag(this._hEnd, 'end');
  },

  _bindDrag(handle, which) {
    var self = this;
    handle.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      function move(ev) { self._onDrag(ev.clientX, which); }
      function up() {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
      }
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
    });
  },

  _onDrag(clientX, which) {
    if (this._duration <= 0) return;
    var rect = this._track.getBoundingClientRect();
    var ratio = (clientX - rect.left) / rect.width;
    ratio = Math.max(0, Math.min(1, ratio));
    var t = Math.round(ratio * this._duration * 10) / 10;

    var start = parseFloat(this._startInput.value) || 0;
    var end = parseFloat(this._endInput.value);
    if (isNaN(end)) end = this._duration;

    if (which === 'start') {
      start = Math.max(0, Math.min(t, end - 0.1));
    } else {
      end = Math.min(this._duration, Math.max(t, start + 0.1));
    }
    this._setRange(start, end);
  },

  // 写回输入框并重绘
  _setRange(start, end) {
    this._startInput.value = start.toFixed(1);
    this._endInput.value = end.toFixed(1);
    this._render(start, end);
  },

  // 仅根据输入框当前值重绘（不回写，避免循环）
  _renderFromInputs() {
    var start = parseFloat(this._startInput.value) || 0;
    var end = parseFloat(this._endInput.value);
    if (isNaN(end)) end = this._duration;
    this._render(start, end);
  },

  _render(start, end) {
    var dur = this._duration || 0;
    var sp = dur > 0 ? (start / dur * 100) : 0;
    var ep = dur > 0 ? (end / dur * 100) : 100;
    sp = Math.max(0, Math.min(100, sp));
    ep = Math.max(0, Math.min(100, ep));
    this._hStart.style.left = sp + '%';
    this._hEnd.style.left = ep + '%';
    this._selected.style.left = sp + '%';
    this._selected.style.width = Math.max(0, ep - sp) + '%';
    this._startLabel.textContent = start.toFixed(1) + 's';
    this._endLabel.textContent = end.toFixed(1) + 's';
  }
};
