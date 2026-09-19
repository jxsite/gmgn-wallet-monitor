@echo off
chcp 65001 >nul
title GMGN Top 100 获利钱包监控 & 10U 模拟交易系统
color 0A

echo =======================================================
echo       GMGN 获利前100名钱包监控 & 10U 模拟交易系统
echo =======================================================
echo.

:: 切换到当前脚本所在目录
cd /d "%~dp0"

:: 1. 检查 Node.js 环境
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [错误] 未检测到 Node.js，请先安装 Node.js (建议 v20+): https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo [1/3] 检测运行环境... Node.js 已就绪.

:: 2. 检查依赖是否已安装
if not exist "node_modules" (
    echo [2/3] 正在初次安装依赖包，请稍候...
    call npm install
    if %errorlevel% neq 0 (
        color 0C
        echo [错误] 依赖安装失败，请检查网络后重试。
        pause
        exit /b 1
    )
) else (
    echo [2/3] 依赖包检查完成.
)

:: 3. 检查前端构建产物
if not exist "dist" (
    echo [3/3] 正在编译前端控制台页面...
    call npm run build
    if %errorlevel% neq 0 (
        color 0C
        echo [错误] 前端编译失败。
        pause
        exit /b 1
    )
) else (
    echo [3/3] 前端资源检查完成.
)

echo.
echo =======================================================
echo  🚀 服务正在启动...
echo  🌐 本地管理后台: http://localhost:3000
echo  💡 正在为您自动在浏览器中打开页面...
echo  🛑 如需停止运行，请直接关闭本黑框窗口或按 Ctrl+C
echo =======================================================
echo.

:: 自动打开浏览器
start "" http://localhost:3000

:: 运行主服务
node server/server.js

if %errorlevel% neq 0 (
    echo.
    echo [提示] 服务发生异常或已退出。
    pause
)
