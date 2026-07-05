// 多段裁剪与拼接模块（FFmpeg concat）

const ConcatModule = {
  _segments: [],
  _listEl: null,
  _addBtn: null,
  _clearBtn: null,
  _btn: null,
  _startInput: null,
  _endInput: null,

  init() {
    this._listEl = document.getElementById("concatSegments");
    this._addBtn = document.getElementById("concatAddBtn");
    this._clearBtn = document.getElementById("concatClearBtn");
    this._btn = document.getElementById("concatBtn");
    this._startInput = document.getElementById("concatStart");
    this._endInput = document.getElementById("concatEnd");

    this._addBtn.addEventListener("click", () => this._addSegment());
    this._clearBtn.addEventListener("click", () => this._clearSegments());
    this._btn.addEventListener("click", () => this._handleConcat());
  },

  validate(start, end, duration) {
    if (isNaN(start) || start === "") return "请输入开始时间";
    if (isNaN(end) || end === "") return "请输入结束时间";
    if (start < 0) return "开始时间不能小于 0";
    if (end > duration) return "结束时间不能超过视频总时长";
    if (start >= end) return "开始时间必须小于结束时间";
    return null;
  },

  _addSegment() {
    var start = parseFloat(this._startInput.value);
    var end = parseFloat(this._endInput.value);
    var duration = Preview.getDuration();

    var error = this.validate(start, end, duration);
    if (error) { Status.toast(error, "error"); return; }

    this._segments.push({ start: start, end: end });
    this._renderSegments();
    this._startInput.value = end.toFixed(1);
    this._endInput.value = "";
    Status.toast("已添加第 " + this._segments.length + " 段裁剪", "success");
  },

  _removeSegment(index) {
    this._segments.splice(index, 1);
    this._renderSegments();
  },

  _clearSegments() {
    this._segments = [];
    this._renderSegments();
  },

  _renderSegments() {
    if (!this._listEl) return;
    if (this._segments.length === 0) {
      this._listEl.innerHTML = '<div class="concat-empty">尚未添加裁剪段，请填写时间点并点击「添加段」</div>';
      return;
    }

    var html = this._segments.map(function(seg, i) {
      return '<div class="concat-segment">' +
        '<span class="concat-seg-num">#' + (i + 1) + '</span>' +
        '<span class="concat-seg-time">' + seg.start.toFixed(1) + 's → ' + seg.end.toFixed(1) + 's （' + (seg.end - seg.start).toFixed(1) + 's）</span>' +
        '<button class="btn btn-sm btn-ghost btn-delete" data-concat-remove="' + i + '">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>';
    }).join("");

    this._listEl.innerHTML = html;
    var self = this;
    this._listEl.querySelectorAll("[data-concat-remove]").forEach(function(btn) {
      btn.addEventListener("click", function() { self._removeSegment(parseInt(btn.dataset.concatRemove)); });
    });
  },

  async _handleConcat() {
    const file = Upload.getFile();
    if (!file) { Status.toast("请先上传视频文件", "warning"); return; }
    if (this._segments.length < 2) { Status.toast("至少需要 2 段裁剪片段进行拼接", "warning"); return; }

    Status.startProcessing();
    try {
      const inputData = await Upload.getFileData();
      var ext = Utils.getFileExtension(file.name);
      var inputName = "input_concat." + ext;

      await ffmpegService.load();
      await ffmpegService.writeFile(inputName, inputData);

      // 生成 concat 列表文件
      var lines = [];
      var tempFiles = [inputName];

      for (var i = 0; i < this._segments.length; i++) {
        var seg = this._segments[i];
        var segName = "seg_" + i + "." + ext;
        var segDuration = seg.end - seg.start;

        // 先裁剪每个片段
        await ffmpegService.run(["-ss", seg.start.toString(), "-i", inputName, "-t", segDuration.toString(), "-c", "copy", "-y", segName]);
        tempFiles.push(segName);

        // 创建无封装的原始流文件用于 concat
        var rawName = "raw_" + i + ".ts";
        await ffmpegService.run(["-i", segName, "-c", "copy", "-bsf:v", "h264_mp4toannexb", "-f", "mpegts", "-y", rawName]);
        tempFiles.push(rawName);
        lines.push("file '" + rawName + "'");
      }

      var concatList = lines.join("\n");
      var listName = "concat_list.txt";
      const encoder = new TextEncoder();
      await ffmpegService.writeFile(listName, encoder.encode(concatList));
      tempFiles.push(listName);

      var outputName = "concat-video.mp4";
      await ffmpegService.run(["-f", "concat", "-safe", "0", "-i", listName, "-c", "copy", "-movflags", "+faststart", "-y", outputName]);

      const outputData = await ffmpegService.readFile(outputName);

      // 清理所有临时文件
      for (var j = 0; j < tempFiles.length; j++) {
        try { await ffmpegService.deleteFile(tempFiles[j]); } catch(e) {}
      }

      if (outputData.length < 1024) throw new Error("拼接输出文件异常");

      const blob = new Blob([outputData], { type: "video/mp4" });
      App.showResult(blob, "video", "concat-video.mp4", { operation: "concat", params: { segments: this._segments.length } });
      Status.handleSuccess("视频拼接完成");
    } catch (err) { Status.handleError(err, "视频拼接失败，请重试"); }
    finally { Status.endProcessing(); }
  }
};
