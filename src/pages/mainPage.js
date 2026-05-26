(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.MainPage = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const mainPageTemplate = `
<nav class="navbar" id="navbar">
  <div class="navbar-inner">
    <a class="navbar-brand" href="#">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><polygon points="10,8 16,12 10,16"/></svg>
      <span>轻量视频处理</span>
    </a>
    <div class="navbar-auth">
      <div class="auth-status-inline" id="authSignedIn" style="display:none">
        <span id="authUserEmail" class="auth-email-display"></span>
        <button class="btn btn-sm btn-ghost" id="authSignOutBtn">退出</button>
      </div>
      <a class="btn btn-sm btn-outline" id="authLoginLink" href="/login.html">登录</a>
    </div>
  </div>
</nav>

<div class="app-layout">

  <!-- ===== 左侧边栏 ===== -->
  <aside class="sidebar" id="toolsSection">
    <div class="sidebar-header">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
      <span>处理工具</span>
    </div>
    <nav class="sidebar-nav">
      <button class="sidebar-item tab active" data-tab="trim">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 7h20M9 7v14M15 7v14"/></svg>
        <span class="sidebar-item-label">视频裁剪</span>
        <span class="sidebar-item-desc">截取片段</span>
      </button>
      <button class="sidebar-item tab" data-tab="gif">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
        <span class="sidebar-item-label">GIF 转换</span>
        <span class="sidebar-item-desc">动图生成</span>
      </button>
      <button class="sidebar-item tab" data-tab="audio">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        <span class="sidebar-item-label">音频提取</span>
        <span class="sidebar-item-desc">MP3 / WAV</span>
      </button>
      <button class="sidebar-item tab" data-tab="watermark">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        <span class="sidebar-item-label">文字水印</span>
        <span class="sidebar-item-desc">叠加文字</span>
      </button>
      <button class="sidebar-item tab" data-tab="filter">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
        <span class="sidebar-item-label">视频滤镜</span>
        <span class="sidebar-item-desc">画面调色</span>
      </button>
      <button class="sidebar-item tab" data-tab="cover">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
        <span class="sidebar-item-label">截取封面</span>
        <span class="sidebar-item-desc">导出帧图</span>
      </button>
    </nav>
  </aside>

  <!-- ===== 右侧主内容区 ===== -->
  <main class="main-content" id="mainContent">

    <!-- 上传区（紧凑横幅） -->
    <section class="upload-banner" id="uploadSection">
      <div class="upload-area" id="uploadArea">
        <div class="upload-area-inner">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          <p class="upload-text">点击或拖拽视频文件到此处</p>
          <p class="upload-hint">MP4 / WebM / MOV / AVI / MKV，建议不超过 200MB</p>
        </div>
        <input type="file" id="fileInput" accept="video/*" hidden>
      </div>
      <div class="file-info" id="fileInfo" style="display:none">
        <div class="file-info-card">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><polygon points="10,8 16,12 10,16"/></svg>
          <div class="file-info-details">
            <span class="file-info-name" id="fileName"></span>
            <span class="file-info-meta"><span id="fileSize"></span> · <span id="fileFormat"></span></span>
          </div>
          <button class="btn btn-sm btn-ghost" id="reuploadBtn">更换</button>
        </div>
      </div>
    </section>

    <!-- 视频预览 -->
    <section class="preview-section" id="previewSection" style="display:none">
      <div class="section-header">
        <h2>视频预览</h2>
      </div>
      <div class="video-container">
        <video id="videoPlayer" controls crossorigin="anonymous"></video>
      </div>
      <div class="preview-controls">
        <div class="preview-time">
          <span class="preview-time-label">当前</span>
          <strong id="currentTime">00:00</strong>
          <span class="preview-time-sep">/</span>
          <span class="preview-time-label">总长</span>
          <strong id="totalDuration">00:00</strong>
        </div>
        <div class="preview-actions">
          <button class="btn btn-sm btn-outline" id="setStartBtn">设为裁剪开始</button>
          <button class="btn btn-sm btn-outline" id="setEndBtn">设为裁剪结束</button>
        </div>
      </div>
    </section>

    <!-- 工具面板区 -->
    <section class="tool-panels" id="panelsContainer">
      <div class="section-header">
        <h2 id="panelTitle">视频裁剪</h2>
        <p id="panelSubtitle" class="section-subtitle">从视频中截取一段你需要的片段，保留你想要的部分。</p>
      </div>

      <div class="tab-panel active" id="panel-trim">
        <div class="form-row">
          <div class="form-group">
            <label for="trimStart">开始时间（秒）</label>
            <input type="number" id="trimStart" class="form-input" min="0" step="0.1" placeholder="例如 10.5">
          </div>
          <div class="form-group">
            <label for="trimEnd">结束时间（秒）</label>
            <input type="number" id="trimEnd" class="form-input" min="0" step="0.1" placeholder="例如 30.0">
          </div>
        </div>
        <p class="tab-panel-hint">也可以在预览区播放视频，使用「设为裁剪开始/结束」按钮快速填入。</p>
        <button class="btn btn-primary btn-full" id="trimBtn">开始裁剪</button>
      </div>

      <div class="tab-panel" id="panel-gif">
        <div class="form-row">
          <div class="form-group">
            <label for="gifStart">起始时间（秒）</label>
            <input type="number" id="gifStart" class="form-input" min="0" step="0.1" placeholder="0.0">
          </div>
          <div class="form-group">
            <label for="gifDuration">持续时长（秒）</label>
            <input type="number" id="gifDuration" class="form-input" min="0.1" step="0.1" max="15" placeholder="3.0">
          </div>
          <div class="form-group">
            <label for="gifWidth">画面宽度</label>
            <select id="gifWidth" class="form-input">
              <option value="320">320px</option>
              <option value="480" selected>480px</option>
              <option value="640">640px</option>
              <option value="800">800px</option>
            </select>
          </div>
          <div class="form-group">
            <label for="gifFps">帧率</label>
            <select id="gifFps" class="form-input">
              <option value="8">8 fps（文件小）</option>
              <option value="10" selected>10 fps（推荐）</option>
              <option value="15">15 fps（流畅）</option>
              <option value="24">24 fps（高清）</option>
            </select>
          </div>
        </div>
        <p class="tab-panel-hint">文件较大时，处理可能需要一些时间，请耐心等待。</p>
        <button class="btn btn-primary btn-full" id="gifBtn">生成 GIF</button>
      </div>

      <div class="tab-panel" id="panel-audio">
        <div class="form-row">
          <div class="form-group">
            <label for="audioFormat">输出格式</label>
            <select id="audioFormat" class="form-input">
              <option value="mp3" selected>MP3（体积小，兼容性好）</option>
              <option value="wav">WAV（无损，文件较大）</option>
            </select>
          </div>
        </div>
        <button class="btn btn-primary btn-full" id="audioBtn">提取音频</button>
      </div>

      <div class="tab-panel" id="panel-watermark">
        <div class="form-row">
          <div class="form-group">
            <label for="wmText">水印文字</label>
            <input type="text" id="wmText" class="form-input" placeholder="请输入水印文字" maxlength="50">
          </div>
          <div class="form-group">
            <label for="wmFontSize">字体大小（px）</label>
            <input type="number" id="wmFontSize" class="form-input" value="24" min="8" max="72">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="wmColor">文字颜色</label>
            <input type="color" id="wmColor" class="form-input color-input" value="#ffffff">
          </div>
          <div class="form-group">
            <label for="wmPosition">显示位置</label>
            <select id="wmPosition" class="form-input">
              <option value="top-left">左上角</option>
              <option value="top-right">右上角</option>
              <option value="bottom-left">左下角</option>
              <option value="bottom-right" selected>右下角</option>
              <option value="center">居中</option>
            </select>
          </div>
        </div>
        <button class="btn btn-primary btn-full" id="watermarkBtn">添加水印</button>
      </div>

      <div class="tab-panel" id="panel-filter">
        <div class="filter-grid">
          <label class="filter-card"><input type="radio" name="filter" value="grayscale"><span class="filter-preview filter-grayscale"></span><span>黑白</span></label>
          <label class="filter-card"><input type="radio" name="filter" value="blur"><span class="filter-preview filter-blur"></span><span>模糊</span></label>
          <label class="filter-card"><input type="radio" name="filter" value="brighten"><span class="filter-preview filter-brighten"></span><span>亮度增强</span></label>
          <label class="filter-card"><input type="radio" name="filter" value="darken"><span class="filter-preview filter-darken"></span><span>亮度降低</span></label>
          <label class="filter-card"><input type="radio" name="filter" value="contrast"><span class="filter-preview filter-contrast"></span><span>对比度增强</span></label>
          <label class="filter-card"><input type="radio" name="filter" value="hflip"><span class="filter-preview filter-hflip"></span><span>镜像翻转</span></label>
          <label class="filter-card"><input type="radio" name="filter" value="vintage"><span class="filter-preview filter-vintage"></span><span>复古效果</span></label>
          <label class="filter-card"><input type="radio" name="filter" value="cool"><span class="filter-preview filter-cool"></span><span>冷色调</span></label>
          <label class="filter-card"><input type="radio" name="filter" value="warm"><span class="filter-preview filter-warm"></span><span>暖色调</span></label>
        </div>
        <div class="filter-desc" id="filterDesc">请选择一种滤镜效果</div>
        <button class="btn btn-primary btn-full" id="filterBtn">应用滤镜</button>
      </div>

      <div class="tab-panel" id="panel-cover">
        <div class="form-row">
          <div class="form-group">
            <label for="coverTime">截图时间点（秒）</label>
            <input type="number" id="coverTime" class="form-input" min="0" step="0.1" placeholder="例如 5.0">
          </div>
        </div>
        <p class="tab-panel-hint">切换到该功能时，会自动填入当前播放位置。</p>
        <button class="btn btn-primary btn-full" id="coverBtn">截取封面</button>
      </div>
    </section>

    <!-- 状态栏 -->
    <div class="status-bar" id="statusBar">
      <span class="status-dot" id="statusDot"></span>
      <span id="statusText">请先上传视频文件</span>
    </div>

    <!-- 进度条 -->
    <div class="progress-container" id="progressContainer" style="display:none">
      <div class="progress-bar">
        <div class="progress-fill" id="progressFill"></div>
      </div>
      <p class="progress-text" id="progressText">正在处理...</p>
    </div>

    <!-- 处理结果 -->
    <section class="result-section" id="resultSection" style="display:none">
      <div class="section-header">
        <h2>处理结果</h2>
      </div>
      <div class="result-preview" id="resultPreview"></div>
      <div class="result-actions">
        <button class="btn btn-primary" id="downloadBtn" style="display:none">下载结果</button>
      </div>
    </section>

    <!-- 页脚 -->
    <footer class="footer">
      <div class="footer-inner">
        <div class="footer-info">
          <p>所有视频处理均在浏览器本地完成，文件不会上传到任何服务器。</p>
          <p>建议使用 Chrome 或 Edge 最新版本以获取最佳体验。</p>
        </div>
        <div class="footer-tech">
          <span>HTML / CSS / JavaScript / FFmpeg.wasm / Supabase</span>
        </div>
      </div>
    </footer>

  </main>
</div>
  `;

  function renderMainPage(target) {
    if (typeof document === 'undefined') return;
    const mount = target || document.getElementById('appRoot') || document.body;
    mount.innerHTML = mainPageTemplate;
  }

  if (typeof document !== 'undefined') {
    renderMainPage();
  }

  return {
    renderMainPage,
    mainPageTemplate,
  };
});
