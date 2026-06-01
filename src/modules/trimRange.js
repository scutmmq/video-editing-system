// 可视化范围选择器：时间轴上拖动两个手柄选择起止，与输入框双向同步
// 支持两种模式：
//   end      —— 裁剪：起始/结束两个绝对时间（trimStart / trimEnd）
//   duration —— GIF：起始 + 时长（gifStart / gifDuration，结束 = 起始 + 时长）

const TrimRange = {
  _video: null,
  _duration: 0,
  _instances: [],

  CONFIGS: [
    {
      wrap: 'rangeTrimmer', track: 'rangeTrack', selected: 'rangeSelected',
      hStart: 'rangeHandleStart', hEnd: 'rangeHandleEnd',
      startLabel: 'rangeStartLabel', endLabel: 'rangeEndLabel',
      startField: 'trimStart', endField: 'trimEnd', mode: 'end'
    },
    {
      wrap: 'gifTrimmer', track: 'gifRangeTrack', selected: 'gifRangeSelected',
      hStart: 'gifHandleStart', hEnd: 'gifHandleEnd',
      startLabel: 'gifStartLabel', endLabel: 'gifEndLabel',
      startField: 'gifStart', endField: 'gifDuration', mode: 'duration', maxSpan: 15
    }
  ],

  init() {
    this._video = document.getElementById('videoPlayer');
    var self = this;
    this._instances = [];
    this.CONFIGS.forEach(function (cfg) {
      var inst = self._build(cfg);
      if (inst) self._instances.push(inst);
    });

    if (this._video) {
      this._video.addEventListener('loadedmetadata', function () {
        self._duration = self._video.duration || 0;
        self._instances.forEach(function (i) { i.onDuration(); });
      });
    }
    document.addEventListener('video-reset', function () {
      self._duration = 0;
      self._instances.forEach(function (i) { i.wrap.style.display = 'none'; });
    });
  },

  _build(cfg) {
    var self = this;
    var els = {
      wrap: document.getElementById(cfg.wrap),
      track: document.getElementById(cfg.track),
      selected: document.getElementById(cfg.selected),
      hStart: document.getElementById(cfg.hStart),
      hEnd: document.getElementById(cfg.hEnd),
      startLabel: document.getElementById(cfg.startLabel),
      endLabel: document.getElementById(cfg.endLabel),
      startInput: document.getElementById(cfg.startField),
      endInput: document.getElementById(cfg.endField)
    };
    if (!els.track || !els.startInput || !els.endInput) return null;

    function readStart() { return parseFloat(els.startInput.value) || 0; }
    function readEnd() {
      if (cfg.mode === 'duration') {
        var d = parseFloat(els.endInput.value);
        return readStart() + (isNaN(d) ? 0 : d);
      }
      var e = parseFloat(els.endInput.value);
      return isNaN(e) ? self._duration : e;
    }

    function render(start, end) {
      var dur = self._duration || 0;
      var sp = dur > 0 ? (start / dur * 100) : 0;
      var ep = dur > 0 ? (end / dur * 100) : 0;
      sp = Math.max(0, Math.min(100, sp));
      ep = Math.max(0, Math.min(100, ep));
      els.hStart.style.left = sp + '%';
      els.hEnd.style.left = ep + '%';
      els.selected.style.left = sp + '%';
      els.selected.style.width = Math.max(0, ep - sp) + '%';
      els.startLabel.textContent = start.toFixed(1) + 's';
      els.endLabel.textContent = end.toFixed(1) + 's';
    }

    // 写回输入框（按模式）并重绘
    function setRange(start, end) {
      els.startInput.value = start.toFixed(1);
      if (cfg.mode === 'duration') {
        els.endInput.value = (Math.round((end - start) * 10) / 10).toFixed(1);
      } else {
        els.endInput.value = end.toFixed(1);
      }
      render(start, end);
    }

    function renderFromInputs() { render(readStart(), readEnd()); }

    function onDrag(clientX, which) {
      if (self._duration <= 0) return;
      var rect = els.track.getBoundingClientRect();
      var ratio = (clientX - rect.left) / rect.width;
      ratio = Math.max(0, Math.min(1, ratio));
      var t = Math.round(ratio * self._duration * 10) / 10;
      var start = readStart();
      var end = readEnd();
      if (which === 'start') {
        start = Math.max(0, Math.min(t, end - 0.1));
      } else {
        end = Math.min(self._duration, Math.max(t, start + 0.1));
        if (cfg.maxSpan && end - start > cfg.maxSpan) end = start + cfg.maxSpan;
      }
      setRange(start, end);
    }

    function bindDrag(handle, which) {
      handle.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        function move(ev) { onDrag(ev.clientX, which); }
        function up() {
          document.removeEventListener('pointermove', move);
          document.removeEventListener('pointerup', up);
        }
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', up);
      });
    }

    els.startInput.addEventListener('input', renderFromInputs);
    els.endInput.addEventListener('input', renderFromInputs);
    bindDrag(els.hStart, 'start');
    bindDrag(els.hEnd, 'end');

    return {
      wrap: els.wrap,
      onDuration: function () {
        if (self._duration <= 0) return;
        if (els.wrap) els.wrap.style.display = '';
        if (cfg.mode === 'duration') {
          // GIF：默认 [0, min(已填时长或3秒, 总时长, 上限)]
          var d = parseFloat(els.endInput.value);
          if (isNaN(d) || d <= 0) d = 3;
          if (cfg.maxSpan) d = Math.min(d, cfg.maxSpan);
          setRange(0, Math.min(self._duration, d));
        } else {
          setRange(0, self._duration);
        }
      }
    };
  }
};
