@echo off
chcp 65001 >nul
title 视频剪辑系统

echo.
echo ========================================
echo   轻量级视频剪辑与多媒体处理系统
echo ========================================
echo.

cd /d "%~dp0"

:: 检查 Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未找到 Node.js，请先安装 Node.js
    echo 下载地址：https://nodejs.org/zh-cn/
    pause
    exit /b 1
)

echo [1/2] 检查依赖...

if not exist "node_modules\@ffmpeg" (
    echo 正在安装依赖，请稍候...
    call npm install
    if %errorlevel% neq 0 (
        echo [提示] 安装失败，尝试使用国内镜像...
        call npm config set registry https://registry.npmmirror.com
        call npm install
    )
)

echo [2/2] 启动服务器...
echo.
echo 服务器启动后请打开浏览器访问：http://localhost:3000
echo 按 Ctrl+C 可以停止服务器
echo.

start http://localhost:3000
node server.js

pause
