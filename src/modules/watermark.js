// 文字水印 + 图片水印/Logo 模块
// 文字水印：Canvas 渲染 PNG + FFmpeg overlay
// 图片水印：FFmpeg overlay + scale 缩放

const WatermarkModule = {
  _textInput: null,
  _fontSizeInput: null,
  _colorInput: null,
  _positionSelect: null,
  _btn: null,
  _modeRadios: null,
  _imageUpload: null,
  _imageScale: null,
  _imageOpacity: null,
  _currentImage: null,
  _imagePreview: null,

  _positionMap: {
    "top-left":     "top-left",
    "top-right":    "top-right",
    "bottom-left":  "bottom-left",
    "bottom-right": "bottom-right",
    "center":       "center",
  },

  init() {
    this._textInput = document.getElementById("wmText");
    this._fontSizeInput = document.getElementById("wmFontSize");
    this._colorInput = document.getElementById("wmColor");
    this._positionSelect = document.getElementById("wmPosition");
    this._btn = document.getElementById("watermarkBtn");
    this._modeRadios = document.querySelectorAll("input[name=\"wmMode\"]");
    this._imageUpload = document.getElementById("wmImageInput");
    this._imageScale = document.getElementById("wmImageScale");
    this._imageOpacity = document.getElementById("wmImageOpacity");
    this._imagePreview = document.getElementById("wmImagePreview");

    this._btn.addEventListener("click", () => this._handleWatermark());

    const self = this;
    this._modeRadios.forEach(function(radio) {
      radio.addEventListener("change", function() {
        var textSec = document.getElementById("wmTextSection");
        var imgSec = document.getElementById("wmImageSection");
        if (self._getMode() === "image") {
          textSec.style.display = "none";
          imgSec.style.display = "block";
        } else {
          textSec.style.display = "";
          imgSec.style.display = "none";
        }
      });
    });

    this._imageUpload.addEventListener("change", function(e) {
      if (e.target.files.length > 0) {
        self._currentImage = e.target.files[0];
        var url = URL.createObjectURL(self._currentImage);
        self._imagePreview.innerHTML = "<img src=\"" + url + "\" alt=\"水印图片预览\" style=\"max-width:100%;max-height:80px;border-radius:6px;\">";
      }
    });
  },

  validate(text) {
    if (!text || text.trim() === "") return "请输入水印文字";
    if (text.length > 50) return "水印文字过长，请适当缩短（不超过50字）";
    return null;
  },

  _getMode() {
    for (var i = 0; i < this._modeRadios.length; i++) {
      if (this._modeRadios[i].checked) return this._modeRadios[i].value;
    }
    return "text";
  },

  async _handleWatermark() {
    var mode = this._getMode();
    if (mode === "image") {
      return await this._handleImageWatermark();
    }
    return await this._handleTextWatermark();
  },

  _createWatermarkImage(text, fontSize, color, position, videoWidth, videoHeight) {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      canvas.width = videoWidth;
      canvas.height = videoHeight;
      const ctx = canvas.getContext("2d");

      ctx.clearRect(0, 0, videoWidth, videoHeight);

      ctx.font = "bold " + fontSize + "px \"Microsoft YaHei\", \"PingFang SC\", \"Noto Sans SC\", \"SimHei\", sans-serif";
      ctx.fillStyle = color;

      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      const metrics = ctx.measureText(text);
      const textWidth = metrics.width;
      const textHeight = fontSize;
      const padding = 16;

      let x, y;
      switch (position) {
        case "top-left":   x = padding; y = textHeight + padding; break;
        case "top-right":  x = videoWidth - textWidth - padding; y = textHeight + padding; break;
        case "bottom-left": x = padding; y = videoHeight - padding; break;
        case "bottom-right": x = videoWidth - textWidth - padding; y = videoHeight - padding; break;
        default: x = (videoWidth - textWidth) / 2; y = videoHeight / 2; break;
      }

      ctx.fillStyle = "rgba(0,0,0,0.35)";
      const boxPadding = 8;
      ctx.fillRect(x - boxPadding, y - textHeight - boxPadding + 4, textWidth + boxPadding * 2, textHeight + boxPadding * 2);

      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);

      canvas.toBlob(function(blob) {
        var reader = new FileReader();
        reader.onload = function() { resolve(new Uint8Array(reader.result)); };
        reader.readAsArrayBuffer(blob);
      }, "image/png");
    });
  },

  async _handleTextWatermark() {
    const file = Upload.getFile();
    if (!file) { Status.toast("请先上传视频文件", "warning"); return; }

    const text = this._textInput.value;
    const fontSize = parseInt(this._fontSizeInput.value) || 24;
    const color = this._colorInput.value;
    const position = this._positionSelect.value;

    const error = this.validate(text);
    if (error) { Status.toast(error, "error"); Status.setState("invalid", error); return; }

    const video = document.getElementById("videoPlayer");
    const videoWidth = video.videoWidth || 1280;
    const videoHeight = video.videoHeight || 720;

    Status.startProcessing();
    try {
      const inputData = await Upload.getFileData();
      const ext = Utils.getFileExtension(file.name);
      const inputName = "input_wm." + ext;
      const wmName = "watermark.png";
      const outputName = "watermark-video.mp4";

      const wmData = await this._createWatermarkImage(text.trim(), fontSize, color, position, videoWidth, videoHeight);

      await ffmpegService.load();
      await ffmpegService.writeFile(inputName, inputData);
      await ffmpegService.writeFile(wmName, wmData);
      await ffmpegService.run(["-i", inputName, "-i", wmName, "-filter_complex", "[0:v][1:v]overlay=0:0", "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-c:a", "copy", "-movflags", "+faststart", "-y", outputName]);

      const outputData = await ffmpegService.readFile(outputName);
      await ffmpegService.cleanup([inputName, wmName, outputName]);

      if (outputData.length < 1024) throw new Error("水印处理输出文件异常（文件过小）");

      const blob = new Blob([outputData], { type: "video/mp4" });
      App.showResult(blob, "video", "watermark-video.mp4", { operation: "watermark", params: { text: text.trim(), fontSize, color, position } });
      Status.handleSuccess("水印添加完成");
    } catch (err) { Status.handleError(err, "水印添加失败，请重试"); }
    finally { Status.endProcessing(); }
  },

  // 图片水印/Logo
  async _handleImageWatermark() {
    const file = Upload.getFile();
    if (!file) { Status.toast("请先上传视频文件", "warning"); return; }
    if (!this._currentImage) { Status.toast("请先选择水印图片", "warning"); return; }

    const position = this._positionSelect.value;
    var scale = parseInt(this._imageScale.value) || 20;
    var opacity = parseFloat(this._imageOpacity.value) || 1.0;

    Status.startProcessing();
    try {
      const inputData = await Upload.getFileData();
      const ext = Utils.getFileExtension(file.name);
      const inputName = "input_wm." + ext;

      const imgData = await new Promise(function(resolve, reject) {
        var reader = new FileReader();
        reader.onload = function() { resolve(new Uint8Array(reader.result)); };
        reader.onerror = reject;
        reader.readAsArrayBuffer(this._currentImage);
      }.bind(this));

      var imgExt = Utils.getFileExtension(this._currentImage.name) || "png";
      var imgName = "logo." + imgExt;
      var outputName = "watermark-image-video.mp4";

      await ffmpegService.load();
      await ffmpegService.writeFile(inputName, inputData);
      await ffmpegService.writeFile(imgName, imgData);

      var overlayX, overlayY;
      var pad = 16;
      switch (position) {
        case "top-left":      overlayX = pad; overlayY = pad; break;
        case "top-right":     overlayX = "W-w-" + pad; overlayY = pad; break;
        case "bottom-left":   overlayX = pad; overlayY = "H-h-" + pad; break;
        case "bottom-right":  overlayX = "W-w-" + pad; overlayY = "H-h-" + pad; break;
        case "center":        overlayX = "(W-w)/2"; overlayY = "(H-h)/2"; break;
        default:              overlayX = "W-w-" + pad; overlayY = "H-h-" + pad; break;
      }

      var scaleFilter = "scale=iw*" + (scale / 100) + ":-1";
      await ffmpegService.run(["-i", inputName, "-i", imgName, "-filter_complex", "[1:v]" + scaleFilter + "[logo];[0:v][logo]overlay=" + overlayX + ":" + overlayY, "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-c:a", "copy", "-movflags", "+faststart", "-y", outputName]);

      const outputData = await ffmpegService.readFile(outputName);
      await ffmpegService.cleanup([inputName, imgName, outputName]);

      if (outputData.length < 1024) throw new Error("图片水印处理输出文件异常");

      const blob = new Blob([outputData], { type: "video/mp4" });
      App.showResult(blob, "video", "watermark-image-video.mp4", { operation: "image_watermark", params: { position, scale, opacity, filename: this._currentImage.name } });
      Status.handleSuccess("图片水印添加完成");
    } catch (err) { Status.handleError(err, "图片水印添加失败，请重试"); }
    finally { Status.endProcessing(); }
  }
};
