// 字幕烧录模块（FFmpeg subtitles 滤镜）

const SubtitleModule = {
  _fileInput: null,
  _positionSelect: null,
  _fontSizeInput: null,
  _btn: null,
  _currentFile: null,

  init() {
    this._fileInput = document.getElementById("subFileInput");
    this._positionSelect = document.getElementById("subPosition");
    this._fontSizeInput = document.getElementById("subFontSize");
    this._btn = document.getElementById("subtitleBtn");

    this._btn.addEventListener("click", () => this._handleSubtitle());

    var self = this;
    this._fileInput.addEventListener("change", function(e) {
      if (e.target.files.length > 0) {
        self._currentFile = e.target.files[0];
        var infoEl = document.getElementById("subFileInfo");
        if (infoEl) infoEl.textContent = "已选择: " + self._currentFile.name + " (" + Utils.formatFileSize(self._currentFile.size) + ")";
      }
    });
  },

  async _handleSubtitle() {
    const file = Upload.getFile();
    if (!file) { Status.toast("请先上传视频文件", "warning"); return; }
    if (!this._currentFile) { Status.toast("请先选择 SRT / VTT 字幕文件", "warning"); return; }

    var position = this._positionSelect.value;
    var fontSize = parseInt(this._fontSizeInput.value) || 24;

    Status.startProcessing();
    try {
      const inputData = await Upload.getFileData();
      var ext = Utils.getFileExtension(file.name);
      var inputName = "input_sub." + ext;

      // 读取字幕文件
      const subData = await new Promise(function(resolve, reject) {
        var r = new FileReader();
        r.onload = function() { resolve(new Uint8Array(r.result)); };
        r.onerror = reject;
        r.readAsArrayBuffer(this._currentFile);
      }.bind(this));

      var subExt = Utils.getFileExtension(this._currentFile.name) || "srt";
      var subName = "subtitles." + subExt;
      var outputName = "subtitle-video.mp4";

      await ffmpegService.load();
      await ffmpegService.writeFile(inputName, inputData);
      await ffmpegService.writeFile(subName, subData);

      // subtitles 滤镜需要绝对路径或相对路径
      // FFmpeg.wasm 中文件都在虚拟文件系统中，直接用文件名
      var subFilter = "subtitles=" + subName + ":force_style='FontSize=" + fontSize;

      if (position === "bottom") {
        subFilter += ",Alignment=2'";
      } else if (position === "top") {
        subFilter += ",Alignment=8'";
      } else {
        subFilter += "'";
      }

      await ffmpegService.run(["-i", inputName, "-vf", subFilter, "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-c:a", "copy", "-movflags", "+faststart", "-y", outputName]);

      const outputData = await ffmpegService.readFile(outputName);
      await ffmpegService.cleanup([inputName, subName, outputName]);

      if (outputData.length < 1024) throw new Error("字幕烧录输出文件异常");

      const blob = new Blob([outputData], { type: "video/mp4" });
      App.showResult(blob, "video", "subtitle-video.mp4", { operation: "subtitle_burn", params: { filename: this._currentFile.name, position: position, fontSize: fontSize } });
      Status.handleSuccess("字幕烧录完成");
    } catch (err) { Status.handleError(err, "字幕烧录失败，请查验字幕文件格式后重试"); }
    finally { Status.endProcessing(); }
  }
};
