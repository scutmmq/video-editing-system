# 轻量级视频剪辑与多媒体处理系统

浏览器端视频处理工具，使用原生 HTML/CSS/JavaScript 和 FFmpeg.wasm，所有处理在本地浏览器中完成，无需上传文件到服务器。

## 功能

- 本地视频上传与预览
- 视频片段裁剪
- 视频转 GIF
- 音频提取（MP3/WAV）
- 文字水印
- 视频滤镜（黑白、模糊、亮度、对比度、镜像、复古、冷暖色调）
- 封面截图
- 处理结果预览与下载

## 环境要求

- **Node.js** 18 或更高版本（[下载地址](https://nodejs.org/zh-cn/)）

## 快速启动

### Windows 用户

双击运行 `start.bat`，会自动安装依赖并启动服务器。

### 命令行

```bash
npm install
node server.js
```

启动后访问 **http://localhost:3000**。

> 如果 npm 下载速度慢，可以先用国内镜像：
> ```bash
> npm config set registry https://registry.npmmirror.com
> npm install
> ```

## 项目结构

```
.
├── css/                 # 页面样式
├── js/                  # 前端功能模块
│   ├── app.js           # 主控制器
│   ├── ffmpeg.js        # FFmpeg.wasm 封装
│   ├── upload.js        # 视频上传
│   ├── preview.js       # 视频预览
│   ├── trim.js          # 视频裁剪
│   ├── gif.js           # GIF 转换
│   ├── audio.js         # 音频提取
│   ├── watermark.js     # 文字水印
│   ├── filter.js        # 视频滤镜
│   ├── cover.js         # 封面截取
│   ├── status.js        # 状态提示
│   └── utils.js         # 工具函数
├── index.html           # 页面入口
├── package.json         # npm 依赖
├── server.js            # 本地静态服务（含 COOP/COEP 头）
└── start.bat            # Windows 一键启动
```

## 注意事项

- 文件大小建议不超过 500MB，过大会导致处理时间较长
- 所有处理在浏览器本地完成，视频不会上传到任何服务器
- 需要现代浏览器（Chrome 96+、Edge 96+、Firefox 109+）
- 本项目使用 FFmpeg.wasm，本地服务已设置必要的 COOP/COEP 响应头以支持 SharedArrayBuffer
