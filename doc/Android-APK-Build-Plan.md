# 视频编辑系统打包安卓 APK 执行计划（v2 修正版）

> 本版基于对当前代码与 FFmpeg.wasm 引擎的实测结论重写，修正了 v1 中会导致**白屏 / 功能全崩 / 方向带偏**的若干硬伤。
>
> **v1 的主要错误（已修正）**：
> 1. `webDir: 'src'` 与项目的绝对路径冲突 → 打包后白屏（v1 未提"web 资源组装"这一关键步骤）。
> 2. 未说明 **`server.js` 在 APK 里根本不运行**（路由映射与 COOP/COEP 头全部失效）。
> 3. 夸大 SharedArrayBuffer / COOP-COEP 风险，且给的 Java WebSettings 方案**无法**开启 cross-origin isolation。
> 4. 把已**停止维护**的 `ffmpeg-kit` 当"终极方案"，且 `@ffmpeg-kit/react-native` 是 React Native 包，本项目（Capacitor + 原生 JS）用不了。
> 5. `node_modules` 默认不会进包，未说明需显式复制 FFmpeg 的 core/wasm。

---

## 0. 一句话定位

把现有的**纯浏览器端**视频编辑器（HTML/CSS/JS + FFmpeg.wasm + Supabase）用 **Capacitor** 冻结进一个 Android WebView，做成可直接安装的 APK。**视频处理 100% 在手机本地完成，不依赖任何自建后端。**

---

## 1. 已验证的关键前提（务必先读）

在动手打包前，已用诊断梯（standalone harness + 真实模块）在浏览器里实测，结论如下：

| 验证项 | 结果 |
| --- | --- |
| `@ffmpeg/ffmpeg@0.12.15` + `@ffmpeg/core@0.12.10` 加载 | ✅ 成功 |
| `-version` / lavfi 生成 / 解码+缩放+重编码 | ✅ exit 0 |
| 真实 **trim** 参数（libx264 + aac + faststart） | ✅ 产物正常 |
| 真实 **gif** 两遍 palette 流程 | ✅ 产物正常 |
| 真实 `ffmpegService.process()`（含 buffer transfer） | ✅ 产物正常 |
| 核心是否单线程 / 是否需要 SharedArrayBuffer | **单线程，不需要 SAB** |

**结论：**
- 处理引擎**当前是健康的**，之前的 `memory access out of bounds` 来自重装依赖前的旧版本状态，已随版本钉定（`package.json` 已去掉 `^`，锁定 `core 0.12.10 / ffmpeg 0.12.15`）解决。
- 因为是**单线程核心**，APK 里**不需要** COOP/COEP / SharedArrayBuffer —— v1 关于这块的大段风险与 Java 方案可忽略。
- 日志里偶发的 `[stderr] Aborted()` 是 emscripten 退出时的良性噪音，不是崩溃。

> ⚠️ 唯一仍需现场确认的是**你的真实视频文件**：超大文件（wasm32 内存上限）或特殊编码（如部分 HEVC）可能单独出问题。这属于 input 级别的个案，不影响整体打包，见 §7 风险。

---

## 2. APK 运行时依赖关系（最重要）

```
┌─────────────────────── Android APK（手机本地）───────────────────────┐
│                                                                      │
│   Capacitor 原生壳                                                    │
│   └── WebView + 内置本地静态服务（伺服打包进来的 www/）                  │
│        ├── index.html / login.html / src/*  ← 全部打进 APK            │
│        ├── @ffmpeg/ffmpeg + @ffmpeg/core(.wasm) ← 全部打进 APK         │
│        └── 视频处理：在 WebView 内本地运行，0 网络依赖 ✅               │
│                                                                      │
│   仅「登录 / 历史 / 云存储」时，直连 ↓                                  │
└──────────────────────────────────────────────────────────────────────┘
                                   │ HTTPS（要网）
                                   ▼
                    Supabase 云  (wwqgixluxlegrttyhrgy.supabase.co)
                    Auth / Storage / Postgres

  ❌ 不涉及你的自建服务器 119.23.76.234（见 §8）
```

| 功能 | APK 里依赖谁 | 断网可用 |
| --- | --- | --- |
| 本地视频处理（裁剪/GIF/转码/水印/滤镜/变换/变速/音频…） | 无，纯本地 | ✅ |
| 登录 / 历史记录 / 结果上云 | Supabase 云 | ❌ |
| 加载 supabase-js 库 | 目前 CDN，**建议本地化**（§4.4） | 本地化后 ✅ |

**关键结论：**
- **`server.js` 不参与 APK 运行。** 它只在「网页版」里托管静态文件 + 设头。APK 由 Capacitor 自带的本地服务伺服资源。
- APK 唯一的"后端"是 **Supabase 云**，且仅用于登录/历史。可选做"游客模式"让断网也能纯本地剪辑（§4.6）。

---

## 3. 开发环境准备

| 工具 | 版本 | 说明 |
| --- | --- | --- |
| Node.js | ≥ 18（你当前 22.x ✅） | 跑 Capacitor CLI |
| JDK | **17**（Temurin/Adoptium） | Gradle 编译需要 |
| Android Studio | 最新稳定版 | 自带 SDK / 模拟器；省心 |
| Android SDK | Platform **API 34**，Build-Tools 34 | 安装 Studio 时勾选 |
| Capacitor | **7.x**（当前主流，非 v1 写的 6.x） | `@capacitor/core /cli /android` |

**环境变量（Windows PowerShell）：**
```powershell
[Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
[Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Eclipse Adoptium\jdk-17", "User")
# 重开终端后验证：
adb --version
java -version
```

---

## 4. 项目适配（本项目的真正工作量）

### 4.1 web 资源组装：`www/`（v1 漏掉的关键步骤）

**问题根因**：`src/index.html` 在 `src/` 下，但内部引用全是从根算的绝对路径（`/src/...`、`/node_modules/@ffmpeg/...`、`/login.html`）。这套路径只在 `server.js` 把仓库根当 web 根时才成立。Capacitor 的 webDir 必须是一个 **index.html 在根、所有路径都能就地解析** 的单一目录。

**方案**：写一个组装脚本，产出干净的 `www/`，让那些绝对路径在 www 根下原样成立——**`src/` 源码一行不用改**。

目标结构：
```
www/
├── index.html                       ← 复制自 src/index.html
├── login.html                       ← 复制自 src/pages/login.html（兜住 /login.html 链接）
├── src/ …                           ← 整个 src 复制过来（/src/... 命中）
└── node_modules/@ffmpeg/
    ├── ffmpeg/dist/umd/             ← ffmpeg.js + 814.ffmpeg.js
    └── core/dist/umd/               ← ffmpeg-core.js + ffmpeg-core.wasm
```

**新建 `scripts/build-webdir.js`：**
```js
// 组装 Capacitor webDir：把仓库根的绝对路径资源拍平到 www/ 下
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WWW = path.join(ROOT, 'www');

function rmrf(p) { fs.rmSync(p, { recursive: true, force: true }); }
function cp(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

rmrf(WWW);
fs.mkdirSync(WWW, { recursive: true });

// 1) 整个 src
cp(path.join(ROOT, 'src'), path.join(WWW, 'src'));
// 2) 入口页放到 www 根
cp(path.join(ROOT, 'src', 'index.html'), path.join(WWW, 'index.html'));
cp(path.join(ROOT, 'src', 'pages', 'login.html'), path.join(WWW, 'login.html'));
// 3) 只复制 FFmpeg 必需文件（别整包 node_modules，否则 APK 暴涨）
cp(path.join(ROOT, 'node_modules/@ffmpeg/ffmpeg/dist/umd'),
   path.join(WWW, 'node_modules/@ffmpeg/ffmpeg/dist/umd'));
cp(path.join(ROOT, 'node_modules/@ffmpeg/core/dist/umd'),
   path.join(WWW, 'node_modules/@ffmpeg/core/dist/umd'));

console.log('[build-webdir] www/ 组装完成');
```

> 注意：`login.html` 里 `href="/"` 在 APK 里指向 www 根（主应用），未登录会被 authGuard 弹回登录页，符合预期。

### 4.2 安装 Capacitor 并初始化

```powershell
npm.cmd install @capacitor/core @capacitor/cli @capacitor/android
npm.cmd run build:webdir   # 见 §4.5 脚本
npx.cmd cap init "Video Editor" "com.videoeditor.app" --web-dir www
npx.cmd cap add android
```

**`capacitor.config.json`（用 JSON 即可，项目无 TS 构建）：**
```json
{
  "appId": "com.videoeditor.app",
  "appName": "Video Editor",
  "webDir": "www",
  "server": { "androidScheme": "https" }
}
```
> 不需要 v1 里的 `cleartext: true` / `allowMixedContent`：Supabase 是 HTTPS，本地资源走 `https://localhost`，无需明文。`allowNavigation` 也非必需（应用内不跳转外站，Supabase 走 fetch）。

### 4.3 删掉对 COOP/COEP 的依赖（已无需）

单线程核心不需要 SharedArrayBuffer。`src/modules/ffmpeg.js` 当前只传 `coreURL`、未用多线程，**无需任何改动**。v1 里那段 `MainActivity.java` 改 WebSettings 的方案**不要做**（既无效也无必要）。

### 4.4 supabase-js 本地化（去 CDN）

`index.html` 和 `login.html` 都用 `cdn.jsdelivr.net` 加载 supabase-js。APK 首次启动若无网会卡登录。改为打包本地文件：

1. 取本地副本（任选其一）：
   - 用已装的 `@supabase/supabase-js` 的 UMD 产物，或
   - 下载 `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2` 存为 `src/vendor/supabase.js`。
2. 两个页面把
   `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>`
   改成
   `<script src="/src/vendor/supabase.js"></script>`。
3. 重新 `npm run build:webdir`。

> 这是 §4 里唯一需要改 `src/` 源码的地方（两个 `<script>` 标签 + 新增一个 vendor 文件），网页版同样受益。

### 4.5 加构建脚本（`package.json` → scripts）

```jsonc
{
  "build:webdir": "node scripts/build-webdir.js",
  "cap:sync": "npm run build:webdir && npx cap sync android",
  "cap:open": "npx cap open android",
  "build:apk": "npm run cap:sync && cd android && gradlew.bat assembleDebug",
  "build:apk:release": "npm run cap:sync && cd android && gradlew.bat assembleRelease"
}
```
> Windows 用 `gradlew.bat`（PowerShell 里也可 `.\gradlew`），**不是** v1 写的 `./gradlew`。

### 4.6（可选）游客模式：让断网也能纯本地剪辑

当前 `authGuard.js` 在 Supabase 已配置时，未登录会强制跳登录页。若希望"不登录也能用本地功能、仅历史/云存储需要登录"，可在 authGuard 增加一个开关（如本地存储 `guestMode`）跳过强制跳转。**属于 UX 增强，非打包必需，可二期再做。**

### 4.7 应用图标

把 `src/assets/` 现有图标接入 Android 资源（`android/app/src/main/res/mipmap-*`）。推荐用 `@capacitor/assets` 自动生成：
```powershell
npm.cmd install -D @capacitor/assets
# 准备一张 1024x1024 源图（已有 app-icon-1024.png），按其文档生成各密度图标
```

---

## 5. Android 工程配置

### 5.1 权限（`android/app/src/main/AndroidManifest.xml`）

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```
> **不要**照搬 v1 的 `READ/WRITE_EXTERNAL_STORAGE`：Android 13+（API 33+）已废弃，且本应用下载结果用 WebView 的下载/分享或 `@capacitor/filesystem` 即可，无需旧存储权限。

### 5.2 下载/保存结果到手机

当前 `App.download()` 用 `<a download>` 触发浏览器下载。WebView 里需要接管 `DownloadListener`，或更稳妥地改用 **`@capacitor/filesystem` + `@capacitor/share`** 把结果写入应用目录并唤起系统分享/另存。建议二期接入插件；一期可先验证处理本身，下载用 WebView 默认行为测试。

### 5.3 网络安全配置

Supabase 全程 HTTPS，**默认配置即可**，无需 v1 的 `network_security_config.xml` / `usesCleartextTraffic`。除非将来要连**明文 HTTP**（如自建 media-proxy 走 http://119.23.76.234），那时再加白名单。

---

## 6. 编译、安装、调试

```powershell
# 一键：组装 www → cap sync → 编 debug apk
npm.cmd run build:apk
# 产物：android/app/build/outputs/apk/debug/app-debug.apk

# 装到手机（开启 USB 调试后）
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

**WebView 远程调试**：手机连电脑 → Chrome 打开 `chrome://inspect` → 选中 WebView 进程，可像调网页一样看 console / network。这是排查 APK 内问题的主要手段。

**日志**：`adb logcat | findstr /i "Capacitor chromium"`（Windows 用 `findstr`，非 `grep`）。

### Release 签名（上架/正式分发时）
按 v1 §4.3 的 keystore + `build.gradle` signingConfigs 配置即可（这部分 v1 没错）。`key.properties` / `*.jks` **务必加入 `.gitignore`，不要提交**。

---

## 7. 风险与对策（修正版）

| 风险 | 真实情况 / 对策 |
| --- | --- |
| **大文件 OOM** | wasm32 单线程内存有上限（约 2GB）。对策：限制输入体积（如 ≤100MB）、必要时先降分辨率、给出友好报错而非崩溃。**这是最现实的风险。** |
| **特定编码不支持** | 个别 HEVC/罕见容器可能解不动。对策：现场用真实文件测试；必要时提示用户转码后再处理。 |
| **首启需网（登录/CDN）** | 已在 §4.4 本地化 supabase-js；登录本身仍需网（除非做 §4.6 游客模式）。 |
| ~~SharedArrayBuffer 不支持~~ | **不适用**：单线程核心不需要 SAB。 |
| **APK 体积** | 含 ffmpeg-core.wasm（~32MB），预计 40–60MB。可用 `minifyEnabled`/`shrinkResources` 或 `.aab` 优化。 |
| **性能偏慢** | wasm 比原生慢。一期可接受（课程演示）；确实嫌慢见 §9 附录。 |

---

## 8. 与自建云服务器 119.23.76.234 的关系

- **网页版**：继续部署在 `119.23.76.234`（`node server.js`，或 Docker），浏览器访问。APK 与它**互不依赖、可并存**。
- **APK 版**：独立安装包，运行时**不连** 119.23.76.234，只在登录/历史时连 Supabase 云。
- 共用同一份 `src/` 代码：改一次，网页版重启即生效；APK 需重新 `npm run cap:sync` 打包。
- 仅当你将来启用 **media-proxy**（远程 URL 视频，目前未接入 `server.js`）时，APK 才会需要一个代理后端——那时可把 media-proxy 接到 119.23.76.234 或 Supabase Edge Function，并在 §5.3 放行其域名。

---

## 9. 附录：原生 FFmpeg（二期可选，谨慎）

若 wasm 性能确实不够：
- ⚠️ **`ffmpeg-kit` 已于 2025 年初由作者正式退役**，二进制下架，不建议新项目依赖；且它面向 RN/原生，**不**适配 Capacitor + 原生 JS 架构。
- 可行路线是找**仍在维护的 Capacitor 原生视频处理插件**，或自写一个桥接原生 FFmpeg 的 Capacitor 插件，并把 `src/modules/*` 的处理层抽象成「可切换 wasm / 原生」的后端。**工作量大、风险高**，仅在一期 APK 跑通且明确瓶颈后再评估。

---

## 10. 落地步骤清单（建议执行顺序）

1. 装 JDK 17 + Android Studio（含 API 34 SDK），配 `ANDROID_HOME` / `JAVA_HOME`。
2. 新建 `scripts/build-webdir.js`，加 `package.json` 脚本，跑 `npm run build:webdir` 验证 `www/` 正确。
3. supabase-js 本地化（§4.4）。
4. 装 Capacitor → `cap init`（webDir=www）→ `cap add android`。
5. 配权限/图标（§5.1、§4.7）。
6. `npm run build:apk` → `adb install` → 真机用**真实视频**逐项测试（§7 重点测大文件）。
7. （可选）`@capacitor/filesystem` 接管下载、游客模式、Release 签名。

---

**文档版本：** v2（修正版）  **最后更新：** 2026-05-29
**适用项目：** 浏览器端轻量级视频剪辑与多媒体处理系统（Capacitor 打包 Android）
