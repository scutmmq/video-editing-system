# 轻量级视频剪辑与多媒体处理系统

浏览器端视频处理工具，基于原生 HTML/CSS/JavaScript + FFmpeg.wasm + Supabase。所有视频处理在本地浏览器完成，支持用户登录与云端历史同步。

## 功能

| 模块 | 说明 |
|------|------|
| 视频裁剪 | 设置起止时间，精确裁切片段 |
| 转 GIF | 截取片段转为动图 |
| 音频提取 | 导出 MP3 / WAV |
| 文字水印 | 自定义文字、大小、颜色、位置 |
| 视频滤镜 | 亮度/对比度/饱和度等 |
| 封面截图 | 当前帧导出 PNG |
| 画面变换 | 旋转 / 翻转 / 缩放 / 横竖屏适配 |
| 压缩转码 | MP4(兼容) 或 WebM(小体积)，多分辨率、多质量 |
| 播放速度 | 变速 / 倒放 |
| 音频调整 | 静音 / 音量 / 淡入淡出 |
| 处理历史 | 登录后自动同步云端，支持预览与下载回看 |

## 环境要求

- **Node.js** ≥ 20
- **浏览器**：Chrome 96+ / Edge 96+ / Firefox 109+
- **打包 Android**（额外）：JDK 21 + Android SDK 35+

## 快速启动

```bash
npm install
npm start
```

浏览器访问 `http://localhost:3000`。Windows 也可双击 `start.bat`。

> PowerShell 禁止执行 `.ps1` 时请用 `npm.cmd` 代替 `npm`。

## NPM 脚本

| 命令 | 用途 |
|------|------|
| `npm start` | 启动本地开发服务器 |
| `npm test` | 运行单元测试 |
| `npm run build:webdir` | 组装 Web 资源到 `www/` |
| `npm run cap:sync` | 构建 Web 资源 + 同步到 Android 项目 |
| `npm run build:apk` | 一键打包 Android APK |
| `npm run build:exe:linux` | 打包 Linux 可执行文件 |
| `npm run build:exe:win` | 打包 Windows 可执行文件 |

## 打包发布

### Android APK

通过 Capacitor 将 Web 应用嵌入 WebView，打包为原生 APK。

```bash
# 首次需初始化 Android 项目
npx cap add android

# 每次打包（一键）
npm run build:apk
```

产物：`android/app/build/outputs/apk/debug/app-debug.apk`

> 首次编译会下载 Gradle 及 Android SDK 依赖，耗时较长；后续增量构建秒级完成。Gradle 已配置腾讯云镜像，无需代理。
>
> 详细说明见 [docs/android-build-guide.md](docs/android-build-guide.md)。

### Linux 可执行文件（云服务器部署）

打包为独立可执行文件，通过 Docker 部署到云服务器。

```bash
npm run build:exe:linux
```

产物：`dist/video-editing-system-linux`（约 140MB）

**上传到云服务器**：

```bash
# 首次（包含 Dockerfile、run.sh）
scp .\dist\video-editing-system-linux .\Dockerfile .\run.sh root@119.23.76.234:/root/DockerFile/video-editing-system/

# 后续更新（仅可执行文件）
scp .\dist\video-editing-system-linux root@119.23.76.234:/root/DockerFile/video-editing-system
```

**服务器端运行**：

```bash
ssh root@119.23.76.234
cd /root/DockerFile/video-editing-system
chmod +x run.sh video-editing-system-linux
./run.sh
# 访问 http://119.23.76.234:3000
```

## 项目结构

```text
.
├── server.js                        # 本地静态服务（COOP/COEP 响应头）
├── start.bat                        # Windows 一键启动
├── capacitor.config.json            # Capacitor 配置
├── Dockerfile / run.sh              # 云服务器部署
├── docs/
│   └── android-build-guide.md       # Android 打包详细指南
├── scripts/
│   ├── build-webdir.js              # 组装 Web 资源到 www/
│   └── build-apk.bat                # 一键打包 APK
├── src/
│   ├── index.html                   # 入口页
│   ├── assets/                      # 图标 / manifest
│   ├── vendor/supabase.js           # Supabase SDK（本地副本）
│   ├── auth/
│   │   ├── auth.js                  # 登录/注册/退出
│   │   └── jwtToken.js              # JWT 解析与校验
│   ├── config/supabaseClient.js     # Supabase 客户端初始化
│   ├── pages/
│   │   ├── mainPage.js              # 页面结构模板
│   │   └── login.html               # 登录页
│   ├── modules/
│   │   ├── app.js                   # 主控制器
│   │   ├── ffmpeg.js                # FFmpeg.wasm 封装
│   │   ├── upload.js                # 视频上传
│   │   ├── preview.js               # 视频预览
│   │   ├── trim.js                  # 裁剪
│   │   ├── gif.js                   # GIF 转换
│   │   ├── audio.js                 # 音频提取
│   │   ├── audioAdjust.js           # 音频调整
│   │   ├── watermark.js             # 文字水印
│   │   ├── filter.js                # 滤镜
│   │   ├── cover.js                 # 封面截图
│   │   ├── transform.js             # 画面变换
│   │   ├── transcode.js             # 压缩转码
│   │   ├── speed.js                 # 变速/倒放
│   │   ├── history.js               # 处理历史
│   │   ├── confirmDialog.js         # 确认弹窗组件
│   │   ├── status.js                # 状态提示
│   │   └── utils.js                 # 工具函数
│   ├── services/
│   │   ├── assetService.js          # 资源管理
│   │   ├── historyMeta.js           # 历史元数据
│   │   ├── jobService.js            # 任务服务
│   │   ├── projectService.js        # 项目服务
│   │   └── storageService.js        # 存储服务
│   └── styles/style.css             # 样式
├── tests/                           # 单元测试
└── supabase/
    ├── config.toml
    └── migrations/                  # 数据库迁移
```

## Supabase 配置

应用从 `index.html` meta 标签读取 Supabase 公开配置：

```html
<meta name="supabase-url" content="https://<project-ref>.supabase.co">
<meta name="supabase-publishable-key" content="<publishable-key>">
```

> ⚠️ 浏览器端只能使用 publishable key，严禁写入 `service_role` key。

## 数据库迁移

```bash
npx.cmd supabase login
npx.cmd supabase link --project-ref <project-ref>

# 预览变更
npx.cmd supabase db push --dry-run

# 应用迁移
npx.cmd supabase db push
```

远端已有手动修改时，先拉取再写迁移：

```bash
npx.cmd supabase db pull
```

## 注意事项

- 建议视频 ≤ 500MB，文件过大会增加处理时间和内存压力。
- 必须通过 `npm start` 访问，FFmpeg.wasm 依赖服务端 COOP/COEP 响应头（SharedArrayBuffer）。
- 视频处理全程在浏览器本地完成，原始文件不上传。
