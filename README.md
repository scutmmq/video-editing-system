# 轻量视频处理系统

一个浏览器端视频处理应用。前端直接在浏览器中通过 FFmpeg.wasm 完成转码、裁剪、滤镜等处理；Node.js 服务只负责静态资源分发，并提供 FFmpeg.wasm 运行所需的 COOP/COEP 响应头。

项目不依赖前端构建器或打包器，浏览器端模块通过普通 `<script>` 标签按顺序加载。登录、历史记录和素材库能力基于 Supabase；未配置 Supabase 时，核心本地处理功能仍可运行。

## 功能

| 模块 | 说明 |
| --- | --- |
| 视频裁剪 | 按起止时间截取片段，支持预览区快速取点 |
| GIF 转换 | 将指定片段转换为 GIF，支持宽度和帧率配置 |
| 音频提取 | 从视频导出 MP3 或 WAV |
| 文字水印 | 设置水印文本、字号、颜色和位置 |
| 视频滤镜 | 应用常用画面滤镜 |
| 封面截图 | 从指定时间点导出 PNG 封面 |
| 画面变换 | 旋转、翻转、缩放，以及横屏/竖屏适配 |
| 压缩转码 | 输出 MP4 或 WebM，支持分辨率和质量等级 |
| 播放速度 | 加速、减速或短视频倒放 |
| 音频调整 | 静音、音量调整、淡入淡出 |
| 处理预设 | 快速应用常用参数组合，并同步预览提示 |
| 处理历史 | 登录后保存处理任务和结果，支持预览、下载和重试 |
| 素材库 | 管理已保存素材，并可将视频素材重新载入工作流 |

## 技术边界

- 视频处理在浏览器本地执行，原始视频文件不会上传到应用服务器。
- Node.js 服务是静态文件服务器，不执行视频处理任务。
- FFmpeg.wasm 从本地 `node_modules` 资源加载，不依赖 CDN。
- SharedArrayBuffer 依赖 COOP/COEP 响应头，因此必须通过 `npm start` 或打包后的可执行文件访问，不能直接用 `file://` 打开 HTML。
- Supabase 仅用于认证、任务元数据和结果文件存储；浏览器端只能使用 publishable/anon key。

## 环境要求

- Node.js 20+
- npm
- 现代浏览器：Chrome / Edge / Firefox / Safari 的较新版本
- 可选：Supabase 项目，用于登录、历史记录和素材库
- 可选：Android 构建环境，用于 Capacitor APK 打包

## 快速开始

```bash
npm install
npm start
```

访问：

```text
http://localhost:3000
```

Windows PowerShell 如果拦截 `.ps1` 脚本，可以改用 `npm.cmd`：

```powershell
npm.cmd install
npm.cmd start
```

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm start` | 启动本地服务，默认监听 `http://localhost:3000` |
| `npm test` | 运行 Node 内置测试套件 |
| `npm run build` | 生成 Windows、Linux、macOS x64、macOS arm64 可执行文件 |
| `npm run build:exe:win` | 生成 Windows x64 可执行文件 |
| `npm run build:exe:linux` | 生成 Linux x64 可执行文件 |
| `npm run build:exe:mac` | 生成 macOS x64 可执行文件 |
| `npm run build:exe:mac-arm64` | 生成 macOS arm64 可执行文件 |
| `npm run build:webdir` | 组装 Capacitor Web 资源到 `www/` |
| `npm run cap:sync` | 生成 `www/` 并同步 Capacitor 项目 |
| `npm run build:apk` | 运行 Android APK 打包脚本 |

## 可执行文件构建

项目使用 `@yao-pkg/pkg` 将静态服务和前端资源打包为独立可执行文件。

```bash
npm run build
```

产物：

| 平台 | 输出文件 |
| --- | --- |
| Windows x64 | `dist/video-editing-system-win.exe` |
| Linux x64 | `dist/video-editing-system-linux` |
| macOS x64 | `dist/video-editing-system-macos` |
| macOS arm64 | `dist/video-editing-system-macos-arm64` |

单独构建某个平台时，运行对应的 `build:exe:*` 脚本即可。构建工具需要下载基础 Node.js 二进制，网络环境不稳定时建议先配置代理或使用已有缓存。

## Android 构建

Android 版本通过 Capacitor 将 Web 应用封装到 WebView 中。

```bash
npm run build:webdir
npm run cap:sync
npm run build:apk
```

产物位置通常为：

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

更完整的 Android 构建说明见 [docs/android-build-guide.md](docs/android-build-guide.md)。

## Supabase 配置

主页面通过 `src/index.html` 中的 meta 标签读取 Supabase 公开配置：

```html
<meta name="supabase-url" content="https://<project-ref>.supabase.co">
<meta name="supabase-publishable-key" content="<publishable-or-anon-key>">
```

注意：

- 只允许在浏览器端使用 publishable/anon key。
- 不要把 `service_role` key 写入 HTML、JavaScript、文档或示例环境文件。
- 实际授权依赖 Supabase Auth、RLS、Storage policy 和数据库迁移。

## 数据库迁移

`supabase/migrations/` 是数据库结构、RLS、函数、触发器和 Storage policy 的来源。

常用流程：

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push --dry-run
npx supabase db push
```

如果远端数据库有手动变更，先拉取并生成迁移，再继续开发：

```bash
npx supabase db pull
```

Windows PowerShell 环境可使用 `npx.cmd`。

## 架构概览

```text
Browser
  ├─ UI modules loaded by src/index.html
  ├─ FFmpeg.wasm processing in browser memory
  ├─ Supabase client for auth/history/assets
  └─ Local file input/output

Node server
  ├─ Static file serving
  ├─ / -> src/index.html
  ├─ /login.html -> src/pages/login.html
  └─ COOP/COEP headers for SharedArrayBuffer

Supabase
  ├─ Auth
  ├─ Postgres metadata
  └─ Storage result files
```

浏览器端没有模块打包流程。新增页面模块时，需要在 `src/index.html` 中按依赖顺序加入 `<script>`，并在 `src/modules/app.js` 中初始化或接入。

可测试的模块采用 UMD 形式，同时支持浏览器全局变量和 Node `require()`。测试集中覆盖纯逻辑、服务封装、参数校验和部分处理链路。

## 项目结构

```text
.
├── server.js                      # 静态服务和 COOP/COEP 响应头
├── package.json                   # npm 脚本、pkg 资源配置
├── package-lock.json
├── Dockerfile
├── run.sh
├── start.bat
├── capacitor.config.json
├── docs/
│   └── android-build-guide.md
├── doc/                           # 需求、架构、技术债等项目文档
├── scripts/
│   ├── build-webdir.js
│   ├── build-apk.bat
│   └── inject-mirrors.js
├── src/
│   ├── index.html
│   ├── assets/
│   ├── vendor/
│   ├── auth/
│   ├── config/
│   ├── pages/
│   ├── modules/
│   ├── services/
│   └── styles/
├── tests/
└── supabase/
    ├── config.toml
    └── migrations/
```

## 测试

```bash
npm test
```

测试使用 Node 内置 `node --test`，重点覆盖：

- 登录和 JWT 解析
- Supabase service 封装
- 处理参数校验
- FFmpeg service 行为
- 预设、转码、变换、速度和音频调整逻辑

目前没有完整的浏览器端 FFmpeg 集成测试。涉及 UI、上传、预览或真实视频处理的改动，应通过本地服务在浏览器中手动验证。

## 运行注意事项

- 建议先用较小视频验证处理流程，再处理长视频或高分辨率素材。
- 大文件、4K 视频和长时长视频会显著增加浏览器内存占用和处理时间。
- 登录后处理结果可以写入 Supabase Storage；原始输入视频不会自动上传。
- 如果端口被占用，可以通过 `PORT=<port> npm start` 指定端口。
