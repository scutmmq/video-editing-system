// FFmpeg.wasm 封装模块

class FFmpegService {
  constructor() {
    this.ffmpeg = null;
    this.loading = false;
    this.loaded = false;
    this.loadPromise = null;
    this._logs = [];
  }

  _collectLog(msg) {
    this._logs.push(msg);
    if (this._logs.length > 50) this._logs.shift();
  }

  _clearLogs() {
    this._logs = [];
  }

  async load() {
    if (this.loaded) return;
    if (this.loading) return this.loadPromise;

    this.loading = true;
    this.loadPromise = (async () => {
      // 兼容可能的全局变量名
      const FFmpegWasmLib = window.FFmpegWASM || window.FFmpegWasm;
      if (!FFmpegWasmLib) {
        throw new Error('FFmpeg.wasm 库未加载，请检查网络后刷新页面');
      }

      const { FFmpeg } = FFmpegWasmLib;
      this.ffmpeg = new FFmpeg();

      this.ffmpeg.on('log', ({ message }) => {
        console.log('[FFmpeg]', message);
        this._collectLog(message);
      });

      this.ffmpeg.on('progress', ({ progress }) => {
        const percent = Math.min(100, Math.round(progress * 100));
        document.dispatchEvent(new CustomEvent('ffmpeg-progress', { detail: { percent } }));
      });

      // 从本地 node_modules 加载 core
      await this.ffmpeg.load({
        coreURL: '/node_modules/@ffmpeg/core/dist/umd/ffmpeg-core.js',
      });

      this.loaded = true;
      this.loading = false;
      console.log('FFmpeg.wasm 加载完成');
    })();

    try {
      await this.loadPromise;
    } catch (err) {
      this.loading = false;
      this.loadPromise = null;
      console.error('FFmpeg.wasm 加载失败:', err);
      const detail = (err && err.message) ? err.message : String(err);
      throw new Error('视频处理引擎加载失败: ' + detail);
    }
  }

  async writeFile(name, data) {
    if (typeof name !== 'string' || name.length === 0) {
      throw new Error('FFmpeg writeFile: 文件名无效');
    }
    await this.ffmpeg.writeFile(name, data instanceof Uint8Array ? data : new Uint8Array(data));
  }

  async readFile(name) {
    if (typeof name !== 'string' || name.length === 0) {
      throw new Error('FFmpeg readFile: 文件名无效');
    }
    const data = await this.ffmpeg.readFile(name);
    if (data instanceof Uint8Array) return data;
    if (data && data.data instanceof Uint8Array) return data.data;
    return new Uint8Array(data);
  }

  async deleteFile(name) {
    try {
      await this.ffmpeg.deleteFile(name);
    } catch {
      // ignore
    }
  }

  async run(args, timeout = -1) {
    if (!Array.isArray(args) || !args.every(function (a) { return typeof a === 'string'; })) {
      throw new Error('FFmpeg run: 参数必须是字符串数组');
    }
    if (!this.ffmpeg) {
      throw new Error('called FFmpeg.terminate()');
    }
    this._clearLogs();
    // timeout：毫秒，-1 不限时。超时由 FFmpeg 核心中止，避免坏文件永久卡死
    const exitCode = await this.ffmpeg.exec(args, timeout);
    if (exitCode !== 0) {
      const lastLogs = this._logs.slice(-10).join('; ');
      throw new Error(`FFmpeg 退出码 ${exitCode}: ${lastLogs || '未知错误'}`);
    }
    return exitCode;
  }

  /**
   * 取消当前处理：终止 worker 并重置状态，下次 process() 会自动重新加载。
   * 进行中的 exec/run 会因 worker 被终止而 reject（错误信息含 "terminate"）。
   */
  cancel() {
    if (this.ffmpeg) {
      try { this.ffmpeg.terminate(); } catch { /* ignore */ }
    }
    this.ffmpeg = null;
    this.loaded = false;
    this.loading = false;
    this.loadPromise = null;
  }

  async cleanup(files) {
    for (const f of files) {
      await this.deleteFile(f);
    }
  }

  async process(inputFileName, inputData, args, outputFileName, opts) {
    const timeout = (opts && typeof opts.timeout === 'number') ? opts.timeout : -1;
    await this.load();
    try {
      await this.writeFile(inputFileName, inputData);
      await this.run(args, timeout);
      return await this.readFile(outputFileName);
    } finally {
      // 无论成功/失败/取消都清理，避免临时文件在 MEMFS 累积导致内存溢出
      await this.cleanup([inputFileName, outputFileName]);
      try { await this.deleteFile('palette.png'); } catch {}
    }
  }

  get isLoaded() {
    return this.loaded;
  }
}

const ffmpegService = new FFmpegService();
