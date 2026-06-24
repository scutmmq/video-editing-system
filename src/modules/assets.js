// 素材库模块（纯本地模式）
// 不上传云端，直接从本地选择文件，保存在内存中供快速载入工作流

const AssetsModule = {
  _files: [],         // 本地文件列表 [{id, file, name, kind, size, url, timestamp}]
  _gridEl: null,
  _countEl: null,
  _inputEl: null,
  _uploadBtn: null,

  init() {
    this._gridEl = document.getElementById('assetsGrid');
    this._countEl = document.getElementById('assetsCount');
    this._inputEl = document.getElementById('assetsUploadInput');
    this._uploadBtn = document.getElementById('assetsUploadBtn');

    // 绑定上传按钮
    this._bindUpload();

    // 监听视图切换：切换到素材库时刷新显示
    document.querySelectorAll('.view-tab[data-view="assets"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        AssetsModule._render();
      });
    });

    // 初始渲染（空列表）
    this._render();
  },

  _bindUpload() {
    var self = this;
    if (!this._uploadBtn || !this._inputEl) return;

    this._uploadBtn.addEventListener('click', function () {
      self._inputEl.click();
    });

    this._inputEl.addEventListener('change', function (e) {
      var files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      files.forEach(function (file) {
        self._addFile(file);
      });

      self._inputEl.value = '';
      if (window.Status) Status.toast('已添加 ' + files.length + ' 个素材', 'success');
      self._render();
    });
  },

  _addFile(file) {
    var kind = file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : file.type.startsWith('image/') ? 'image' : 'unknown';
    var asset = {
      id: (crypto.randomUUID ? crypto.randomUUID() : (Date.now() + '-' + Math.random().toString(36).slice(2, 10))),
      file: file,
      name: file.name,
      kind: kind,
      size: file.size,
      url: URL.createObjectURL(file),
      timestamp: Date.now(),
    };
    this._files.unshift(asset); // 新文件放最前面
  },

  _formatSize(bytes) {
    if (!bytes || bytes <= 0) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  },

  _esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  },

  _render() {
    if (!this._gridEl) return;

    if (this._countEl) this._countEl.textContent = this._files.length > 0 ? '共 ' + this._files.length + ' 个文件' : '';

    if (this._files.length === 0) {
      this._gridEl.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:48px 24px;color:var(--text-muted);font-size:14px;">暂无素材，点击上方「添加素材」按钮选择本地文件</div>';
      return;
    }

    var self = this;
    var rows = this._files.map(function (asset) {
      var name = self._esc(asset.name);
      var size = self._formatSize(asset.size);
      var typeLabel = { video: '视频', audio: '音频', image: '图片', unknown: '文件' }[asset.kind] || '文件';
      var typeClass = ['video', 'audio', 'image'].includes(asset.kind) ? asset.kind : 'unknown';
      var isVideo = asset.kind === 'video';

      var thumbHtml = '';
      if (asset.kind === 'image') {
        thumbHtml = '<img src="' + self._esc(asset.url) + '" alt="" loading="lazy">';
      } else if (asset.kind === 'video') {
        thumbHtml = '<video src="' + self._esc(asset.url) + '" preload="metadata" muted playsinline></video>';
      } else {
        thumbHtml = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--text-muted)"><rect x="2" y="4" width="20" height="16" rx="3"/><polygon points="10,8 16,12 10,16"/></svg>';
      }

      return '<div class="asset-item" data-asset-id="' + self._esc(asset.id) + '">' +
        '<div class="asset-thumb">' + thumbHtml +
          '<div class="asset-thumb-icon">' +
            '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/></svg>' +
          '</div>' +
        '</div>' +
        '<div class="asset-info">' +
          '<span class="asset-name" title="' + name + '">' + name + '</span>' +
          '<div class="asset-meta">' +
            '<span class="asset-type-badge ' + typeClass + '">' + typeLabel + '</span>' +
            '<span>' + size + '</span>' +
          '</div>' +
        '</div>' +
        '<button class="asset-delete-btn" title="移除" data-delete="' + self._esc(asset.id) + '">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
        '</button>' +
      '</div>';
    });

    this._gridEl.innerHTML = rows.join('');

    // 绑定点击事件：载入工作流
    this._gridEl.querySelectorAll('.asset-item').forEach(function (item) {
      item.addEventListener('click', function (e) {
        if (e.target.closest('.asset-delete-btn')) return;
        self._loadAsset(item.dataset.assetId);
      });
    });

    // 绑定删除按钮
    this._gridEl.querySelectorAll('.asset-delete-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        self._deleteAsset(btn.dataset.delete);
      });
    });
  },

  _loadAsset(assetId) {
    var asset = this._files.find(function (a) { return a.id === assetId; });
    if (!asset) return;

    if (asset.kind !== 'video') {
      if (window.Status) Status.toast('当前仅支持将视频素材载入工作流', 'warning');
      return;
    }

    try {
      if (window.Status) Status.toast('正在加载素材...', 'info');

      // 通过 Upload 模块载入
      if (typeof Upload !== 'undefined' && Upload.handleFile) {
        Upload.handleFile(asset.file);
      } else {
        document.dispatchEvent(new CustomEvent('video-uploaded', { detail: { url: asset.url, file: asset.file } }));
      }

      // 切换到处理视图
      if (typeof App !== 'undefined' && App.switchView) {
        App.switchView('process');
      }
      if (window.Status) Status.toast('素材已载入，可继续处理', 'success');
    } catch (err) {
      console.error('素材库：加载素材失败', err);
      if (window.Status) Status.toast('素材加载失败', 'error');
    }
  },

  _deleteAsset(assetId) {
    var idx = this._files.findIndex(function (a) { return a.id === assetId; });
    if (idx === -1) return;

    var asset = this._files[idx];
    if (asset.url) URL.revokeObjectURL(asset.url);
    this._files.splice(idx, 1);
    this._render();
    if (window.Status) Status.toast('已移除素材', 'success');
  },
};
