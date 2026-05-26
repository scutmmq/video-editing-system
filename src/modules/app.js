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
    GifModule.init();
    AudioModule.init();
    WatermarkModule.init();
    FilterModule.init();
    CoverModule.init();

    this._initSidebar();
    this._initDownload();

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
      cover: '截取封面'
    };
    var subtitles = {
      trim: '从视频中截取一段你需要的片段，保留你想要的部分。',
      gif: '将视频中的一段画面转换为 GIF 动图，适合制作表情包或演示动画。',
      audio: '从视频中提取音频，支持 MP3 和 WAV 两种常见格式。',
      watermark: '在视频上添加自定义文字水印，支持调整字体、颜色和位置。',
      filter: '为视频画面添加滤镜效果，选中后实时切换预览效果描述。',
      cover: '从视频指定时间点截取一帧画面，保存为 PNG 图片作为封面。'
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

  _initDownload: function () {
    var self = this;
    document.getElementById('downloadBtn').addEventListener('click', function () {
      if (self._currentResult) {
        self.download(self._currentResult, self._downloadFilename);
      }
    });
  },

  showResult: function (blob, type, filename) {
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
