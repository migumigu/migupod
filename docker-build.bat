@echo off
chcp 65001 >nul

REM Docker 镜像构建脚本 (Windows)
REM 支持多架构构建 (X86/ARM)

echo ========================================
echo Building MiguPod Docker Image
echo ========================================

set IMAGE_NAME=migumigu/migupod
for /f "tokens=*" %%a in ('node -p "require(^'./package.json^').version" 2^>nul') do set VERSION=%%a
if "%VERSION%"=="" set VERSION=latest

echo Version: %VERSION%
echo Image: %IMAGE_NAME%
echo.

REM 检查 Docker 是否安装
docker --version >nul 2>&1
if errorlevel 1 (
    echo Error: Docker is not installed
    exit /b 1
)

REM 检查是否支持 buildx
docker buildx version >nul 2>&1
if errorlevel 1 (
    echo Error: Docker buildx is not available
    echo Please enable Docker BuildKit or upgrade Docker
    exit /b 1
)

REM 创建并使用多架构 builder（如果不存在）
set BUILDER_NAME=migupod-builder
docker buildx inspect "%BUILDER_NAME%" >nul 2>&1
if errorlevel 1 (
    echo Creating multi-platform builder: %BUILDER_NAME%
    docker buildx create --name "%BUILDER_NAME%" --use
) else (
    echo Using existing builder: %BUILDER_NAME%
    docker buildx use "%BUILDER_NAME%"
)

echo.
echo Building multi-platform image...
echo Platforms: linux/amd64, linux/arm64
echo.

if "%1"=="push" (
    echo Mode: Build and PUSH to Docker Hub
    docker buildx build ^
        --platform linux/amd64,linux/arm64 ^
        --tag "%IMAGE_NAME%:latest" ^
        --tag "%IMAGE_NAME%:%VERSION%" ^
        --push ^
        .
    echo.
    echo ✅ Image pushed to Docker Hub
    echo    - %IMAGE_NAME%:latest
    echo    - %IMAGE_NAME%:%VERSION%
) else (
    echo Mode: Build and LOAD locally
    echo Note: Multi-platform builds cannot be loaded locally.
    echo       Building for current platform only...
    echo.
    
    docker buildx build ^
        --load ^
        --tag "%IMAGE_NAME%:latest" ^
        --tag "%IMAGE_NAME%:%VERSION%" ^
        .
    
    echo.
    echo ✅ Image built locally
    echo    - %IMAGE_NAME%:latest
    echo    - %IMAGE_NAME%:%VERSION%
    echo.
    echo To run the container:
    echo   docker run -d -p 3000:80 --name migupod %IMAGE_NAME%:latest
)

echo.
echo ========================================
echo Build completed successfully!
echo ========================================
