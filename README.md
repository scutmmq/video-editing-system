# 轻量级视频剪辑与多媒体处理系统

浏览器端视频处理工具，使用原生 HTML/CSS/JavaScript、FFmpeg.wasm 和 Supabase Auth。视频处理在本地浏览器内完成，登录能力通过 Supabase 提供。

## 功能

- 本地视频上传与预览
- 视频片段裁剪
- 视频转 GIF
- 音频提取（MP3/WAV）
- 文字水印
- 视频滤镜
- 封面截图
- 处理结果预览与下载
- Supabase 邮箱/密码登录
- Supabase session `jwtToken` 格式与过期时间校验

## 环境要求

- Node.js 20 或更高版本
- 现代浏览器：Chrome 96+、Edge 96+、Firefox 109+

## 快速启动

### Windows

双击运行 `start.bat`。脚本会检查依赖并启动本地服务。

### 命令行

```bash
npm install
npm run start
```

启动后访问：

```text
http://localhost:3000
```

如果 PowerShell 禁止执行 `npm.ps1`，请使用：

```bash
npm.cmd install
npm.cmd run start
```

## 测试

```bash
npm test
```

PowerShell 受执行策略限制时使用：

```bash
npm.cmd test
```

## 打包发布

本项目可以打包为 Linux x64 可执行文件，再上传到云服务器构建 Docker 镜像运行。云服务器地址和目录如下：

```text
root@119.23.76.234:/root/DockerFile/video-editing-system
```

服务器登录密码请向管理员获取。

### 本地打包

在项目根目录执行：

```bash
npm install
npm run build:exe:linux
```

打包完成后会生成：

```text
dist/video-editing-system-linux
```

### 首次上传部署文件

首次部署需要上传可执行文件、`Dockerfile` 和 `run.sh`：

```bash
scp .\dist\video-editing-system-linux .\Dockerfile .\run.sh root@119.23.76.234:/root/DockerFile/video-editing-system/
```

### 后续更新可执行文件

如果 `Dockerfile` 和 `run.sh` 没有变化，后续只需要重新打包并上传可执行文件：

```bash
npm run build:exe:linux
scp .\dist\video-editing-system-linux root@119.23.76.234:/root/DockerFile/video-editing-system
```

### 服务器构建并运行镜像

登录云服务器后执行：

```bash
cd /root/DockerFile/video-editing-system
chmod +x run.sh video-editing-system-linux
./run.sh
```

默认访问地址：

```text
http://119.23.76.234:3000
```

## 项目结构

```text
.
├── index.html                  # 页面入口，只负责挂载页面和加载脚本
├── server.js                   # 本地静态服务，设置 FFmpeg.wasm 所需响应头
├── start.bat                   # Windows 一键启动脚本
├── src/
│   ├── auth/
│   │   ├── auth.js             # 登录、注册、退出和 session 校验
│   │   └── jwtToken.js         # jwtToken 解析、格式校验和过期校验
│   ├── config/
│   │   └── supabaseClient.js   # Supabase 浏览器客户端初始化
│   ├── modules/
│   │   ├── app.js              # 主控制器
│   │   ├── ffmpeg.js           # FFmpeg.wasm 封装
│   │   ├── upload.js           # 视频上传
│   │   ├── preview.js          # 视频预览
│   │   ├── trim.js             # 视频裁剪
│   │   ├── gif.js              # GIF 转换
│   │   ├── audio.js            # 音频提取
│   │   ├── watermark.js        # 文字水印
│   │   ├── filter.js           # 视频滤镜
│   │   ├── cover.js            # 封面截取
│   │   ├── status.js           # 状态与进度提示
│   │   └── utils.js            # 通用工具函数
│   ├── pages/
│   │   └── mainPage.js         # 页面结构模板
│   └── styles/
│       └── style.css           # 页面样式
├── tests/
│   └── auth.test.js            # Auth 和 jwtToken 单元测试
└── supabase/
    ├── config.toml
    └── migrations/             # 数据库迁移
```

## Supabase 配置

浏览器端只允许使用公开 publishable key，不能把 service role key 写入 `index.html`、JavaScript 或文档示例。

当前页面从 `index.html` 的 meta 标签读取配置：

```html
<meta name="supabase-url" content="https://<project-ref>.supabase.co">
<meta name="supabase-publishable-key" content="<publishable-public-key>">
```

本地记录可复制 `.env.example` 为 `.env.local`，但静态页面不会自动读取 `.env.local`。

## Supabase 迁移

数据库变更保存在 `supabase/migrations/`。不要把 Dashboard 手动改表当作唯一来源。

```bash
npx.cmd supabase login
npx.cmd supabase link --project-ref <project-ref>
npx.cmd supabase db push
```

如果远端数据库已经在 Dashboard 手动改过，先拉取结构：

```bash
npx.cmd supabase db pull
```

macOS/Linux 或全局 CLI 可使用等价的 `supabase ...` 命令。

## jwtToken 校验

登录成功后，`src/auth/auth.js` 会读取 Supabase session 的 `access_token`，并通过 `src/auth/jwtToken.js` 校验：

- token 必须是三段式 JWT 格式
- payload 必须能被解析为 JSON
- payload 必须包含有效的 `exp`
- `exp` 必须晚于当前时间

这属于前端会话状态校验，用于避免 UI 接受无效或过期的 session。真正的数据访问权限仍应依赖 Supabase Auth、RLS policy 和后端校验。

## 注意事项

- 建议视频文件不超过 500MB，文件过大会显著增加处理时间和内存压力。
- FFmpeg.wasm 依赖本地服务提供的 COOP/COEP 响应头，请通过 `npm run start` 访问，不要直接双击打开 HTML。
- 视频处理在浏览器本地完成，原始视频不会上传到应用服务器。
