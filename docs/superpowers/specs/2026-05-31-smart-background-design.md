# 智能背景色跟随 - 设计文档

## 功能概述

根据当前播放歌曲（或选中封面）的专辑封面，自动生成优雅的双色渐变背景，营造沉浸式视觉体验。

## 设计决策

| 维度 | 选择 | 说明 |
|------|------|------|
| **应用范围** | C（两者都有） | 播放时跟随歌曲，暂停时跟随选中封面 |
| **动画速度** | B（缓慢融合） | 800-1000ms 过渡，优雅不突兀 |
| **背景样式** | B（双色渐变） | 主色 + 互补色，有层次感 |

## 详细设计

### 1. 颜色提取增强

**目标：增强现有的颜色提取函数，支持：
- 提取主色 + 次色
- 自动降低饱和度以适应深色主题
- 生成互补色用于渐变效果

### 2. 渐变策略

```css
/* 从左上角到右下角的径向渐变 */
background: radial-gradient(
  ellipse at 20% 20%, 
  var(--bg-primary),
  var(--bg-secondary) 30%,
  #050505 70%,
  #000000 100%
);
```

### 3. 触发逻辑

```typescript
// 优先级：正在播放的歌曲 > 当前选中的封面
const determineColorSource = () => {
  if (currentTrack && isPlaying) {
    return currentTrack;
  }
  if (items[activeIndex]) {
    return items[activeIndex];
  }
  return null;
}
```

### 4. 动画过渡

```css
/* 800ms 缓动曲线 */
transition: background 800ms cubic-bezier(0.4, 0, 0.2, 1);
```

## 技术实现

### 新增文件

1. `src/lib/color-utils.ts` - 颜色处理工具函数

### 修改文件

1. `src/App.tsx` - 集成背景色逻辑
2. `src/index.css` - 添加背景样式和过渡

### 设置开关

在设置面板增加「动态背景」开关（默认开启）
