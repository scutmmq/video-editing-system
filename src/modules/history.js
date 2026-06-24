// 处理历史模块（支持本地模式 + 云端模式）
// 未登录时用 localStorage + IndexedDB 保存历史记录，登录后自动同步到云端

const HistoryModule = {
  _enabled: false,
  _client: null,
  _userId: null,
  _projectId: null,
  _projectFailed: false,
  _projectPromise: null,
  _services: null,
  _listEl: null,
  _emptyStateEl: null,
  _jobs: [],
  _localMode: false, // true = 纯本地模式（未登录）
  _db: null,         // IndexedDB 实例

  _opLabels: {
    trim: '视频裁剪',
    gif: 'GIF 转换',
    extract_audio: '音频提取',
    watermark: '文字水印',
    filter: '视频滤镜',
    capture_cover: '截取封面',
    transform: '画面变换',
    transcode: '压缩转码',
    speed: '播放速度',
    audio_adjust: '音频调整',
  },

  _statusLabels: {
    queued: '排队中',
    processing: '处理中',
    succeeded: '成功',
    failed: '失败',
    cancelled: '已取消',
  },

  async init() {
    try {
      this._listEl = document.getElementById('historyList');
      this._emptyStateEl = document.getElementById('historyEmptyState');

      const state = window.VideoEditingSupabase;
      if (!state || !state.isConfigured || !state.client) {
        this._localMode = true;
        this._enabled = true;
        try {
          await this._initLocalDB();
          await this._refresh();
        } catch (err) {
          console.warn('本地历史初始化失败，使用内存模式', err);
          this._db = null;
          this._jobs = [];
        }
        document.addEventListener('result-ready', (e) => {
          this._persistResult(e.detail);
        });
        return;
      }

      this._client = state.client;
      this._services = {
        storage: StorageService.createStorageService(this._client),
        project: ProjectService.createProjectService(this._client),
        asset: AssetService.createAssetService(this._client),
        job: JobService.createJobService(this._client),
      };

      let userId = null;
      try { userId = await this._ensureUser(); } catch (_e) { userId = null; }

      if (!userId) {
        this._localMode = true;
        this._enabled = true;
        try {
          await this._initLocalDB();
          await this._refresh();
        } catch (err) {
          console.warn('本地历史初始化失败，使用内存模式', err);
          this._db = null;
          this._jobs = [];
        }
        document.addEventListener('result-ready', (e) => {
          this._persistResult(e.detail);
        });
        return;
      }

      this._enabled = true;

      document.addEventListener('result-ready', (e) => {
        this._persistResult(e.detail);
      });

      await this._refresh();
    } catch (err) {
      console.error('HistoryModule.init() 失败:', err);
      this._enabled = false;
      this._localMode = true;
      this._db = null;
      this._jobs = [];
    }
  },

  // ========== 本地模式（IndexedDB） ==========

  async _initLocalDB() {
    if (!window.indexedDB) {
      console.warn('当前浏览器不支持 IndexedDB，历史记录将使用内存存储（刷新页面后丢失）');
      this._db = null;
      return;
    }
    try {
      // 加 3 秒超时，防止 IndexedDB 在某些浏览器中无限阻塞
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => resolve('timeout'), 3000);
      });

      const dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open('VideoEditingDB', 1);
        req.onerror = () => {
          console.warn('IndexedDB 打开失败：', req.error);
          reject(req.error);
        };
        req.onsuccess = () => {
          this._db = req.result;
          resolve();
        };
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('history')) {
            db.createObjectStore('history', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('assets')) {
            db.createObjectStore('assets', { keyPath: 'id' });
          }
        };
      });

      const result = await Promise.race([dbPromise, timeoutPromise]);
      if (result === 'timeout') {
        console.warn('IndexedDB 初始化超时，使用内存存储（刷新页面后丢失）');
        this._db = null;
      }
    } catch (err) {
      console.warn('IndexedDB 不可用，历史记录将使用内存存储（刷新页面后丢失）', err);
      this._db = null;
    }
  },

  async _saveLocalJob(job) {
    if (!this._db) return;
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction('history', 'readwrite');
      const store = tx.objectStore('history');
      const req = store.put(job);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async _getLocalJobs() {
    if (!this._db) return [];
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction('history', 'readonly');
      const store = tx.objectStore('history');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  async _deleteLocalJob(jobId) {
    if (!this._db) return;
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction('history', 'readwrite');
      const store = tx.objectStore('history');
      const req = store.delete(jobId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async _saveLocalAsset(asset) {
    if (!this._db) return;
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction('assets', 'readwrite');
      const store = tx.objectStore('assets');
      const req = store.put(asset);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async _getLocalAsset(assetId) {
    if (!this._db) return null;
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction('assets', 'readonly');
      const store = tx.objectStore('assets');
      const req = store.get(assetId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },

  async _deleteLocalAsset(assetId) {
    if (!this._db) return;
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction('assets', 'readwrite');
      const store = tx.objectStore('assets');
      const req = store.delete(assetId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  _uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [];
    for (let i = 0; i < 16; i++) hex.push(bytes[i].toString(16).padStart(2, '0'));
    return (
      hex.slice(0, 4).join('') + '-' +
      hex.slice(4, 6).join('') + '-' +
      hex.slice(6, 8).join('') + '-' +
      hex.slice(8, 10).join('') + '-' +
      hex.slice(10, 16).join('')
    );
  },

  async _retry(fn, retries) {
    var n = (typeof retries === 'number') ? retries : 2;
    var lastErr;
    for (var i = 0; i <= n; i++) {
      try { return await fn(); }
      catch (err) {
        lastErr = err;
        if (i < n) await new Promise(function (r) { setTimeout(r, 500 * (i + 1)); });
      }
    }
    throw lastErr;
  },

  async _ensureUser() {
    if (this._userId) return this._userId;
    try {
      const { data, error } = await this._client.auth.getUser();
      if (error || !data || !data.user) return null;
      this._userId = data.user.id;
      return this._userId;
    } catch (_err) {
      return null;
    }
  },

  async _ensureProject() {
    if (this._projectId) return this._projectId;
    if (this._projectFailed) return null;
    if (!this._projectPromise) {
      this._projectPromise = (async () => {
        const userId = await this._ensureUser();
        if (!userId) return null;
        try {
          const project = await this._services.project.getOrCreateDefaultProject(userId);
          this._projectId = project.id;
          return this._projectId;
        } catch (err) {
          this._projectFailed = true;
          throw err;
        }
      })();
    }
    try {
      return await this._projectPromise;
    } finally {
      if (!this._projectId) this._projectPromise = null;
    }
  },

  async _persistResult(detail) {
    if (!detail || !detail.meta || !detail.meta.operation) return;

    const { blob, type, filename, meta } = detail;
    const kind = HistoryMeta.resultKindForOperation(meta.operation);
    if (!kind) return;

    // 本地模式：保存到 IndexedDB
    if (this._localMode) {
      const jobId = this._uuid();
      const assetId = this._uuid();
      const timestamp = new Date().toISOString();

      const job = {
        id: jobId,
        operation: meta.operation,
        params: meta.params || {},
        status: 'succeeded',
        result_asset_id: assetId,
        created_at: timestamp,
        updated_at: timestamp,
        local: true,
      };

      const asset = {
        id: assetId,
        kind: kind,
        original_filename: filename,
        mime_type: blob.type,
        size_bytes: blob.size,
        blob: blob, // IndexedDB 可以直接存 Blob
        created_at: timestamp,
      };

      try {
        await this._saveLocalJob(job);
        await this._saveLocalAsset(asset);
        if (window.Status) Status.toast('已保存到本地历史记录', 'success');
      } catch (err) {
        console.error('本地历史保存失败', err);
        if (window.Status) Status.toast('历史保存失败（存储空间不足）', 'error');
      }
      await this._refresh();
      return;
    }

    // 云端模式（原逻辑）
    const bucket = HistoryMeta.bucketForKind(kind);

    let projectId;
    let userId;
    try {
      userId = await this._ensureUser();
      projectId = await this._ensureProject();
      if (!userId || !projectId) return;
    } catch (err) {
      if (err && err.code === '42501') {
        console.error('历史记录：RLS 策略阻止了项目创建。请执行 npx supabase db push 推送数据库迁移。', err);
        if (window.Status) {
          Status.toast('历史记录保存失败：数据库权限不足，请检查 Supabase 迁移是否已推送', 'warning');
        }
      } else if (err && err.code === '23503') {
        console.error('历史记录：外键约束失败，profiles 表可能缺少用户记录。请检查 on_auth_user_created trigger。', err);
        if (window.Status) {
          Status.toast('历史记录保存失败：用户资料未同步，请重新登录', 'warning');
        }
      } else {
        console.error('历史记录：获取项目失败', err);
      }
      return;
    }

    const assetId = this._uuid();
    const storagePath = HistoryMeta.buildStoragePath(userId, projectId, assetId, filename);

    let jobId;
    try {
      jobId = await this._services.job.startJob({
        projectId,
        operation: meta.operation,
        params: meta.params || {},
        createdBy: userId,
      });
    } catch (err) {
      console.error('历史记录：创建任务失败', err);
      return;
    }

    try {
      await this._retry(() => this._services.storage.uploadResult(bucket, storagePath, blob, blob.type), 2);
      await this._services.asset.insertResultAsset({
        id: assetId,
        projectId,
        ownerId: userId,
        kind,
        bucket,
        storagePath,
        originalFilename: filename,
        mimeType: blob.type,
        sizeBytes: blob.size,
        durationSeconds: type === 'video' ? (Preview.getDuration() || null) : null,
      });
      await this._services.job.completeJob(jobId, assetId);
      if (window.Status) Status.toast('已保存到处理历史', 'success');
    } catch (err) {
      console.error('历史记录：保存结果失败', err);
      try { await this._services.job.failJob(jobId, err.message); } catch (_e) {}
      if (window.Status) Status.toast('处理历史保存失败，请稍后重试', 'error');
    } finally {
      await this._refresh();
    }
  },

  async _refresh() {
    if (!this._listEl) return;

    let jobs = [];

    if (this._localMode) {
      jobs = await this._getLocalJobs();
    } else {
      if (this._projectFailed) {
        this._listEl.innerHTML = '';
        if (this._emptyStateEl) {
          this._emptyStateEl.style.display = '';
          this._emptyStateEl.querySelector('h3').textContent = '数据库权限不足';
          this._emptyStateEl.querySelector('p').textContent = '无法加载处理历史。请管理员执行 npx supabase db push 推送数据库迁移。';
        }
        return;
      }
      try {
        const projectId = await this._ensureProject();
        if (!projectId) return;
        jobs = await this._services.job.listJobs(projectId);
      } catch (err) {
        console.error('历史记录：加载列表失败', err);
        return;
      }
    }

    this._jobs = jobs;
    this._render(jobs);
  },

  _esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  },

  _render(jobs) {
    if (!jobs || jobs.length === 0) {
      if (this._listEl) this._listEl.innerHTML = '';
      if (this._emptyStateEl) {
        this._emptyStateEl.style.display = '';
        var h3 = this._emptyStateEl.querySelector('h3');
        var p = this._emptyStateEl.querySelector('p');
        if (h3) h3.textContent = '还没有处理记录';
        if (p) {
          p.textContent = this._localMode
            ? '处理视频后，结果会自动保存到本地历史记录。'
            : '登录后处理视频，结果会自动保存到这里，可随时预览或下载。';
        }
      }
      return;
    }

    if (this._emptyStateEl) this._emptyStateEl.style.display = 'none';

    const rows = jobs.map((job) => {
      const op = this._esc(this._opLabels[job.operation] || job.operation);
      const summary = this._esc(HistoryMeta.summarizeParams(job.operation, job.params));
      const statusText = this._esc(this._statusLabels[job.status] || job.status);
      const time = job.created_at ? this._esc(new Date(job.created_at).toLocaleString()) : '';
      const canOpen = job.status === 'succeeded' && job.result_asset_id;
      const assetId = this._esc(job.result_asset_id || '');
      const jobId = this._esc(job.id || '');
      const isLocal = job.local ? true : false;

      const statusClass = 'history-status-' + this._esc(job.status);
      const errMsg = this._esc((job.error_message || '').substring(0, 40));
      const errorText = (job.status === 'failed' && job.error_message)
        ? `<span class="history-error" title="${errMsg}">${errMsg}</span>`
        : '';

      const localBadge = isLocal ? '<span class="history-local-badge" title="本地保存">本地</span>' : '';

      const actionHtml = canOpen
        ? `<div class="history-item-actions">
            <button class="btn btn-sm btn-primary-outline" data-asset="${assetId}">预览</button>
            <button class="btn btn-sm btn-outline" data-download="${assetId}">下载</button>
            <button class="btn btn-sm btn-ghost btn-delete" data-delete="${jobId}" data-assetid="${assetId}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>
          </div>`
        : (job.status === 'failed'
          ? `<div class="history-item-actions">
              <button class="btn btn-sm btn-accent" data-retry="${jobId}" data-op="${this._esc(job.operation)}" title="使用相同的参数重新处理">重试</button>
              <button class="btn btn-sm btn-ghost btn-delete" data-delete="${jobId}" data-assetid="${assetId}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              </button>
            </div>`
          : `<div class="history-item-actions">
              <button class="btn btn-sm btn-ghost btn-delete" data-delete="${jobId}" data-assetid="${assetId}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              </button>
            </div>`);

      const opIcon = this._opIcon(job.operation);

      return `<div class="history-item">
        <div class="history-item-header">
          <span class="history-op">
            <span class="history-op-icon">${opIcon}</span>
            ${op}
          </span>
          <span class="history-status ${statusClass}">${statusText}</span>
          ${localBadge}
        </div>
        <div class="history-item-body">
          <span class="history-summary">${summary}</span>
        </div>
        <div class="history-item-footer">
          <span class="history-time">${time}</span>
          ${errorText}
        </div>
        ${actionHtml}
      </div>`;
    });

    this._listEl.innerHTML = rows.join('');

    this._listEl.querySelectorAll('button[data-asset]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._openAsset(btn.dataset.asset);
      });
    });

    this._listEl.querySelectorAll('button[data-download]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._downloadAsset(btn.dataset.download);
      });
    });

    this._listEl.querySelectorAll('button[data-delete]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._deleteJob(btn.dataset.delete, btn.dataset.assetid);
      });
    });

    this._listEl.querySelectorAll('button[data-retry]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const jobId = btn.dataset.retry;
        const op = btn.dataset.op;
        this._retryJob(jobId, op);
      });
    });
  },

  _opIcon(operation) {
    const icons = {
      trim: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 7h20M9 7v14M15 7v14"/></svg>',
      gif: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
      extract_audio: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
      watermark: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
      filter: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>',
      capture_cover: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
      transform: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>',
      transcode: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
      speed: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
      audio_adjust: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>',
    };
    return icons[operation] || '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><polygon points="10,8 16,12 10,16"/></svg>';
  },

  async _openAsset(assetId) {
    if (this._localMode) {
      try {
        const asset = await this._getLocalAsset(assetId);
        if (!asset || !asset.blob) {
          if (window.Status) Status.toast('文件已过期或无法读取', 'error');
          return;
        }
        const url = URL.createObjectURL(asset.blob);
        window.open(url, '_blank');
      } catch (err) {
        console.error('本地历史：打开结果失败', err);
        if (window.Status) Status.toast('无法打开该结果', 'error');
      }
      return;
    }

    try {
      const asset = await this._services.asset.getAssetById(assetId);
      const url = await this._services.storage.getSignedUrl(asset.bucket, asset.storage_path);
      window.open(url, '_blank');
    } catch (err) {
      console.error('历史记录：打开结果失败', err);
      if (window.Status) Status.toast('无法打开该结果，请稍后重试', 'error');
    }
  },

  async _downloadAsset(assetId) {
    if (this._localMode) {
      try {
        const asset = await this._getLocalAsset(assetId);
        if (!asset || !asset.blob) {
          if (window.Status) Status.toast('文件已过期或无法读取', 'error');
          return;
        }
        App.download(asset.blob, asset.original_filename || 'download');
      } catch (err) {
        console.error('本地历史：下载失败', err);
        if (window.Status) Status.toast('下载失败', 'error');
      }
      return;
    }

    try {
      const asset = await this._services.asset.getAssetById(assetId);
      const url = await this._services.storage.getSignedUrl(asset.bucket, asset.storage_path);
      const res = await fetch(url);
      if (!res.ok) throw new Error('下载失败：HTTP ' + res.status);
      const blob = await res.blob();
      App.download(blob, asset.original_filename || 'download');
    } catch (err) {
      console.error('历史记录：下载失败', err);
      if (window.Status) Status.toast('下载失败，请稍后重试', 'error');
    }
  },

  async _retryJob(jobId, opName) {
    let job;
    if (this._localMode) {
      job = this._jobs.find(function (j) { return j.id === jobId; });
    } else {
      job = this._jobs.find(function (j) { return j.id === jobId; });
    }

    if (!job || !job.params) {
      if (window.Status) Status.toast('无法获取任务参数，请手动重试', 'error');
      return;
    }

    var file = (typeof Upload !== 'undefined' && Upload.getFile) ? Upload.getFile() : null;
    if (!file) {
      if (window.Status) {
        Status.toast('请先上传视频文件，再点击重试', 'warning');
      }
      if (typeof App !== 'undefined' && App.switchView) {
        App.switchView('process');
      }
      return;
    }

    if (typeof App !== 'undefined' && App.switchView) {
      App.switchView('process');
    }

    var tabMap = {
      trim: 'trim', gif: 'gif', extract_audio: 'audio',
      watermark: 'watermark', filter: 'filter', capture_cover: 'cover',
      transform: 'transform', transcode: 'transcode', speed: 'speed',
      audio_adjust: 'audioadj'
    };
    var tabName = tabMap[opName];
    if (!tabName) {
      if (window.Status) Status.toast('不支持重试该类型任务', 'error');
      return;
    }

    var tabBtn = document.querySelector('.sidebar-item.tab[data-tab="' + tabName + '"]');
    if (tabBtn) tabBtn.click();

    await new Promise(function (r) { setTimeout(r, 150); });

    var p = job.params;

    switch (opName) {
      case 'trim':
        this._setVal('trimStart', p.start);
        this._setVal('trimEnd', p.end);
        break;
      case 'gif':
        this._setVal('gifStart', p.start);
        this._setVal('gifDuration', p.duration);
        this._setSel('gifWidth', p.width);
        this._setSel('gifFps', p.fps);
        break;
      case 'extract_audio':
        this._setSel('audioFormat', p.format);
        break;
      case 'watermark':
        this._setVal('wmText', p.text);
        this._setVal('wmFontSize', p.fontSize);
        this._setVal('wmColor', p.color);
        this._setSel('wmPosition', p.position);
        break;
      case 'filter':
        this._setRadio('filter', p.filter);
        break;
      case 'capture_cover':
        this._setVal('coverTime', p.time);
        break;
      case 'transform':
        this._setSel('tfRotate', p.rotate);
        this._setSel('tfScale', p.scale);
        this._setSel('tfFit', p.fit);
        this._setCheck('tfHflip', p.hflip);
        this._setCheck('tfVflip', p.vflip);
        break;
      case 'transcode':
        this._setSel('tcFormat', p.format);
        this._setSel('tcResolution', p.resolution);
        this._setSel('tcQuality', p.quality);
        break;
      case 'speed':
        this._setSel('spSpeed', p.speed);
        this._setCheck('spReverse', p.reverse);
        break;
      case 'audio_adjust':
        this._setCheck('aaMute', p.mute);
        this._setVal('aaVolume', p.volume);
        this._setVal('aaFadeIn', p.fadeIn);
        this._setVal('aaFadeOut', p.fadeOut);
        break;
    }

    document.querySelectorAll('.tab-panel.active .form-input').forEach(function (el) {
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    var btnId = {
      trim: 'trimBtn', gif: 'gifBtn', extract_audio: 'audioBtn',
      watermark: 'watermarkBtn', filter: 'filterBtn', capture_cover: 'coverBtn',
      transform: 'transformBtn', transcode: 'transcodeBtn', speed: 'speedBtn',
      audio_adjust: 'audioAdjustBtn'
    }[opName];
    var btn = document.getElementById(btnId);
    if (btn) {
      if (window.Status) Status.toast('正在使用历史参数重新处理...', 'info');
      btn.click();
    } else {
      if (window.Status) Status.toast('参数已填充，请手动点击处理', 'success');
    }
  },

  _setVal(id, val) {
    var el = document.getElementById(id);
    if (el && val !== undefined && val !== null) el.value = val;
  },
  _setSel(id, val) {
    var el = document.getElementById(id);
    if (el && val !== undefined && val !== null) {
      el.value = val;
      if (el.value !== String(val)) { el.value = el.options[0].value; }
    }
  },
  _setRadio(name, val) {
    if (val === undefined || val === null) return;
    var radio = document.querySelector('input[name="' + name + '"][value="' + val + '"]');
    if (radio) {
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
    }
  },
  _setCheck(id, val) {
    var el = document.getElementById(id);
    if (el && val !== undefined && val !== null) el.checked = Boolean(val);
  },

  async _deleteJob(jobId, assetId) {
    var ok = await ConfirmDialog.show(
      '删除处理记录',
      '确定要删除这条处理记录吗？关联的结果文件也将被删除，此操作不可撤销。'
    );
    if (!ok) return;

    if (this._localMode) {
      try {
        await this._deleteLocalJob(jobId);
        if (assetId) await this._deleteLocalAsset(assetId);
        if (window.Status) Status.toast('已删除', 'success');
        await this._refresh();
      } catch (err) {
        console.error('本地历史：删除失败', err);
        if (window.Status) Status.toast('删除失败', 'error');
      }
      return;
    }

    try {
      if (assetId) {
        try {
          const asset = await this._services.asset.getAssetById(assetId);
          await this._services.storage.deleteFile(asset.bucket, asset.storage_path);
          await this._services.asset.deleteAsset(assetId);
        } catch (err) {
          console.warn('历史记录：清理结果文件/素材失败（可能已被删除）', err);
        }
      }
      await this._services.job.deleteJob(jobId);
      if (window.Status) Status.toast('已删除', 'success');
      await this._refresh();
    } catch (err) {
      console.error('历史记录：删除失败', err);
      if (window.Status) Status.toast('删除失败，请稍后重试', 'error');
    }
  },
};
