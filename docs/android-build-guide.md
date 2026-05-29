# Node.js → Android APK 构建指南

## 一、整体原理

本项目核心是纯前端 Web 应用（HTML/CSS/JS + FFmpeg.wasm + Supabase Auth），通过 [Capacitor](https://capacitorjs.com/) 将 Web 应用嵌入 Android WebView 原生壳，打包为 APK。

```
  src/*.html, src/*.js, src/*.css  (Web 源码)
        │
        ▼  npm run build:webdir
        │
   www/   (拍平后的 Web 资源)
        │
        ▼  npx cap sync
        │
   android/app/src/main/assets/public/  (注入 Android 项目)
        │
        ▼  gradlew assembleDebug
        │
   app-debug.apk  ← 最终产物
```

> Capacitor 将 `www/` 下的静态文件打包进 APK，运行时 WebView 直接从 APK 内部加载，无需网络服务。

---

## 二、环境准备（一次性）

| 工具 | 路径 | 要求 |
|------|------|------|
| Node.js | 系统 PATH | ≥ 20 |
| JDK | `E:\develop\jdk21` | **必须是 JDK 21** |
| Android SDK | `E:\develop\Android\Sdk` | SDK 35/36 |

### 验证环境

```powershell
node -v                                # v20.x+
E:\develop\jdk21\bin\java -version     # 21.x
dir E:\develop\Android\Sdk\platforms   # 应有 android-36
```

### 已安装的 Java 版本（本机）

| 路径 | 版本 | 可用 |
|------|------|------|
| `E:\develop\jdk21` | JDK 21 | ✅ |
| `E:\develop\java` | JDK 17 | ❌ |
| `E:\develop\jdk11` | JDK 11 | ❌ |

---

## 三、完整构建流程

### 步骤 ① 安装 Node.js 依赖

```powershell
cd E:\Study\schoolWork\media\video-editing-system
npm install
```

### 步骤 ② 构建 Web 资源目录

```powershell
npm run build:webdir
```

脚本 `scripts/build-webdir.js` 执行以下操作：
- 拷贝 `src/` → `www/src/`
- 拷贝 `index.html`、`login.html` → `www/` 根目录
- 仅复制 FFmpeg.wasm 必需文件（不整包复制 `node_modules`，避免 APK 体积暴增）

> ⚠️ 每次修改前端代码后，都需要重新执行此步骤。

### 步骤 ③ 创建 Android 项目（仅首次）

```powershell
npx cap add android
```

生成 `android/` 目录（完整 Gradle Android 项目）。如果已存在 `android/` 目录则跳过。

### 步骤 ④ 同步 Web 资源到 Android 项目

```powershell
npx cap sync
```

将 `www/` 内容复制到 `android/app/src/main/assets/public/`，同时更新 Capacitor 原生插件。

### 步骤 ⑤ 构建 Debug APK

```cmd
cd android
set ANDROID_HOME=E:\develop\Android\Sdk
set JAVA_HOME=E:\develop\jdk21
.\gradlew.bat assembleDebug
```

构建产物：

```
android\app\build\outputs\apk\debug\app-debug.apk
```

---

## 四、日常开发流程（改前端代码后重打包）

```powershell
# 1. 浏览器开发调试（可选）
npm start     # 访问 http://localhost:3000

# 2. 确认功能后重新打包
npm run build:webdir
npx cap sync
cd android
$env:ANDROID_HOME = 'E:\develop\Android\Sdk'
$env:JAVA_HOME = 'E:\develop\jdk21'
.\gradlew.bat assembleDebug
```

> 第二次及后续构建很快，依赖已全部缓存。

---

## 五、常见问题

### Gradle 下载超时（国内网络）

已将镜像切换为腾讯云，配置文件：`android/gradle/wrapper/gradle-wrapper.properties`

```properties
distributionUrl=https\://mirrors.cloud.tencent.com/gradle/gradle-8.14.3-all.zip
```

### 无效的源发行版：21

JAVA_HOME 指向了 JDK 17，必须使用 JDK 21：

```cmd
set JAVA_HOME=E:\develop\jdk21
```

### SDK license 未接受

Gradle 通常会自动处理，如失败可手动执行：

```cmd
%ANDROID_HOME%\cmdline-tools\latest\bin\sdkmanager.bat --licenses
```

### 清理构建缓存

```cmd
cd android
.\gradlew.bat clean
```

---

## 六、Release 版本（签名发布）

> Debug 版调通后再关心此步骤。

```cmd
# 生成签名密钥（仅一次）
keytool -genkey -v -keystore my-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias my-key-alias

# 配置签名（android/app/build.gradle 添加 signingConfigs）
# 构建 release APK
.\gradlew.bat assembleRelease
```

---

## 速查卡

```cmd
:: 首次构建
npm install
npm run build:webdir
npx cap add android
npx cap sync
cd android && set ANDROID_HOME=E:\develop\Android\Sdk && set JAVA_HOME=E:\develop\jdk21 && .\gradlew.bat assembleDebug

:: 日常更新
npm run build:webdir && npx cap sync && cd android && set ANDROID_HOME=E:\develop\Android\Sdk && set JAVA_HOME=E:\develop\jdk21 && .\gradlew.bat assembleDebug
```
