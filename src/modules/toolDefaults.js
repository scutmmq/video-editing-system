// Tool defaults: shortcut entries, first-use defaults, and live preview hints.
(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.ToolDefaults = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const DEFAULTS = {
    transform: {
      fields: { tfFit: '9:16' },
      previewKind: null
    },
    transcode: {
      fields: {
        tcFormat: 'mp4',
        tcResolution: '720',
        tcQuality: 'medium'
      },
      previewKind: 'transcode'
    },
    gif: {
      fields: {
        gifWidth: '480',
        gifFps: '10'
      },
      previewKind: 'gif'
    }
  };

  const QUALITY_LABELS = {
    high: '高质量',
    medium: '中等质量',
    low: '高压缩'
  };

  const RESOLUTION_MAX_HEIGHT = {
    keep: '',
    '1080': 'min(56vh, 400px)',
    '720': 'min(52vh, 360px)',
    '480': 'min(42vh, 260px)'
  };

  function getToolDefault(tabName) {
    return DEFAULTS[tabName] || null;
  }

  function getValue(doc, id, fallback) {
    const el = doc && doc.getElementById(id);
    return el ? el.value : fallback;
  }

  function dispatchFormEvents(doc, el) {
    const EventCtor = (doc && doc.defaultView && doc.defaultView.Event) || Event;
    el.dispatchEvent(new EventCtor('input', { bubbles: true }));
    el.dispatchEvent(new EventCtor('change', { bubbles: true }));
  }

  function setField(doc, id, value) {
    const el = doc.getElementById(id);
    if (!el) return false;

    if (el.type === 'checkbox') {
      el.checked = Boolean(value);
    } else {
      el.value = String(value);
    }
    dispatchFormEvents(doc, el);
    return true;
  }

  function buildPreviewText(tabName, doc) {
    if (tabName === 'gif') {
      const start = getValue(doc, 'gifStart', '0') || '0';
      const duration = getValue(doc, 'gifDuration', '3') || '3';
      const width = getValue(doc, 'gifWidth', '480');
      const fps = getValue(doc, 'gifFps', '10');
      return 'GIF 预览：' + start + 's 起 · ' + duration + 's · ' + width + 'px · ' + fps + ' fps';
    }

    if (tabName === 'transcode') {
      const format = getValue(doc, 'tcFormat', 'mp4').toUpperCase();
      const resolution = getValue(doc, 'tcResolution', '720');
      const quality = getValue(doc, 'tcQuality', 'medium');
      const resolutionText = resolution === 'keep' ? '原分辨率' : resolution + 'p';
      return '压缩预览：' + format + ' · ' + resolutionText + ' · ' + (QUALITY_LABELS[quality] || quality);
    }

    return '';
  }

  function resetVideoPreviewStyle(video) {
    if (!video) return;
    video.style.transform = '';
    video.style.transformOrigin = '';
    video.style.maxWidth = '';
    video.style.maxHeight = '';
  }

  function clearPreview(doc) {
    if (!doc) return;
    const container = doc.getElementById('videoContainer');
    const video = doc.getElementById('videoPlayer');
    const stateEl = doc.getElementById('presetPreviewState');

    resetVideoPreviewStyle(video);

    if (container) {
      delete container.dataset.transformFit;
      delete container.dataset.presetPreview;
      delete container.dataset.toolPreview;
      container.style.maxWidth = '';
    }

    if (stateEl) {
      stateEl.hidden = true;
      stateEl.textContent = '';
    }

    syncShortcutButtons(doc, '');
  }

  function syncShortcutButtons(doc, tabName) {
    if (!doc || !doc.querySelectorAll) return;
    doc.querySelectorAll('[data-tool-default]').forEach(function (btn) {
      const active = btn.dataset.toolDefault === tabName;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function applyVisualPreview(tabName, doc) {
    const video = doc.getElementById('videoPlayer');
    if (!video) return;

    if (tabName === 'gif') {
      const width = getValue(doc, 'gifWidth', '480');
      video.style.maxWidth = 'min(100%, ' + width + 'px)';
      video.style.maxHeight = '';
      return;
    }

    if (tabName === 'transcode') {
      const resolution = getValue(doc, 'tcResolution', '720');
      video.style.maxWidth = '';
      video.style.maxHeight = RESOLUTION_MAX_HEIGHT[resolution] || '';
    }
  }

  function syncToolPreview(tabName, doc) {
    const d = doc || document;

    if (tabName === 'transform' && typeof TransformModule !== 'undefined' && TransformModule.syncPreview) {
      TransformModule.syncPreview(d);
      syncShortcutButtons(d, tabName);
      return true;
    }

    clearPreview(d);
    const def = getToolDefault(tabName);
    if (!def || !def.previewKind) return false;

    const container = d.getElementById('videoContainer');
    const stateEl = d.getElementById('presetPreviewState');
    if (container) container.dataset.toolPreview = def.previewKind;
    applyVisualPreview(tabName, d);

    if (stateEl) {
      stateEl.hidden = false;
      stateEl.textContent = buildPreviewText(tabName, d);
    }
    syncShortcutButtons(d, tabName);
    return true;
  }

  function applyToolDefaultToDocument(tabName, doc) {
    const d = doc || document;
    const def = getToolDefault(tabName);
    if (!def) {
      syncToolPreview(tabName, d);
      return false;
    }

    Object.keys(def.fields).forEach(function (fieldId) {
      setField(d, fieldId, def.fields[fieldId]);
    });

    syncToolPreview(tabName, d);
    return true;
  }

  function getActiveTool(doc) {
    const active = doc.querySelector('.sidebar-item.tab.active');
    return active ? active.dataset.tab : '';
  }

  function switchToTool(doc, tabName) {
    const tab = doc.querySelector('.sidebar-item.tab[data-tab="' + tabName + '"]');
    if (tab && typeof tab.click === 'function') tab.click();
  }

  function bindPreviewFields(doc, tabName, ids) {
    ids.forEach(function (id) {
      const el = doc.getElementById(id);
      if (!el) return;
      const handler = function () {
        if (getActiveTool(doc) === tabName) syncToolPreview(tabName, doc);
      };
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
    });
  }

  function init(doc) {
    const d = doc || document;
    bindPreviewFields(d, 'gif', ['gifStart', 'gifDuration', 'gifWidth', 'gifFps']);
    bindPreviewFields(d, 'transcode', ['tcFormat', 'tcResolution', 'tcQuality']);

    d.querySelectorAll('[data-tool-default]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const tabName = btn.dataset.toolDefault;
        switchToTool(d, tabName);
        const ok = applyToolDefaultToDocument(tabName, d);
        if (ok && typeof Status !== 'undefined' && Status.toast) {
          Status.toast('已应用处理预设，可继续调整参数或开始处理', 'success');
        }
      });
    });
  }

  return {
    getToolDefault,
    buildPreviewText,
    applyToolDefaultToDocument,
    syncToolPreview,
    clearPreview,
    syncShortcutButtons,
    init
  };
});
