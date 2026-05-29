// 状态提示模块

const Status = {
  states: {
    waiting: { text: '请先上传视频文件', cls: 'waiting' },
    uploaded: { text: '视频上传成功', cls: 'success' },
    processing: { text: '正在处理，请稍候...', cls: 'processing' },
    done: { text: '处理完成，可以预览或下载', cls: 'success' },
    error: { text: '处理失败，请重新尝试', cls: 'error' },
    invalid: { text: '', cls: 'error' },
  },

  _statusBar: null,
  _statusDot: null,
  _statusText: null,
  _progressContainer: null,
  _progressFill: null,
  _progressText: null,

  init() {
    this._statusBar = document.getElementById('statusBar');
    this._statusDot = document.getElementById('statusDot');
    this._statusText = document.getElementById('statusText');
    this._progressContainer = document.getElementById('progressContainer');
    this._progressFill = document.getElementById('progressFill');
    this._progressText = document.getElementById('progressText');

    document.addEventListener('ffmpeg-progress', (e) => {
      const percent = e.detail.percent;
      this._progressFill.style.width = percent + '%';
      this._progressText.textContent = `正在处理... ${percent}%`;
    });
  },

  setState(stateKey, customMsg) {
    const state = this.states[stateKey];
    if (!state) return;
    this._statusDot.className = 'status-dot ' + state.cls;
    this._statusText.textContent = customMsg || state.text;
  },

  showProgress(show) {
    this._progressContainer.style.display = show ? 'block' : 'none';
    if (show) {
      this._progressFill.style.width = '0%';
      this._progressText.textContent = '正在处理...';
    }
  },

  setButtonsEnabled(enabled) {
    document.querySelectorAll('.btn-primary, .btn-success').forEach(btn => {
      btn.disabled = !enabled;
    });
  },

  toast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = msg;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      z-index: 9999;
      animation: slideIn 0.3s ease;
      max-width: 360px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;

    const colors = {
      info: { bg: '#eef2ff', color: '#4338ca', border: '#c7d2fe' },
      error: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
      success: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
      warning: { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
    };

    const c = colors[type] || colors.info;
    toast.style.background = c.bg;
    toast.style.color = c.color;
    toast.style.border = '1px solid ' + c.border;

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  // 统一的错误处理
  handleError(err, fallbackMsg) {
    // 完整技术信息仅输出到控制台
    console.error('处理失败:', err);

    // 提取用户可读的错误消息
    let msg = fallbackMsg || '处理失败，请重试';
    if (err && err.message) {
      const techMsg = String(err.message);
      // FFmpeg.wasm 内部错误（如 Emscripten MEMFS 异常）对用户无意义，
      // 只保留对外暴露的友好 fallbackMsg
      if (
        techMsg.includes('startsWith') ||
        techMsg.includes('Cannot read properties') ||
        techMsg.includes('undefined') ||
        techMsg.includes('FFmpeg 退出码')
      ) {
        // 已包含退出码信息的 FFmpeg 错误可以直接展示
        if (techMsg.includes('FFmpeg 退出码')) {
          msg = techMsg;
        }
      } else {
        msg = techMsg;
      }
    }

    this.setState('error', msg);
    this.toast(msg, 'error');
  },

  // 统一的完成处理
  handleSuccess(successMsg) {
    this.setState('done');
    this.toast(successMsg, 'success');
  },

  // 开始处理
  startProcessing() {
    this.setState('processing');
    this.showProgress(true);
    this.setButtonsEnabled(false);
  },

  // 结束处理
  endProcessing() {
    this.showProgress(false);
    this.setButtonsEnabled(true);
  }
};
