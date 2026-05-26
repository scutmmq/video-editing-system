// 主控制器模块

const App = {
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

    this._initTabs();
    this._initDownload();

    // 视频重置时清理结果
    document.addEventListener('video-reset', () => {
      this.clearResult();
    });

    // 预先加载 FFmpeg.wasm（首次操作时才真正加载会更流畅）
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

  _initTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        const panelId = 'panel-' + tab.dataset.tab;
        const panel = document.getElementById(panelId);
        if (panel) panel.classList.add('active');
      });
    });
  },

  _initDownload() {
    document.getElementById('downloadBtn').addEventListener('click', () => {
      if (this._currentResult) {
        this.download(this._currentResult, this._downloadFilename);
      }
    });
  },

  showResult(blob, type, filename) {
    this._currentResult = blob;
    this._resultType = type;
    this._downloadFilename = filename;

    const resultSection = document.getElementById('resultSection');
    const resultPreview = document.getElementById('resultPreview');
    const downloadBtn = document.getElementById('downloadBtn');

    resultSection.style.display = '';
    resultPreview.innerHTML = '';

    const url = URL.createObjectURL(blob);

    switch (type) {
      case 'video':
        resultPreview.innerHTML = `<video src="${url}" controls style="max-width:100%;max-height:400px;border-radius:8px;"></video>`;
        break;
      case 'gif':
      case 'image':
        resultPreview.innerHTML = `<img src="${url}" alt="处理结果" style="max-width:100%;max-height:400px;border-radius:8px;">`;
        break;
      case 'audio':
        resultPreview.innerHTML = `<audio src="${url}" controls style="width:100%;margin:16px 0;"></audio>`;
        break;
    }

    downloadBtn.style.display = '';
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },

  clearResult() {
    this._currentResult = null;
    this._resultType = null;
    this._downloadFilename = null;
    document.getElementById('resultSection').style.display = 'none';
    document.getElementById('downloadBtn').style.display = 'none';
    document.getElementById('resultPreview').innerHTML = '';
  },

  download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    Status.toast('文件下载已开始', 'success');
  }
};

// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
