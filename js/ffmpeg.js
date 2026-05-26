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
    await this.ffmpeg.writeFile(name, data instanceof Uint8Array ? data : new Uint8Array(data));
  }

  async readFile(name) {
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

  async run(args) {
    this._clearLogs();
    const exitCode = await this.ffmpeg.exec(args);
    if (exitCode !== 0) {
      const lastLogs = this._logs.slice(-10).join('; ');
      throw new Error(`FFmpeg 退出码 ${exitCode}: ${lastLogs || '未知错误'}`);
    }
    return exitCode;
  }

  async cleanup(files) {
    for (const f of files) {
      await this.deleteFile(f);
    }
  }

  async process(inputFileName, inputData, args, outputFileName) {
    await this.load();
    await this.writeFile(inputFileName, inputData);
    await this.run(args);
    const outputData = await this.readFile(outputFileName);
    // 清理虚拟文件系统中的临时文件
    await this.cleanup([inputFileName, outputFileName]);
    // 额外清理可能的中间文件（如 palette）
    try { await this.deleteFile('palette.png'); } catch {}
    return outputData;
  }

  get isLoaded() {
    return this.loaded;
  }
}

const ffmpegService = new FFmpegService();
