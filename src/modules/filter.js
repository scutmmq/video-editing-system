// 视频滤镜模块

const FilterModule = {
  _btn: null,
  _descEl: null,
  _selectedFilter: null,

  _filters: {
    grayscale: { name: '黑白', desc: '将视频画面转换为灰度效果', vf: 'hue=s=0' },
    blur:     { name: '模糊', desc: '对视频画面进行模糊处理', vf: 'boxblur=10:1' },
    brighten: { name: '亮度增强', desc: '提高视频画面的整体亮度', vf: 'eq=brightness=0.15' },
    darken:   { name: '亮度降低', desc: '降低视频画面的整体亮度', vf: 'eq=brightness=-0.15' },
    contrast: { name: '对比度增强', desc: '增强画面明暗对比', vf: 'eq=contrast=1.5' },
    hflip:    { name: '镜像翻转', desc: '将视频画面水平翻转', vf: 'hflip' },
    vintage:  { name: '复古效果', desc: '让视频画面呈现偏旧的暖黄色调', vf: "curves=r='0/0.11 .42/.51 1/0.95':g='0/0 0.50/0.48 1/1':b='0/0.22 .49/.44 1/0.8'" },
    cool:     { name: '冷色调', desc: '让视频画面偏蓝、偏冷', vf: 'colorbalance=rs=0:gs=0:bs=0.3' },
    warm:     { name: '暖色调', desc: '让视频画面偏黄、偏暖', vf: 'colorbalance=rs=0.3:gs=0:bs=-0.3' },
  },

  init() {
    this._btn = document.getElementById('filterBtn');
    this._descEl = document.getElementById('filterDesc');

    document.querySelectorAll('input[name="filter"]').forEach(radio => {
      radio.addEventListener('change', () => {
        this._selectedFilter = radio.value;
        const info = this._filters[this._selectedFilter];
        this._descEl.textContent = info ? `${info.name}：${info.desc}` : '请选择一种滤镜效果';
      });
    });

    this._btn.addEventListener('click', () => this._handleFilter());
  },

  async _handleFilter() {
    const file = Upload.getFile();
    if (!file) {
      Status.toast('请先上传视频文件', 'warning');
      return;
    }

    if (!this._selectedFilter) {
      Status.toast('请先选择滤镜效果', 'warning');
      Status.setState('invalid', '请先选择滤镜效果');
      return;
    }

    const filter = this._filters[this._selectedFilter];
    if (!filter) {
      Status.toast('所选的滤镜不支持', 'error');
      return;
    }

    Status.startProcessing();

    try {
      const inputData = await Upload.getFileData();
      const ext = Utils.getFileExtension(file.name);
      const inputName = 'input_filter.' + ext;
      const outputName = 'filter-video.mp4';

      const args = [
        '-i', inputName,
        '-vf', filter.vf,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'copy',
        '-movflags', '+faststart',
        '-y', outputName
      ];

      const outputData = await ffmpegService.process(inputName, inputData, args, outputName);
      const blob = new Blob([outputData], { type: 'video/mp4' });

      App.showResult(blob, 'video', 'filter-video.mp4', { operation: 'filter', params: { filter: this._selectedFilter } });
      Status.handleSuccess(filter.name + '滤镜应用完成');
    } catch (err) {
      Status.handleError(err, '滤镜处理失败，请重试');
    } finally {
      Status.endProcessing();
    }
  }
};
