// 处理历史模块（登录后启用）
// 监听 result-ready 事件 → 结果上传 Storage、元数据/参数写入 Postgres，并渲染历史列表。
// 未登录 / Supabase 未配置时为空操作，保持纯本地模式。

const HistoryModule = {
  _enabled: false,
  _client: null,
  _userId: null,
  _projectId: null,
  _projectFailed: false,   // 若项目创建失败（如 RLS），不再重试
  _services: null,
  _listEl: null,
  _emptyStateEl: null,

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
    this._listEl = document.getElementById('historyList');
    this._emptyStateEl = document.getElementById('historyEmptyState');

    const state = window.VideoEditingSupabase;
    if (!state || !state.isConfigured || !state.client) {
      // 未配置 → 纯本地模式，显示引导状态
      if (this._emptyStateEl) this._emptyStateEl.style.display = '';
      return;
    }

    this._client = state.client;
    this._services = {
      storage: StorageService.createStorageService(this._client),
      project: ProjectService.createProjectService(this._client),
      asset: AssetService.createAssetService(this._client),
      job: JobService.createJobService(this._client),
    };

    const userId = await this._ensureUser();
    if (!userId) {
      // 未登录 → 显示引导状态
      if (this._emptyStateEl) this._emptyStateEl.style.display = '';
      return;
    }

    this._enabled = true;

    // 结果产生 → 持久化
    document.addEventListener('result-ready', (e) => {
      this._persistResult(e.detail);
    });

    await this._refresh();
  },

  // 生成 uuid：优先 crypto.randomUUID（安全上下文），否则用 getRandomValues 兜底
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
    if (this._projectFailed) return null;           // 之前已失败（如 RLS），不再重试
    const userId = await this._ensureUser();
    if (!userId) return null;
    try {
      const project = await this._services.project.getOrCreateDefaultProject(userId);
      this._projectId = project.id;
      return this._projectId;
    } catch (err) {
      this._projectFailed = true;                   // 标记失败，后续调用直接短路
      throw err;
    }
  },

  async _persistResult(detail) {
    if (!this._enabled || !detail || !detail.meta || !detail.meta.operation) return;

    const { blob, type, filename, meta } = detail;
    const kind = HistoryMeta.resultKindForOperation(meta.operation);
    if (!kind) return;
    const bucket = HistoryMeta.bucketForKind(kind);

    let projectId;
    let userId;
    try {
      userId = await this._ensureUser();
      projectId = await this._ensureProject();
      if (!userId || !projectId) return;
    } catch (err) {
      // RLS 策略未推送（42501）是最常见的根因，给出诊断提示
      if (err && err.code === '42501') {
        console.error('历史记录：RLS 策略阻止了项目创建。请执行 npx supabase db push 推送数据库迁移。', err);
        if (window.Status) {
          Status.toast('历史记录保存失败：数据库权限不足，请检查 Supabase 迁移是否已推送', 'warning');
        }
      } else if (err && err.code === '23503') {
        // FK 约束失败：profiles 表可能缺少对应用户行（trigger 未触发）
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
      await this._services.storage.uploadResult(bucket, storagePath, blob, blob.type);
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
    if (!this._enabled || !this._listEl) return;
    if (this._projectFailed) {
      // 项目创建已失败（如 RLS 未推送），不再尝试加载列表
      this._listEl.innerHTML = '';
      if (this._emptyStateEl) {
        this._emptyStateEl.style.display = '';
        this._emptyStateEl.querySelector('h3').textContent = '数据库权限不足';
        this._emptyStateEl.querySelector('p').textContent = '无法加载处理历史。请管理员执行 npx supabase db push 推送数据库迁移。';
      }
      return;
    }
    let jobs = [];
    try {
      const projectId = await this._ensureProject();
      if (!projectId) return;
      jobs = await this._services.job.listJobs(projectId);
    } catch (err) {
      console.error('历史记录：加载列表失败', err);
      return;
    }
    this._render(jobs);
  },

  // HTML 转义，防止 params/error_message 等用户内容注入（存储型 XSS）
  _esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  },

  _render(jobs) {
    // 切换空状态 / 列表显示
    if (!jobs || jobs.length === 0) {
      if (this._listEl) this._listEl.innerHTML = '';
      if (this._emptyStateEl) {
        this._emptyStateEl.style.display = '';
        this._emptyStateEl.querySelector('h3').textContent = '还没有处理记录';
        this._emptyStateEl.querySelector('p').textContent = '登录后处理视频，结果会自动保存到这里，可随时预览或下载。';
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

      const statusClass = 'history-status-' + this._esc(job.status);
      const errMsg = this._esc((job.error_message || '').substring(0, 40));
      const errorText = (job.status === 'failed' && job.error_message)
        ? `<span class="history-error" title="${errMsg}">${errMsg}</span>`
        : '';

      const actionHtml = canOpen
        ? `<div class="history-item-actions">
            <button class="btn btn-sm btn-primary-outline" data-asset="${assetId}">预览</button>
            <button class="btn btn-sm btn-outline" data-download="${assetId}">下载</button>
            <button class="btn btn-sm btn-ghost btn-delete" data-delete="${jobId}" data-assetid="${assetId}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>
          </div>`
        : `<div class="history-item-actions">
            <button class="btn btn-sm btn-ghost btn-delete" data-delete="${jobId}" data-assetid="${assetId}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>
          </div>`;

      const opIcon = this._opIcon(job.operation);

      return `<div class="history-item">
        <div class="history-item-header">
          <span class="history-op">
            <span class="history-op-icon">${opIcon}</span>
            ${op}
          </span>
          <span class="history-status ${statusClass}">${statusText}</span>
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

    // 预览按钮
    this._listEl.querySelectorAll('button[data-asset]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._openAsset(btn.dataset.asset);
      });
    });

    // 下载按钮
    this._listEl.querySelectorAll('button[data-download]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._downloadAsset(btn.dataset.download);
      });
    });

    // 删除按钮
    this._listEl.querySelectorAll('button[data-delete]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._deleteJob(btn.dataset.delete, btn.dataset.assetid);
      });
    });
  },

  /** 操作类型 → SVG 图标 */
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
    try {
      const asset = await this._services.asset.getAssetById(assetId);
      const url = await this._services.storage.getSignedUrl(asset.bucket, asset.storage_path);
      // 签名 URL 是跨域的，<a download> 无法强制下载，先 fetch 为 blob
      const res = await fetch(url);
      if (!res.ok) throw new Error('下载失败：HTTP ' + res.status);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = asset.original_filename || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(blobUrl); }, 1000);
      if (window.Status) Status.toast('下载已开始', 'success');
    } catch (err) {
      console.error('历史记录：下载失败', err);
      if (window.Status) Status.toast('下载失败，请稍后重试', 'error');
    }
  },

  async _deleteJob(jobId, assetId) {
    var ok = await ConfirmDialog.show(
      '删除处理记录',
      '确定要删除这条处理记录吗？关联的结果文件也将被删除，此操作不可撤销。'
    );
    if (!ok) return;
    try {
      // 如果有结果文件 → 先删 Storage 文件，再删 asset 记录
      if (assetId) {
        try {
          const asset = await this._services.asset.getAssetById(assetId);
          await this._services.storage.deleteFile(asset.bucket, asset.storage_path);
          await this._services.asset.deleteAsset(assetId);
        } catch (err) {
          console.warn('历史记录：清理结果文件/素材失败（可能已被删除）', err);
        }
      }
      // 删除任务记录
      await this._services.job.deleteJob(jobId);
      if (window.Status) Status.toast('已删除', 'success');
      await this._refresh();
    } catch (err) {
      console.error('历史记录：删除失败', err);
      if (window.Status) Status.toast('删除失败，请稍后重试', 'error');
    }
  },
};
