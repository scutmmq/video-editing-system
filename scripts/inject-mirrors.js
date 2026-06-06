// 向 Android 项目注入国内 Maven 镜像和 Gradle 镜像
// 在 npx cap sync 之后调用，因为 cap sync 会重置这些文件
// 也修补 node_modules/@capacitor/android/capacitor/build.gradle

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ANDROID = path.join(ROOT, 'android');

// 1. gradle-wrapper.properties → 腾讯云 Gradle 镜像
const wrapperProps = path.join(ANDROID, 'gradle', 'wrapper', 'gradle-wrapper.properties');
if (fs.existsSync(wrapperProps)) {
  let content = fs.readFileSync(wrapperProps, 'utf-8');
  content = content.replace(
    /https:\\?\/\/services\.gradle\.org\/distributions\//g,
    'https\\://mirrors.cloud.tencent.com/gradle/'
  );
  fs.writeFileSync(wrapperProps, content, 'utf-8');
  console.log('[mirrors] gradle-wrapper.properties → 腾讯云镜像');
}

// 2. 所有 build.gradle → 阿里云 Maven 镜像（google + public）
function injectRepos(filePath, label) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf-8');

  const mirror = [
    "        maven { url 'https://maven.aliyun.com/repository/google' }",
    "        maven { url 'https://maven.aliyun.com/repository/public' }",
  ].join('\n');

  const marker = "maven.aliyun.com/repository/google";
  if (content.includes(marker)) {
    if (label) console.log(`[mirrors] ${label} 已包含镜像，跳过`);
    return;
  }

  // 在 repositories { 后的 google() 之前插入阿里云镜像
  let injected = content.replace(
    /(repositories\s*\{)(\s*google\(\))/g,
    `$1\n${mirror}\n$2`
  );

  if (injected !== content) {
    fs.writeFileSync(filePath, injected, 'utf-8');
    console.log(`[mirrors] ${label} → 阿里云 Maven 镜像`);
  }
}

// 根项目
injectRepos(path.join(ANDROID, 'build.gradle'), 'build.gradle');

// app 子项目
injectRepos(path.join(ANDROID, 'app', 'build.gradle'), 'app/build.gradle');

// capacitor-cordova-android-plugins 子项目
injectRepos(
  path.join(ANDROID, 'capacitor-cordova-android-plugins', 'build.gradle'),
  'capacitor-cordova-android-plugins'
);

// capacitor-android 库（在 node_modules 中，npm install 会重置）
injectRepos(
  path.join(ROOT, 'node_modules', '@capacitor', 'android', 'capacitor', 'build.gradle'),
  '@capacitor/android'
);

console.log('[mirrors] 完成');
