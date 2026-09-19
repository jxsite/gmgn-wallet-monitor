@echo off
chcp 65001 >nul
title GMGN Top 100 钱包监控与10U模拟交易系统
color 0A

echo =======================================================
echo       GMGN 获利前100钱包监控 + 10U 模拟交易系统
echo =======================================================
echo.

cd /d "%~dp0"

REM 1. 检查 Node.js 环境
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [错误] 未检测到 Node.js，请先安装 Node.js: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo [1/3] 检查运行环境... Node.js 已就绪.

REM 2. 检查依赖是否已安装
if not exist "node_modules" (
    echo [2/3] 正在初次安装项目依赖，请稍候...
    call npm install
    if %errorlevel% neq 0 (
        color 0C
        echo [错误] 依赖安装失败，请检查网络后重试。
        pause
        exit /b 1
    )
) else (
    echo [2/3] 项目依赖库已就绪.
)

REM 3. 检查前端是否已编译
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
    echo [3/3] 前端构建产物已就绪.
)

echo.
echo =======================================================
echo  正在启动服务...
echo  本地管理后台: http://localhost:3000
echo  正在自动打开浏览器控制台...
echo  若要停止运行，直接关闭本黑色命令行窗口或按 Ctrl+C
echo =======================================================
echo.

start "" http://localhost:3000

node server/server.js

if %errorlevel% neq 0 (
    echo.
    echo [提示] 服务已退出
    pause
)