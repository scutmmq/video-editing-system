// 工具函数模块

const Utils = {
  formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const s = Math.floor(seconds);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    const pad = (n) => String(n).padStart(2, '0');
    if (hrs > 0) return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    return `${pad(mins)}:${pad(secs)}`;
  },

  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    if (i === 0) return bytes + ' B';
    return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + units[i];
  },

  getFileExtension(filename) {
    return filename.split('.').pop().toLowerCase();
  },

  isValidVideoFile(file) {
    const validTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
    const validExts = ['mp4', 'webm', 'mov', 'avi', 'mkv'];
    if (validTypes.includes(file.type)) return true;
    const ext = Utils.getFileExtension(file.name);
    return validExts.includes(ext);
  },

  isLargeFile(file, maxMB = 500) {
    return file.size > maxMB * 1024 * 1024;
  },

  sanitizeFilename(name) {
    return name.replace(/[^a-zA-Z0-9一-鿿._-]/g, '_');
  },

  debounce(fn, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  // 从 HTML5 video 获取视频时长
  getVideoDuration(video) {
    return video.duration || 0;
  },

  // 获取当前播放时间
  getCurrentTime(video) {
    return video.currentTime || 0;
  }
};
