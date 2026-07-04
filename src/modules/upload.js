// 视频上传模块

function analyzeVideoRisk(meta) {
  const m = meta || {};
  const width = Number(m.width) || 0;
  const height = Number(m.height) || 0;
  const duration = Number(m.duration) || 0;
  const reasons = [];

  if (width >= 3840 || height >= 2160) {
    reasons.push('ultra_high_resolution');
  } else if (width >= 2560 || height >= 1440) {
    reasons.push('high_resolution');
  }

  if (duration >= 1800) {
    reasons.push('very_long_duration');
  } else if (duration >= 600) {
    reasons.push('long_duration');
  }

  if (reasons.length === 0) return null;

  const parts = [];
  if (reasons.includes('ultra_high_resolution')) {
    parts.push('4K/超高分辨率');
  } else if (reasons.includes('high_resolution')) {
    parts.push('高分辨率');
  }
  if (reasons.includes('very_long_duration')) {
    parts.push('超长时长');
  } else if (reasons.includes('long_duration')) {
    parts.push('长时长');
  }

  return {
    level: 'warning',
    reasons,
    message: '检测到' + parts.join('、') + '视频，浏览器端处理可能较慢，请耐心等待。'
  };
}

const Upload = {
  _fileInput: null,
  _uploadArea: null,
  _fileInfo: null,
  _currentFile: null,
  _objectURL: null,

  init() {
    this._fileInput = document.getElementById('fileInput');
    this._uploadArea = document.getElementById('uploadArea');
    this._fileInfo = document.getElementById('fileInfo');

    // 点击上传区域
    this._uploadArea.addEventListener('click', () => {
      this._fileInput.click();
    });

    // 文件选择
    this._fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.handleFile(e.target.files[0]);
      }
    });

    // 拖拽上传
    this._uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      this._uploadArea.classList.add('drag-over');
    });

    this._uploadArea.addEventListener('dragleave', () => {
      this._uploadArea.classList.remove('drag-over');
    });

    this._uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      this._uploadArea.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) this.handleFile(file);
    });

    // 重新上传
    document.getElementById('reuploadBtn').addEventListener('click', () => {
      this.reset();
      this._fileInput.click();
    });
  },

  handleFile(file) {
    // 验证文件类型
    if (!Utils.isValidVideoFile(file)) {
      Status.toast('当前文件格式不支持，请上传视频文件', 'error');
      Status.setState('error', '文件格式不支持');
      return;
    }

    // 大文件硬拦截：超过上限直接拒绝，避免浏览器端 FFmpeg.wasm 内存溢出导致整页崩溃
    var HARD_LIMIT_MB = 300;
    var SOFT_LIMIT_MB = 100;
    if (Utils.isLargeFile(file, HARD_LIMIT_MB)) {
      Status.toast('文件超过 ' + HARD_LIMIT_MB + 'MB，浏览器端无法稳定处理（易内存溢出）。请先压缩或裁剪后再上传。', 'error');
      Status.setState('error', '文件过大（>' + HARD_LIMIT_MB + 'MB），已拒绝');
      return;
    }
    if (Utils.isLargeFile(file, SOFT_LIMIT_MB)) {
      Status.toast('视频文件较大，处理可能较慢，手机端尤其明显', 'warning');
    }

    this._currentFile = file;

    // 释放之前的 ObjectURL
    if (this._objectURL) {
      URL.revokeObjectURL(this._objectURL);
    }
    this._objectURL = URL.createObjectURL(file);

    // 显示文件信息
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileSize').textContent = Utils.formatFileSize(file.size);
    document.getElementById('fileFormat').textContent = Utils.getFileExtension(file.name).toUpperCase();

    this._uploadArea.style.display = 'none';
    this._fileInfo.style.display = 'block';

    Status.setState('uploaded');

    // 触发视频加载
    document.dispatchEvent(new CustomEvent('video-uploaded', {
      detail: { file, url: this._objectURL }
    }));

    this._warnForVideoMetadata(this._objectURL);
  },

  _warnForVideoMetadata(url) {
    this._readVideoMetadata(url)
      .then((meta) => {
        if (url !== this._objectURL) return;
        const risk = analyzeVideoRisk(meta);
        if (risk) Status.toast(risk.message, risk.level);
      })
      .catch((err) => {
        console.warn('读取视频元数据失败，跳过分辨率/时长预警:', err);
      });
  },

  _readVideoMetadata(url) {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      let done = false;
      let timer = null;

      function cleanup() {
        if (timer) clearTimeout(timer);
        video.removeAttribute('src');
        video.load();
      }

      function finish(fn, value) {
        if (done) return;
        done = true;
        cleanup();
        fn(value);
      }

      video.preload = 'metadata';
      video.muted = true;
      video.onloadedmetadata = () => {
        finish(resolve, {
          width: video.videoWidth,
          height: video.videoHeight,
          duration: Number.isFinite(video.duration) ? video.duration : 0
        });
      };
      video.onerror = () => {
        finish(reject, new Error('metadata load failed'));
      };
      timer = setTimeout(() => {
        finish(reject, new Error('metadata load timeout'));
      }, 5000);
      video.src = url;
    });
  },

  reset() {
    if (this._objectURL) {
      URL.revokeObjectURL(this._objectURL);
      this._objectURL = null;
    }
    this._currentFile = null;
    this._uploadArea.style.display = '';
    this._fileInfo.style.display = 'none';
    document.getElementById('fileName').textContent = '';
    document.getElementById('fileSize').textContent = '';
    document.getElementById('fileFormat').textContent = '';

    // 重置文件选择器
    this._fileInput.value = '';

    Status.setState('waiting');
    Status.showProgress(false);

    // 通知其他模块重置
    document.dispatchEvent(new CustomEvent('video-reset'));
  },

  getFile() {
    return this._currentFile;
  },

  getObjectURL() {
    return this._objectURL;
  },

  getFileData() {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result));
      reader.onerror = reject;
      reader.readAsArrayBuffer(this._currentFile);
    });
  }
};

if (typeof module === 'object' && module.exports) {
  module.exports = {
    analyzeVideoRisk
  };
}
