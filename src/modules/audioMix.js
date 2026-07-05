// 音频替换 / 混音 / 背景音乐模块（FFmpeg amix / amerge）

const AudioMixModule = {
  _modeRadios: null,
  _audioInput: null,
  _volumeInput: null,
  _btn: null,
  _currentAudio: null,

  init() {
    this._modeRadios = document.querySelectorAll('input[name="amMode"]');
    this._audioInput = document.getElementById("amAudioInput");
    this._volumeInput = document.getElementById("amVolume");
    this._btn = document.getElementById("audioMixBtn");

    this._btn.addEventListener("click", () => this._handleAudioMix());

    const self = this;
    this._modeRadios.forEach(function(radio) {
      radio.addEventListener("change", function() {
        var info = document.getElementById("amAudioInfo");
        if (self._getMode() === "extract") {
          document.getElementById("amUploadSection").style.display = "none";
          info.textContent = "将直接替换原视频音频轨为无声";
        } else {
          document.getElementById("amUploadSection").style.display = "";
          if (self._getMode() === "replace") {
            info.textContent = "上传音频文件替换原视频的音频轨";
          } else if (self._getMode() === "background") {
            info.textContent = "上传背景音乐，与原视频音频混合";
          } else {
            info.textContent = "上传音频文件，与原视频音频混合";
          }
        }
      });
    });

    this._audioInput.addEventListener("change", function(e) {
      if (e.target.files.length > 0) {
        self._currentAudio = e.target.files[0];
        info.textContent = "已选择: " + self._currentAudio.name;
      }
    });
  },

  _getMode() {
    for (var i = 0; i < this._modeRadios.length; i++) {
      if (this._modeRadios[i].checked) return this._modeRadios[i].value;
    }
    return "mix";
  },

  async _handleAudioMix() {
    const file = Upload.getFile();
    if (!file) { Status.toast("请先上传视频文件", "warning"); return; }

    var mode = this._getMode();
    var volumeDb = parseFloat(this._volumeInput.value) || 0;

    if (mode !== "extract" && !this._currentAudio) {
      Status.toast("请先上传音频文件", "warning"); return;
    }

    Status.startProcessing();
    try {
      const inputData = await Upload.getFileData();
      var ext = Utils.getFileExtension(file.name);
      var inputName = "input_am." + ext;
      var outputName = "audio-mix-video.mp4";

      await ffmpegService.load();
      await ffmpegService.writeFile(inputName, inputData);

      var args;

      if (mode === "extract") {
        // 替换为无声（移除音频轨）
        args = ["-i", inputName, "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-an", "-movflags", "+faststart", "-y", outputName];
      } else {
        // 读取上传的音频
        const audioData = await new Promise(function(resolve, reject) {
          var r = new FileReader();
          r.onload = function() { resolve(new Uint8Array(r.result)); };
          r.onerror = reject;
          r.readAsArrayBuffer(this._currentAudio);
        }.bind(this));

        var audioExt = Utils.getFileExtension(this._currentAudio.name) || "mp3";
        var audioName = "input_audio." + audioExt;
        await ffmpegService.writeFile(audioName, audioData);

        var volFilter = (volumeDb !== 0) ? ",volume=" + volumeDb + "dB" : "";

        if (mode === "replace") {
          // 替换音频轨
          args = ["-i", inputName, "-i", audioName, "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-c:a", "aac", "-shortest", "-map", "0:v:0", "-map", "1:a:0" + volFilter, "-movflags", "+faststart", "-y", outputName];
        } else if (mode === "background") {
          // 背景音乐：原音音量不变，背景音压低
          var bgVol = (volumeDb !== 0) ? "volume=" + volumeDb + "dB" : "volume=0.3";
          args = ["-i", inputName, "-i", audioName, "-filter_complex", "[1:a]" + bgVol + "[bga];[0:a][bga]amix=inputs=2:duration=first:dropout_transition=2", "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-c:a", "aac", "-shortest", "-movflags", "+faststart", "-y", outputName];
        } else {
          // 混音：两个音频混合
          var mixVol = (volumeDb !== 0) ? ",volume=" + volumeDb + "dB" : "";
          args = ["-i", inputName, "-i", audioName, "-filter_complex", "[0:a][1:a]amix=inputs=2:duration=first:dropout_transition=2" + mixVol, "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-c:a", "aac", "-shortest", "-movflags", "+faststart", "-y", outputName];
        }
      }

      await ffmpegService.run(args);
      const outputData = await ffmpegService.readFile(outputName);
      await ffmpegService.cleanup([inputName, outputName]);
      if (mode !== "extract") await ffmpegService.deleteFile("input_audio.*");

      if (outputData.length < 1024) throw new Error("音频处理输出文件异常");

      const blob = new Blob([outputData], { type: "video/mp4" });
      var modeLabel = mode === "extract" ? "移除音频" : (mode === "replace" ? "替换音频" : (mode === "background" ? "背景音乐" : "混音"));
      App.showResult(blob, "video", "audio-mix-video.mp4", { operation: "audio_mix", params: { mode: mode, volumeDb: volumeDb } });
      Status.handleSuccess(modeLabel + "完成");
    } catch (err) { Status.handleError(err, "音频处理失败，请重试"); }
    finally { Status.endProcessing(); }
  }
};
