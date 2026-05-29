@echo off
chcp 65001 >nul
title 打包 Android APK

cd /d "%~dp0\.."

echo ========================================
echo   打包 Android APK
echo ========================================
echo.

:: 设置环境变量
set "JAVA_HOME=E:\develop\jdk21"
set "ANDROID_HOME=E:\develop\Android\Sdk"

:: 构建 webdir
echo [1/3] 构建 Web 资源...
call npm run build:webdir
if %errorlevel% neq 0 (
    echo [错误] build:webdir 失败
    pause
    exit /b 1
)

:: 同步到 Android 项目
echo [2/3] 同步到 Android 项目...
call npx cap sync
if %errorlevel% neq 0 (
    echo [错误] cap sync 失败
    pause
    exit /b 1
)

:: Gradle 构建
echo [3/3] Gradle 构建 APK...
cd android
call .\gradlew.bat assembleDebug
if %errorlevel% neq 0 (
    echo [错误] Gradle 构建失败
    pause
    exit /b 1
)

echo.
echo ========================================
echo   打包完成！
echo   产物：app\build\outputs\apk\debug\app-debug.apk
echo ========================================
pause
