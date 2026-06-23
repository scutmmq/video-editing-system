// 素材库模块（登录后启用）
// 列出当前项目的已处理结果文件，支持预览，并可将视频类结果一键载入工作流继续编辑。
// 未登录 / Supabase 未配置时显示引导空状态，保持纯本地模式。
// 注意：当前源视频不会上传到云端，素材库只覆盖「已处理文件」；「已上传源文件」需另行实现持久化。

const AssetLibrary = {
  _client: null,
  _services: null,
  _userId: null,
  _projectId: null,
  _listEl: null,
  _emptyEl: null,
  _enabled: false,

  _kindLabels: {
    trimmed_video: '裁剪视频',
    gif: 'GIF',
    audio: '音频',
    watermarked_video: '水印视频',
    filtered_video: '滤镜视频',
    cover_image: '封面图',
    transformed_video: '变换视频',
    transcoded_video: '转码视频',
    speed_video: '变速视频',
    audio_adjusted_video: '音频调整视频',
  },

  async init() {
    this._listEl = document.getElementById('assetLibraryList');
    this._emptyEl = document.getElementById('assetLibraryEmpty');

    const state = window.VideoEditingSupabase;
    if (!state || !state.isConfigured || !state.client) {
      // 未配置 → 纯本地模式，保留引导空状态
      return;
    }

    this._client = state.client;
    this._services = {
      storage: StorageService.createStorageService(this._client),
      project: ProjectService.createProjectService(this._client),
      asset: AssetService.createAssetService(this._client),
    };
    this._enabled = true;
  },

  // 切换到素材库视图时由 App._initViewTabs 调用
  async refresh() {
    if (!this._enabled || !this._listEl) return;
    let assets = [];
    try {
      const userId = await this._ensureUser();
      if (!userId) { this._renderEmpty('请先登录', '登录后即可查看并复用云端素材。'); return; }
      const projectId = await this._ensureProject(userId);
      if (!projectId) return;
      assets = await this._services.asset.listProjectAssets(projectId);
    } catch (err) {
      console.error('素材库：加载列表失败', err);
      if (window.Status) Status.toast('素材库加载失败，请稍后重试', 'error');
      return;
    }
    this._render(assets);
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

  async _ensureProject(userId) {
    if (this._projectId) return this._projectId;
    try {
      const project = await this._services.project.getOrCreateDefaultProject(userId);
      this._projectId = project.id;
      return this._projectId;
    } catch (err) {
      console.error('素材库：获取项目失败', err);
      return null;
    }
  },

  _esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  },

  _renderEmpty(title, desc) {
    if (this._listEl) this._listEl.innerHTML = '';
    if (this._emptyEl) {
      this._emptyEl.style.display = '';
      const h = this._emptyEl.querySelector('h3');
      const p = this._emptyEl.querySelector('p');
      if (h && title) h.textContent = title;
      if (p && desc) p.textContent = desc;
    }
  },

  _render(assets) {
    if (!assets || assets.length === 0) {
      this._renderEmpty('素材库为空', '登录后处理视频，结果会保存到这里，可一键载入工作流继续编辑。');
      return;
    }
    if (this._emptyEl) this._emptyEl.style.display = 'none';

    this._assetsById = {};
    assets.forEach((a) => { if (a && a.id) this._assetsById[a.id] = a; });

    const rows = assets.map((a) => {
      const id = this._esc(a.id || '');
      const name = this._esc(a.original_filename || '未命名素材');
      const kind = this._esc(this._kindLabels[a.kind] || a.kind || '');
      const size = a.size_bytes != null ? this._esc(Utils.formatFileSize(a.size_bytes)) : '';
      const time = a.created_at ? this._esc(new Date(a.created_at).toLocaleString()) : '';
      const isVideo = typeof a.mime_type === 'string' && a.mime_type.indexOf('video/') === 0;
      const loadBtn = isVideo
        ? `<button class="btn btn-sm btn-primary-outline" data-load="${id}">载入工作流</button>`
        : '';

      return `<div class="history-item">
        <div class="history-item-header">
          <span class="history-op">${name}</span>
          <span class="history-status">${kind}</span>
        </div>
        <div class="history-item-footer">
          <span class="history-time">${time}${size ? ' · ' + size : ''}</span>
        </div>
        <div class="history-item-actions">
          <button class="btn btn-sm btn-outline" data-preview="${id}">预览</button>
          ${loadBtn}
        </div>
      </div>`;
    });

    this._listEl.innerHTML = rows.join('');

    this._listEl.querySelectorAll('button[data-preview]').forEach((btn) => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); this._preview(btn.dataset.preview); });
    });
    this._listEl.querySelectorAll('button[data-load]').forEach((btn) => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); this._load(btn.dataset.load); });
    });
  },

  async _preview(assetId) {
    try {
      const asset = await this._services.asset.getAssetById(assetId);
      const url = await this._services.storage.getSignedUrl(asset.bucket, asset.storage_path);
      window.open(url, '_blank');
    } catch (err) {
      console.error('素材库：预览失败', err);
      if (window.Status) Status.toast('无法打开该素材，请稍后重试', 'error');
    }
  },

  async _load(assetId) {
    try {
      const asset = await this._services.asset.getAssetById(assetId);
      const url = await this._services.storage.getSignedUrl(asset.bucket, asset.storage_path);
      const res = await fetch(url);
      if (!res.ok) throw new Error('下载失败：HTTP ' + res.status);
      const blob = await res.blob();
      const file = new File([blob], asset.original_filename || 'asset.mp4', {
        type: blob.type || asset.mime_type || 'video/mp4',
      });
      if (window.App) App.switchView('process');
      Upload.handleFile(file);
      if (window.Status) Status.toast('已载入素材到工作流', 'success');
    } catch (err) {
      console.error('素材库：载入失败', err);
      if (window.Status) Status.toast('载入失败，请稍后重试', 'error');
    }
  },
};
