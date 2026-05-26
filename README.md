# Video Editing System

浏览器端轻量级视频剪辑与多媒体处理系统。项目使用原生 HTML/CSS/JavaScript 和 FFmpeg.wasm，在本地浏览器中完成常见视频处理操作。

## 功能

- 本地视频上传与预览
- 视频片段裁剪
- 视频转 GIF
- 音频提取
- 文字水印
- 视频滤镜
- 封面截图
- 处理结果预览与下载

## 环境要求

- Node.js 18 或更高版本
- npm

## 安装与运行

```bash
npm install
node server.js
```

启动后访问：

```text
http://localhost:3000
```

本项目使用 FFmpeg.wasm，浏览器需要支持 `SharedArrayBuffer`。本地服务已设置必要的 COOP/COEP 响应头。

## 项目结构

```text
.
├── css/                 # 页面样式
├── doc/                 # 需求与设计文档
├── js/                  # 前端功能模块
├── index.html           # 页面入口
├── package.json         # npm 依赖
├── package-lock.json    # 依赖锁定文件
└── server.js            # 本地静态服务
```

## GitHub 协作者邀请

创建 GitHub 仓库后，仓库拥有者或管理员可以邀请协作者：

1. 打开 GitHub 仓库页面。
2. 进入 `Settings`。
3. 选择 `Collaborators and teams`。
4. 点击 `Add people`。
5. 输入对方 GitHub 用户名或邮箱并发送邀请。

如果使用 GitHub CLI，也可以在登录后运行：

```bash
gh api -X PUT repos/<owner>/<repo>/collaborators/<username> -f permission=push
```

其中 `<owner>` 是仓库拥有者，`<repo>` 是仓库名，`<username>` 是被邀请人的 GitHub 用户名。
