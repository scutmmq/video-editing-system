// 素材库模块（永久保存）
// - 登录 + Supabase 已配置：源视频上传到 media-originals 桶（kind=source_video）并写入 media_assets，跨设备永久保存。
// - 未登录 / 未配置：保存到本地 IndexedDB（VideoEditingAssetsDB），刷新/重启浏览器不丢失。
// 说明：云端素材库当前仅持久化「视频」源素材（媒体桶仅允许视频 MIME，且素材库只支持将视频载入工作流）；
//       本地模式下视频 / 音频 / 图片都会被保存。

const AssetsModule = {
  _gridEl: null,
  _countEl: null,
  _inputEl: null,
  _uploadBtn: null,

  _cloud: false,        // true = 云端模式
  _client: null,
  _services: null,
  _userId: null,
  _projectId: null,

  _db: null,            // 本地模式 IndexedDB 实例
  _items: [],           // 当前渲染的素材（已归一化）
  _urls: [],            // 本地缩略图 objectURL，重渲染时回收

  HARD_LIMIT_MB: 300,        // 超过则拒绝（防止内存溢出 / 超长上传）
  SOFT_LIMIT_MB: 100,        // 超过则提示较慢
  UPLOAD_TIMEOUT_MS: 120000, // 单次云端上传超时兜底（网络卡住时恢复界面）

  async init() {
    this._gridEl = document.getElementById('assetsGrid');
    this._countEl = document.getElementById('assetsCount');
    this._inputEl = document.getElementById('assetsUploadInput');
    this._uploadBtn = document.getElementById('assetsUploadBtn');

    this._bindUpload();

    // 切换到素材库视图时刷新
    document.querySelectorAll('.view-tab[data-view="assets"]').forEach((btn) => {
      btn.addEventListener('click', () => { this._refresh(); });
    });

    await this._detectMode();
    await this._refresh();
  },

  // ========== 模式判定 ==========

  async _detectMode() {
    try {
      const state = window.VideoEditingSupabase;
      if (state && state.isConfigured && state.client) {
        this._client = state.client;
        const { data, error } = await this._client.auth.getUser();
        if (!error && data && data.user) {
          this._userId = data.user.id;
          this._services = {
            storage: StorageService.createStorageService(this._client),
            project: ProjectService.createProjectService(this._client),
            asset: AssetService.createAssetService(this._client),
          };
          this._cloud = true;
          return;
        }
      }
    } catch (err) {
      console.warn('素材库：云端模式不可用，回退本地存储', err);
    }
    this._cloud = false;
    try { await this._initLocalDB(); } catch (e) { console.warn('素材库：IndexedDB 初始化失败', e); this._db = null; }
  },

  async _ensureProject() {
    if (this._projectId) return this._projectId;
    const project = await this._services.project.getOrCreateDefaultProject(this._userId);
    this._projectId = project.id;
    return this._projectId;
  },

  _uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  },

  // ========== 本地 IndexedDB ==========

  async _initLocalDB() {
    if (!window.indexedDB) { this._db = null; return; }
    this._db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('VideoEditingAssetsDB', 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('library')) {
          db.createObjectStore('library', { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  _idbTx(mode) {
    return this._db.transaction('library', mode).objectStore('library');
  },

  _saveLocal(record) {
    return new Promise((resolve, reject) => {
      const req = this._idbTx('readwrite').put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  _getAllLocal() {
    return new Promise((resolve, reject) => {
      const req = this._idbTx('readonly').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  _getLocal(id) {
    return new Promise((resolve, reject) => {
      const req = this._idbTx('readonly').get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },

  _deleteLocal(id) {
    return new Promise((resolve, reject) => {
      const req = this._idbTx('readwrite').delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  // ========== 上传 ==========

  _bindUpload() {
    if (!this._uploadBtn || !this._inputEl) return;

    this._uploadBtn.addEventListener('click', () => { this._inputEl.click(); });

    this._inputEl.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      this._inputEl.value = '';
      if (files.length === 0) return;

      this._uploadBtn.disabled = true;
      let added = 0, skipped = 0, failed = 0, tooLarge = 0, big = 0;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // 大小上限：与主编辑区一致，超限直接拒绝
        if (this._isLarger(file, this.HARD_LIMIT_MB)) { tooLarge += 1; continue; }
        if (this._isLarger(file, this.SOFT_LIMIT_MB)) big += 1;

        this._setProgress('正在' + (this._cloud ? '上传' : '保存') + ' ' + (i + 1) + '/' + files.length + '…');
        try {
          const ok = await this._addFile(file);
          if (ok) added += 1; else skipped += 1;
        } catch (err) {
          console.error('素材库：保存素材失败', file && file.name, err);
          failed += 1;
        }
      }
      this._uploadBtn.disabled = false;

      if (window.Status) {
        if (added) Status.toast('已保存 ' + added + ' 个素材' + (this._cloud ? '到云端' : '到本地'), 'success');
        if (big) Status.toast('有较大文件（>' + this.SOFT_LIMIT_MB + 'MB），上传/处理可能较慢', 'warning');
        if (skipped) Status.toast('已忽略 ' + skipped + ' 个非视频文件（云端素材库仅支持视频）', 'warning');
        if (tooLarge) Status.toast('已忽略 ' + tooLarge + ' 个超过 ' + this.HARD_LIMIT_MB + 'MB 的文件', 'warning');
        if (failed) Status.toast(failed + ' 个素材保存失败（可能网络超时），请稍后重试', 'error');
      }
      await this._refresh(); // _render 会重置 count，覆盖进度文本
    });
  },

  _isLarger(file, mb) {
    if (window.Utils && typeof Utils.isLargeFile === 'function') return Utils.isLargeFile(file, mb);
    return file && file.size > mb * 1024 * 1024;
  },

  _setProgress(text) {
    if (this._countEl) this._countEl.textContent = text || '';
  },

  // 超时兜底：底层网络请求无法真正取消，但能让界面从置灰假死中恢复并报错
  _withTimeout(promise, label) {
    let timer;
    const timeout = new Promise((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error((label || '操作') + '超时（网络较慢，请稍后重试）')), this.UPLOAD_TIMEOUT_MS);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  },

  _kindOf(file) {
    const t = file.type || '';
    if (t.startsWith('video/')) return 'video';
    if (t.startsWith('audio/')) return 'audio';
    if (t.startsWith('image/')) return 'image';
    return 'unknown';
  },

  // 返回 true=已保存，false=被忽略（如云端仅支持视频）
  async _addFile(file) {
    const kind = this._kindOf(file);

    if (this._cloud) {
      if (kind !== 'video') return false; // 媒体桶仅允许视频 MIME
      const assetId = this._uuid();
      const projectId = await this._withTimeout(this._ensureProject(), '获取项目');
      const path = HistoryMeta.buildStoragePath(this._userId, projectId, assetId, file.name);
      await this._withTimeout(
        this._services.storage.uploadResult('media-originals', path, file, file.type),
        '上传文件'
      );
      await this._withTimeout(
        this._services.asset.insertResultAsset({
          id: assetId,
          projectId,
          ownerId: this._userId,
          kind: 'source_video',
          bucket: 'media-originals',
          storagePath: path,
          originalFilename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        }),
        '写入素材记录'
      );
      return true;
    }

    // 本地模式：存 IndexedDB（直接存 File/Blob）
    if (!this._db) throw new Error('本地存储不可用');
    await this._saveLocal({
      id: this._uuid(),
      name: file.name,
      kind: kind,
      mime_type: file.type,
      size: file.size,
      blob: file,
      timestamp: Date.now(),
    });
    return true;
  },

  // ========== 列表 ==========

  async _refresh() {
    let items = [];
    try {
      if (this._cloud) {
        const rows = await this._services.asset.listAssetsByOwner(this._userId, { kind: 'source_video' });
        items = rows.map((r) => ({
          id: r.id,
          name: r.original_filename || '未命名素材',
          kind: 'video',
          size: r.size_bytes,
          cloud: true,
          bucket: r.bucket,
          storage_path: r.storage_path,
          mime_type: r.mime_type,
        }));
      } else if (this._db) {
        const rows = await this._getAllLocal();
        rows.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        items = rows.map((r) => ({
          id: r.id,
          name: r.name,
          kind: r.kind,
          size: r.size,
          cloud: false,
          mime_type: r.mime_type,
          blob: r.blob,
        }));
      }
    } catch (err) {
      console.error('素材库：加载列表失败', err);
      if (window.Status) Status.toast('素材库加载失败，请稍后重试', 'error');
    }
    this._items = items;
    this._render();
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

  _revokeUrls() {
    this._urls.forEach((u) => { try { URL.revokeObjectURL(u); } catch (e) { /* ignore */ } });
    this._urls = [];
  },

  _render() {
    if (!this._gridEl) return;
    this._revokeUrls();

    const items = this._items;
    if (this._countEl) this._countEl.textContent = items.length > 0 ? '共 ' + items.length + ' 个文件' : '';

    if (items.length === 0) {
      const tip = this._cloud
        ? '暂无素材，点击上方「添加素材」上传视频，将永久保存到云端素材库。'
        : '暂无素材，点击上方「添加素材」选择本地文件，将保存到本地（刷新不丢失）。';
      this._gridEl.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:48px 24px;color:var(--text-muted);font-size:14px;">' + tip + '</div>';
      return;
    }

    const self = this;
    const rows = items.map(function (asset) {
      const name = self._esc(asset.name);
      const size = self._formatSize(asset.size);
      const typeLabel = { video: '视频', audio: '音频', image: '图片', unknown: '文件' }[asset.kind] || '文件';
      const typeClass = ['video', 'audio', 'image'].includes(asset.kind) ? asset.kind : 'unknown';

      let thumbHtml;
      if (!asset.cloud && asset.blob && (asset.kind === 'image' || asset.kind === 'video')) {
        const url = URL.createObjectURL(asset.blob);
        self._urls.push(url);
        thumbHtml = asset.kind === 'image'
          ? '<img src="' + self._esc(url) + '" alt="" loading="lazy">'
          : '<video src="' + self._esc(url) + '" preload="metadata" muted playsinline></video>';
      } else {
        thumbHtml = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--text-muted)"><rect x="2" y="4" width="20" height="16" rx="3"/><polygon points="10,8 16,12 10,16"/></svg>';
      }

      const cloudBadge = asset.cloud
        ? '<span class="asset-type-badge" style="background:var(--success-bg,#e6f7ed);color:var(--success,#1a7f4b)">云端</span>'
        : '';

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
            cloudBadge +
            '<span>' + size + '</span>' +
          '</div>' +
        '</div>' +
        '<button class="asset-delete-btn" title="移除" data-delete="' + self._esc(asset.id) + '">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
        '</button>' +
      '</div>';
    });

    this._gridEl.innerHTML = rows.join('');

    this._gridEl.querySelectorAll('.asset-item').forEach(function (item) {
      item.addEventListener('click', function (e) {
        if (e.target.closest('.asset-delete-btn')) return;
        self._loadAsset(item.dataset.assetId);
      });
    });

    this._gridEl.querySelectorAll('.asset-delete-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        self._deleteAsset(btn.dataset.delete);
      });
    });
  },

  // ========== 载入工作流 / 删除 ==========

  async _loadAsset(assetId) {
    const asset = this._items.find((a) => a.id === assetId);
    if (!asset) return;
    if (asset.kind !== 'video') {
      if (window.Status) Status.toast('当前仅支持将视频素材载入工作流', 'warning');
      return;
    }

    try {
      if (window.Status) Status.toast('正在加载素材...', 'info');
      let file;
      if (asset.cloud) {
        const full = await this._services.asset.getAssetById(assetId);
        const url = await this._services.storage.getSignedUrl(full.bucket, full.storage_path);
        const res = await fetch(url);
        if (!res.ok) throw new Error('下载失败：HTTP ' + res.status);
        const blob = await res.blob();
        file = new File([blob], asset.name || 'asset.mp4', { type: blob.type || asset.mime_type || 'video/mp4' });
      } else {
        const rec = await this._getLocal(assetId);
        if (!rec || !rec.blob) { if (window.Status) Status.toast('文件已丢失或无法读取', 'error'); return; }
        file = new File([rec.blob], rec.name || 'asset.mp4', { type: rec.blob.type || rec.mime_type || 'video/mp4' });
      }

      if (typeof App !== 'undefined' && App.switchView) App.switchView('process');
      if (typeof Upload !== 'undefined' && Upload.handleFile) Upload.handleFile(file);
      if (window.Status) Status.toast('素材已载入，可继续处理', 'success');
    } catch (err) {
      console.error('素材库：加载素材失败', err);
      if (window.Status) Status.toast('素材加载失败，请稍后重试', 'error');
    }
  },

  async _deleteAsset(assetId) {
    const ok = await ConfirmDialog.show('移除素材', '确定要从素材库移除该素材吗？此操作不可撤销。');
    if (!ok) return;

    try {
      if (this._cloud) {
        const full = await this._services.asset.getAssetById(assetId);
        try { await this._services.storage.deleteFile(full.bucket, full.storage_path); } catch (e) { console.warn('素材库：删除存储文件失败（可能已删除）', e); }
        await this._services.asset.deleteAsset(assetId);
      } else {
        await this._deleteLocal(assetId);
      }
      if (window.Status) Status.toast('已移除素材', 'success');
      await this._refresh();
    } catch (err) {
      console.error('素材库：删除失败', err);
      if (window.Status) Status.toast('移除失败，请稍后重试', 'error');
    }
  },
};
