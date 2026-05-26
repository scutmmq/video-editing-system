// 视频上传模块

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

    // 文件大小提醒
    if (Utils.isLargeFile(file, 500)) {
      Status.toast('视频文件较大，可能导致处理时间过长', 'warning');
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
