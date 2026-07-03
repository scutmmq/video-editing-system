const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];

  // 简洁 URL → 实际文件路径映射
  let filePath;
  if (urlPath === '/') {
    filePath = path.join(ROOT, 'src', 'index.html');
  } else if (urlPath === '/login.html') {
    filePath = path.join(ROOT, 'src', 'pages', 'login.html');
  } else {
    filePath = path.join(ROOT, urlPath);
  }

  // 安全检查：防止路径遍历
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  // COOP/COEP headers for SharedArrayBuffer (FFmpeg.wasm 多线程需要)
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');

  // WASM 文件额外 CORS 头
  if (ext === '.wasm') {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found: ' + urlPath);
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

// 优雅的错误处理，避免双击 exe 时闪退看不到错误信息
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`错误：端口 ${PORT} 已被占用，请先关闭占用该端口的程序后重试。`);
  } else {
    console.error('服务器启动失败：', err.message);
  }
  console.error('按任意键退出...');
  // pkg 环境下 stdin 可能不是 TTY，用等待按键 + 超时的兜底方案
  try {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', () => process.exit(1));
  } catch (_) {
    // 降级：等待 30 秒后自动退出，确保用户有时间看到错误信息
    setTimeout(() => process.exit(1), 30000);
  }
});

server.listen(PORT, HOST, () => {
  const displayHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
  console.log(`服务器已启动，请在浏览器中打开：http://${displayHost}:${PORT}`);
  console.log('（注意：0.0.0.0 是服务绑定地址，浏览器请用 localhost 访问）');
  console.log('FFmpeg.wasm 从本地 node_modules 加载');
  console.log('按 Ctrl+C 可停止服务器');
});
