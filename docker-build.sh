#!/bin/bash

# Docker 镜像构建脚本
# 支持多架构构建 (X86/ARM)

set -e

IMAGE_NAME="migumigu/migupod"
VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "latest")

echo "========================================"
echo "Building MiguPod Docker Image"
echo "Version: $VERSION"
echo "Image: $IMAGE_NAME"
echo "========================================"

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed"
    exit 1
fi

# 检查是否支持 buildx
if ! docker buildx version &> /dev/null; then
    echo "Error: Docker buildx is not available"
    echo "Please enable Docker BuildKit or upgrade Docker"
    exit 1
fi

# 创建并使用多架构 builder（如果不存在）
BUILDER_NAME="migupod-builder"
if ! docker buildx inspect "$BUILDER_NAME" &> /dev/null; then
    echo "Creating multi-platform builder: $BUILDER_NAME"
    docker buildx create --name "$BUILDER_NAME" --use
else
    echo "Using existing builder: $BUILDER_NAME"
    docker buildx use "$BUILDER_NAME"
fi

# 登录 Docker Hub（可选）
if [ -n "$DOCKERHUB_USERNAME" ] && [ -n "$DOCKERHUB_TOKEN" ]; then
    echo "Logging into Docker Hub..."
    echo "$DOCKERHUB_TOKEN" | docker login -u "$DOCKERHUB_USERNAME" --password-stdin
fi

# 构建并推送多架构镜像
echo ""
echo "Building multi-platform image..."
echo "Platforms: linux/amd64, linux/arm64"
echo ""

if [ "$1" == "push" ] || [ "$1" == "--push" ]; then
    echo "Mode: Build and PUSH to Docker Hub"
    docker buildx build \
        --platform linux/amd64,linux/arm64 \
        --tag "$IMAGE_NAME:latest" \
        --tag "$IMAGE_NAME:$VERSION" \
        --push \
        .
    echo ""
    echo "✅ Image pushed to Docker Hub"
    echo "   - $IMAGE_NAME:latest"
    echo "   - $IMAGE_NAME:$VERSION"
else
    echo "Mode: Build and LOAD locally"
    echo "Note: Multi-platform builds cannot be loaded locally."
    echo "      Building for current platform only..."
    echo ""
    
    # 本地构建（单架构）
    docker buildx build \
        --load \
        --tag "$IMAGE_NAME:latest" \
        --tag "$IMAGE_NAME:$VERSION" \
        .
    
    echo ""
    echo "✅ Image built locally"
    echo "   - $IMAGE_NAME:latest"
    echo "   - $IMAGE_NAME:$VERSION"
    echo ""
    echo "To run the container:"
    echo "  docker run -d -p 3000:80 --name migupod $IMAGE_NAME:latest"
fi

echo ""
echo "========================================"
echo "Build completed successfully!"
echo "========================================"
