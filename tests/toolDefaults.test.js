const test = require('node:test');
const assert = require('node:assert/strict');

const ToolDefaults = require('../src/modules/toolDefaults.js');

function createElement(id, value) {
  return {
    id,
    value: value || '',
    checked: false,
    style: {},
    dataset: {},
    classList: {
      active: false,
      toggle(name, force) {
        if (name === 'active') this.active = Boolean(force);
      }
    },
    attributes: {},
    hidden: false,
    textContent: '',
    events: [],
    listeners: {},
    dispatchEvent(event) {
      this.events.push(event.type);
      (this.listeners[event.type] || []).forEach((handler) => handler(event));
    },
    addEventListener(type, handler) {
      if (!this.listeners[type]) this.listeners[type] = [];
      this.listeners[type].push(handler);
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    }
  };
}

function createDocument(activeTab) {
  const elements = {};
  const shortcutButtons = {};
  let currentTab = activeTab || '';

  ['tfFit', 'tcFormat', 'tcResolution', 'tcQuality', 'gifStart', 'gifDuration', 'gifWidth', 'gifFps'].forEach((id) => {
    elements[id] = createElement(id);
  });
  ['transform', 'transcode', 'gif'].forEach((tabName) => {
    shortcutButtons[tabName] = createElement('shortcut-' + tabName);
    shortcutButtons[tabName].dataset.toolDefault = tabName;
  });
  elements.presetPreviewState = createElement('presetPreviewState');
  elements.presetPreviewState.hidden = true;
  elements.videoContainer = createElement('videoContainer');
  elements.videoContainer.dataset.transformFit = '9:16';
  elements.videoContainer.dataset.presetPreview = 'short_vertical';
  elements.videoPlayer = createElement('videoPlayer');
  elements.videoPlayer.style.transform = 'rotate(90deg)';

  return {
    elements,
    defaultView: {
      Event: class FakeEvent {
        constructor(type) {
          this.type = type;
        }
      }
    },
    getElementById(id) {
      return elements[id] || null;
    },
    querySelector(selector) {
      if (selector === '.sidebar-item.tab.active') {
        return { dataset: { tab: currentTab } };
      }
      const tabMatch = selector.match(/\.sidebar-item\.tab\[data-tab="([^"]+)"\]/);
      if (tabMatch) {
        return {
          dataset: { tab: tabMatch[1] },
          click() {
            currentTab = tabMatch[1];
          }
        };
      }
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '[data-tool-default]') return Object.values(shortcutButtons);
      return [];
    }
  };
}

test('getToolDefault returns transform defaults', () => {
  const def = ToolDefaults.getToolDefault('transform');
  assert.deepEqual(def.fields, { tfFit: '9:16' });
});

test('getToolDefault returns null for unknown tools', () => {
  assert.equal(ToolDefaults.getToolDefault('missing'), null);
});

test('applyToolDefaultToDocument sets transcode fields and clears transform preview state', () => {
  const doc = createDocument('transcode');

  assert.equal(ToolDefaults.applyToolDefaultToDocument('transcode', doc), true);

  assert.equal(doc.elements.tcFormat.value, 'mp4');
  assert.equal(doc.elements.tcResolution.value, '720');
  assert.equal(doc.elements.tcQuality.value, 'medium');
  assert.deepEqual(doc.elements.tcFormat.events, ['input', 'change']);
  assert.equal(doc.elements.videoContainer.dataset.transformFit, undefined);
  assert.equal(doc.elements.videoContainer.dataset.presetPreview, undefined);
  assert.equal(doc.elements.videoContainer.dataset.toolPreview, 'transcode');
  assert.equal(doc.elements.videoPlayer.style.transform, '');
  assert.equal(doc.elements.videoPlayer.style.maxHeight, 'min(52vh, 360px)');
  assert.match(doc.elements.presetPreviewState.textContent, /MP4/);
  assert.match(doc.elements.presetPreviewState.textContent, /720p/);
});

test('syncToolPreview reflects changed gif fields', () => {
  const doc = createDocument('gif');
  doc.elements.gifStart.value = '1.5';
  doc.elements.gifDuration.value = '4.5';
  doc.elements.gifWidth.value = '320';
  doc.elements.gifFps.value = '15';

  assert.equal(ToolDefaults.syncToolPreview('gif', doc), true);

  assert.equal(doc.elements.videoContainer.dataset.toolPreview, 'gif');
  assert.equal(doc.elements.videoPlayer.style.maxWidth, 'min(100%, 320px)');
  assert.match(doc.elements.presetPreviewState.textContent, /1.5s/);
  assert.match(doc.elements.presetPreviewState.textContent, /4.5s/);
  assert.match(doc.elements.presetPreviewState.textContent, /320px/);
  assert.match(doc.elements.presetPreviewState.textContent, /15 fps/);
});

test('init updates gif preview when active gif fields change', () => {
  const doc = createDocument('gif');
  ToolDefaults.init(doc);

  doc.elements.gifWidth.value = '640';
  doc.elements.gifWidth.dispatchEvent({ type: 'change' });

  assert.equal(doc.elements.videoContainer.dataset.toolPreview, 'gif');
  assert.equal(doc.elements.videoPlayer.style.maxWidth, 'min(100%, 640px)');
  assert.match(doc.elements.presetPreviewState.textContent, /640px/);
});

test('init updates gif preview when active gif time fields change', () => {
  const doc = createDocument('gif');
  ToolDefaults.init(doc);

  doc.elements.gifStart.value = '2.2';
  doc.elements.gifStart.dispatchEvent({ type: 'input' });
  doc.elements.gifDuration.value = '6.8';
  doc.elements.gifDuration.dispatchEvent({ type: 'input' });

  assert.match(doc.elements.presetPreviewState.textContent, /2.2s/);
  assert.match(doc.elements.presetPreviewState.textContent, /6.8s/);
});

test('init updates transcode preview when active transcode fields change', () => {
  const doc = createDocument('transcode');
  ToolDefaults.init(doc);

  doc.elements.tcFormat.value = 'webm';
  doc.elements.tcFormat.dispatchEvent({ type: 'change' });
  doc.elements.tcResolution.value = '480';
  doc.elements.tcResolution.dispatchEvent({ type: 'change' });
  doc.elements.tcQuality.value = 'low';
  doc.elements.tcQuality.dispatchEvent({ type: 'change' });

  assert.equal(doc.elements.videoContainer.dataset.toolPreview, 'transcode');
  assert.equal(doc.elements.videoPlayer.style.maxHeight, 'min(42vh, 260px)');
  assert.match(doc.elements.presetPreviewState.textContent, /WEBM/);
  assert.match(doc.elements.presetPreviewState.textContent, /480p/);
});

test('init applies a shortcut default when an independent entry is clicked', () => {
  const doc = createDocument('trim');
  ToolDefaults.init(doc);

  const gifShortcut = doc.querySelectorAll('[data-tool-default]').find((btn) => btn.dataset.toolDefault === 'gif');
  gifShortcut.listeners.click[0]();

  assert.equal(doc.elements.gifWidth.value, '480');
  assert.equal(doc.elements.gifFps.value, '10');
  assert.equal(doc.elements.videoContainer.dataset.toolPreview, 'gif');
  assert.equal(gifShortcut.classList.active, true);
  assert.equal(gifShortcut.attributes['aria-pressed'], 'true');
});

test('syncToolPreview clears stale state for tools without preview hints', () => {
  const doc = createDocument('trim');

  assert.equal(ToolDefaults.syncToolPreview('trim', doc), false);

  assert.equal(doc.elements.videoContainer.dataset.transformFit, undefined);
  assert.equal(doc.elements.videoContainer.dataset.presetPreview, undefined);
  assert.equal(doc.elements.videoContainer.dataset.toolPreview, undefined);
  assert.equal(doc.elements.videoPlayer.style.transform, '');
  assert.equal(doc.elements.videoPlayer.style.maxWidth, '');
  assert.equal(doc.elements.videoPlayer.style.maxHeight, '');
  assert.equal(doc.elements.presetPreviewState.hidden, true);
});
