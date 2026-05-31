// 主控制器模块

var App = {
  _currentResult: null,
  _resultType: null,
  _downloadFilename: null,

  async init() {
    Status.init();
    Upload.init();
    Preview.init();
    TrimModule.init();
    TrimRange.init();
    GifModule.init();
    AudioModule.init();
    WatermarkModule.init();
    FilterModule.init();
    CoverModule.init();
    TransformModule.init();
    TranscodeModule.init();
    SpeedModule.init();
    AudioAdjustModule.init();
    HistoryModule.init();

    this._initViewTabs();
    this._initSidebar();
    this._initDownload();
    this._initCancel();

    // 视频重置时清理结果
    document.addEventListener('video-reset', function () {
      App.clearResult();
    });

    // 预先加载 FFmpeg.wasm
    Status.setState('waiting');
    try {
      await ffmpegService.load();
      Status.setState('waiting');
      console.log('视频剪辑系统初始化完成，FFmpeg.wasm 已就绪');
    } catch (err) {
      Status.setState('error', '处理引擎加载失败，请检查网络后刷新页面');
      Status.toast('视频处理引擎加载失败，请检查网络连接', 'error');
      console.error('预加载 FFmpeg.wasm 失败:', err);
    }
  },

  _initSidebar: function () {
    var tabs = document.querySelectorAll('.tab');
    var titles = {
      trim: '视频裁剪',
      gif: 'GIF 转换',
      audio: '音频提取',
      watermark: '文字水印',
      filter: '视频滤镜',
      cover: '截取封面',
      transform: '画面变换',
      transcode: '压缩转码',
      speed: '播放速度',
      audioadj: '音频调整'
    };
    var subtitles = {
      trim: '从视频中截取一段你需要的片段，保留你想要的部分。',
      gif: '将视频中的一段画面转换为 GIF 动图，适合制作表情包或演示动画。',
      audio: '从视频中提取音频，支持 MP3 和 WAV 两种常见格式。',
      watermark: '在视频上添加自定义文字水印，支持调整字体、颜色和位置。',
      filter: '为视频画面添加滤镜效果，选中后实时切换预览效果描述。',
      cover: '从视频指定时间点截取一帧画面，保存为 PNG 图片作为封面。',
      transform: '旋转、翻转、缩放画面，或适配横屏 / 竖屏比例。',
      transcode: '转换输出格式与分辨率，并按质量等级压缩视频体积。',
      speed: '加速或减速播放，也可将短视频整段倒放。',
      audioadj: '静音、调整音量，或为音频添加淡入淡出效果。'
    };

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');

        document.querySelectorAll('.tab-panel').forEach(function (p) {
          p.classList.remove('active');
        });
        var panelId = 'panel-' + tab.dataset.tab;
        var panel = document.getElementById(panelId);
        if (panel) panel.classList.add('active');

        var titleEl = document.getElementById('panelTitle');
        var subEl = document.getElementById('panelSubtitle');
        if (titleEl) titleEl.textContent = titles[tab.dataset.tab] || '';
        if (subEl) subEl.textContent = subtitles[tab.dataset.tab] || '';
      });
    });
  },

  _initViewTabs: function () {
    var viewTabs = document.querySelectorAll('.view-tab');
    var viewPanels = document.querySelectorAll('.view-panel');

    viewTabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var viewName = tab.dataset.view;
        if (!viewName) return;

        // 切换 tab 激活状态
        viewTabs.forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');

        // 切换视图面板
        viewPanels.forEach(function (p) { p.classList.remove('active'); });
        var panel = document.getElementById('view' + viewName.charAt(0).toUpperCase() + viewName.slice(1));
        if (panel) panel.classList.add('active');

        // 切换到历史视图时自动刷新
        if (viewName === 'history' && HistoryModule._enabled) {
          HistoryModule._refresh();
        }
      });
    });
  },

  /** 编程式切换到指定视图 */
  switchView: function (viewName) {
    var tab = document.querySelector('.view-tab[data-view="' + viewName + '"]');
    if (tab) tab.click();
  },

  _initDownload: function () {
    var self = this;
    document.getElementById('downloadBtn').addEventListener('click', function () {
      if (self._currentResult) {
        self.download(self._currentResult, self._downloadFilename);
      }
    });
  },

  _initCancel: function () {
    var btn = document.getElementById('cancelBtn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      // 终止 worker：进行中的处理会 reject，由各模块 catch → Status 显示"已取消"
      if (typeof ffmpegService !== 'undefined') ffmpegService.cancel();
      Status.toast('正在取消…', 'info');
    });
  },

  showResult: function (blob, type, filename, meta) {
    this._currentResult = blob;
    this._resultType = type;
    this._downloadFilename = filename;

    var resultSection = document.getElementById('resultSection');
    var resultPreview = document.getElementById('resultPreview');
    var downloadBtn = document.getElementById('downloadBtn');

    resultSection.style.display = '';
    resultPreview.innerHTML = '';

    var url = URL.createObjectURL(blob);

    switch (type) {
      case 'video':
        resultPreview.innerHTML = '<video src="' + url + '" controls style="max-width:100%;max-height:400px;border-radius:8px;"></video>';
        break;
      case 'gif':
      case 'image':
        resultPreview.innerHTML = '<img src="' + url + '" alt="处理结果" style="max-width:100%;max-height:400px;border-radius:8px;">';
        break;
      case 'audio':
        resultPreview.innerHTML = '<audio src="' + url + '" controls style="width:100%;margin:16px 0;"></audio>';
        break;
    }

    downloadBtn.style.display = '';
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // 通知历史模块持久化（meta 含 operation / params；无 meta 时历史模块会忽略）
    document.dispatchEvent(new CustomEvent('result-ready', {
      detail: { blob: blob, type: type, filename: filename, meta: meta || null }
    }));
  },

  clearResult: function () {
    this._currentResult = null;
    this._resultType = null;
    this._downloadFilename = null;
    document.getElementById('resultSection').style.display = 'none';
    document.getElementById('downloadBtn').style.display = 'none';
    document.getElementById('resultPreview').innerHTML = '';
  },

  download: function (blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    Status.toast('文件下载已开始', 'success');
  }
};

// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', function () {
  App.init();
});
