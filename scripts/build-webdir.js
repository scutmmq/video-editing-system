// 组装 Capacitor webDir：把仓库根的绝对路径资源拍平到 www/ 下
// 让 index.html 里的 /src/...、/node_modules/@ffmpeg/...、/login.html 在 www 根下原样成立
// 用法：node scripts/build-webdir.js  （或 npm run build:webdir）

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WWW = path.join(ROOT, 'www');

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function cp(src, dest) {
  if (!fs.existsSync(src)) {
    throw new Error('缺少必需资源（先 npm install？）: ' + src);
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

console.log('[build-webdir] 清理旧 www/ ...');
rmrf(WWW);
fs.mkdirSync(WWW, { recursive: true });

// 1) 整个 src（命中所有 /src/... 绝对路径）
cp(path.join(ROOT, 'src'), path.join(WWW, 'src'));

// 2) 入口页放到 www 根（/ 与 /login.html）
cp(path.join(ROOT, 'src', 'index.html'), path.join(WWW, 'index.html'));
cp(path.join(ROOT, 'src', 'pages', 'login.html'), path.join(WWW, 'login.html'));

// 3) 只复制 FFmpeg 必需文件（切勿整包 node_modules，否则 APK 暴涨）
cp(
  path.join(ROOT, 'node_modules/@ffmpeg/ffmpeg/dist/umd'),
  path.join(WWW, 'node_modules/@ffmpeg/ffmpeg/dist/umd')
);
cp(
  path.join(ROOT, 'node_modules/@ffmpeg/core/dist/umd'),
  path.join(WWW, 'node_modules/@ffmpeg/core/dist/umd')
);

console.log('[build-webdir] www/ 组装完成 ->', WWW);
