// 历史记录元数据映射（纯函数，可在 Node 下单测）
// 负责：操作 → 结果 kind、kind → Storage 桶、Storage 路径、参数摘要。

(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.HistoryMeta = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  // 操作名 → media_assets.kind（须与迁移里的 check 约束一致）
  const OPERATION_KIND = {
    trim: 'trimmed_video',
    gif: 'gif',
    extract_audio: 'audio',
    watermark: 'watermarked_video',
    filter: 'filtered_video',
    capture_cover: 'cover_image',
    transform: 'transformed_video',
    transcode: 'transcoded_video',
    speed: 'speed_video',
    audio_adjust: 'audio_adjusted_video',
    image_watermark: 'watermarked_video',
    audio_mix: 'audio_mixed_video',
    concat: 'concatenated_video',
    subtitle_burn: 'subtitled_video',
  };

  // 非视频结果放 media-derived（桶只允许 gif/png/音频），其余视频放 media-results
  const DERIVED_KINDS = new Set(['gif', 'audio', 'cover_image']);

  function resultKindForOperation(operation) {
    return OPERATION_KIND[operation] || null;
  }

  function bucketForKind(kind) {
    if (!kind) return null;
    return DERIVED_KINDS.has(kind) ? 'media-derived' : 'media-results';
  }

  function buildStoragePath(userId, projectId, assetId, filename) {
    if (!userId || !projectId || !assetId || !filename) {
      throw new Error('storage 路径缺少必要片段');
    }
    return `${userId}/${projectId}/${assetId}/${filename}`;
  }

  // 答辩用的"参数摘要"：把一次处理的关键参数压成一行人类可读文本
  function summarizeParams(operation, params) {
    const p = params || {};
    switch (operation) {
      case 'trim':
        return `${p.start ?? 0}s → ${p.end ?? 0}s`;
      case 'gif':
        return `${p.start ?? 0}s 起 / ${p.duration ?? 0}s / ${p.width ?? '?'}px / ${p.fps ?? '?'}fps`;
      case 'extract_audio':
        return `输出 ${String(p.format || '').toUpperCase()}`;
      case 'watermark':
        return `“${p.text || ''}” @ ${p.position || ''}`;
      case 'filter':
        return `滤镜 ${p.filter || ''}`;
      case 'capture_cover':
        return `${p.time ?? 0}s 处截帧`;
      case 'transform': {
        const bits = [];
        if (p.rotate && p.rotate !== '0') bits.push(`旋转${p.rotate}°`);
        if (p.hflip) bits.push('水平翻转');
        if (p.vflip) bits.push('垂直翻转');
        if (p.scale && p.scale !== 'none') bits.push(`缩放${p.scale}`);
        if (p.fit && p.fit !== 'none') bits.push(`适配${p.fit}`);
        return bits.join(' / ') || '画面变换';
      }
      case 'transcode':
        return `${String(p.format || '').toUpperCase()} / ${p.resolution || 'keep'} / ${p.quality || ''}`;
      case 'speed':
        return p.reverse ? '倒放' : `${p.speed || ''}x`;
      case 'audio_adjust': {
        if (p.mute) return '静音';
        const bits = [];
        if (Number(p.volumeDb)) bits.push(`音量${p.volumeDb}dB`);
        if (Number(p.fadeIn)) bits.push(`淡入${p.fadeIn}s`);
        if (Number(p.fadeOut)) bits.push(`淡出${p.fadeOut}s`);
        return bits.join(' / ') || '音频调整';
      }
      
      case 'image_watermark':
        return '“' + (p.filename || '') + '” @ ' + (p.position || '');
      case 'audio_mix': {
        const mode = p.mode || 'mix';
        if (mode === 'replace') return '替换音频';
        if (mode === 'background') return '背景音乐';
        return '混音';
      }
      case 'concat':
        return (p.segments ? p.segments + ' 段' : '') + ' 拼接';
      case 'subtitle_burn':
        return (p.filename || '') + ' 字幕烧录';
default:
        try {
          return JSON.stringify(p);
        } catch (_err) {
          return '';
        }
    }
  }

  return {
    OPERATION_KIND,
    resultKindForOperation,
    bucketForKind,
    buildStoragePath,
    summarizeParams,
  };
});
