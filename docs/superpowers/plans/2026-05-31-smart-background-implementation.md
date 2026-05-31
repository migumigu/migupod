# 智能背景色跟随 - 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 根据当前播放歌曲或选中封面的专辑封面，自动生成优雅的双色渐变背景

**Architecture:** 增强现有颜色提取逻辑，新增颜色处理工具，在App组件中集成背景色状态管理，使用CSS变量实现平滑过渡

**Tech Stack:** React, TypeScript, CSS

---

## Task 1: 创建颜色处理工具函数

**Files:**
- Create: `src/lib/color-utils.ts`

**Step 1: 实现 RGB ↔ HSL 转换函数**

```typescript
// src/lib/color-utils.ts

/**
 * RGB 转 HSL
 */
export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  
  return { h, s, l };
}

/**
 * HSL 转 RGB
 */
export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}
```

**Step 2: 实现颜色优化函数**

```typescript
/**
 * 降低饱和度和亮度以适应深色主题
 */
export function desaturateAndDarken(r: number, g: number, b: number, targetSat = 0.3, targetLight = 0.18) {
  const hsl = rgbToHsl(r, g, b);
  hsl.s = Math.min(hsl.s, targetSat);
  hsl.l = Math.min(hsl.l, targetLight);
  return hslToRgb(hsl.h, hsl.s, hsl.l);
}

/**
 * 生成互补色
 */
export function getComplementaryColor(r: number, g: number, b: number) {
  const hsl = rgbToHsl(r, g, b);
  hsl.h = (hsl.h + 0.5) % 1;
  hsl.s = Math.max(hsl.s * 0.7, 0.15);
  hsl.l = Math.max(hsl.l * 0.6, 0.12);
  return hslToRgb(hsl.h, hsl.s, hsl.l);
}

/**
 * RGB 转 CSS 字符串
 */
export function rgbToCss(r: number, g: number, b: number) {
  return `rgb(${r}, ${g}, ${b})`;
}
```

**Step 3: 实现增强版颜色提取函数**

```typescript
/**
 * 从图片提取优化的颜色方案
 */
export async function extractEnhancedColors(imageUrl: string): Promise<{
  primary: string;
  secondary: string;
  accent: string;
}> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.drawImage(img, 0, 0, 100, 100);
        const imageData = ctx.getImageData(0, 0, 100, 100);
        const data = imageData.data;
        const colorMap = new Map<string, number>();

        // 统计颜色
        for (let i = 0; i < data.length; i += 4) {
          const r = Math.floor(data[i] / 32) * 32;
          const g = Math.floor(data[i + 1] / 32) * 32;
          const b = Math.floor(data[i + 2] / 32) * 32;
          const color = `${r},${g},${b}`;
          colorMap.set(color, (colorMap.get(color) || 0) + 1);
        }

        // 找到主色
        let dominantColor = { r: 0, g: 0, b: 0 };
        let maxCount = 0;
        
        colorMap.forEach((count, colorStr) => {
          if (count > maxCount) {
            maxCount = count;
            const [r, g, b] = colorStr.split(',').map(Number);
            dominantColor = { r, g, b };
          }
        });

        // 优化主色
        const primaryRgb = desaturateAndDarken(dominantColor.r, dominantColor.g, dominantColor.b);
        const secondaryRgb = getComplementaryColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
        
        // 强调色（稍亮一点）
        const accentHsl = rgbToHsl(primaryRgb.r, primaryRgb.g, primaryRgb.b);
        accentHsl.l = Math.min(accentHsl.l * 1.8, 0.35);
        const accentRgb = hslToRgb(accentHsl.h, accentHsl.s, accentHsl.l);

        resolve({
          primary: rgbToCss(primaryRgb.r, primaryRgb.g, primaryRgb.b),
          secondary: rgbToCss(secondaryRgb.r, secondaryRgb.g, secondaryRgb.b),
          accent: rgbToCss(accentRgb.r, accentRgb.g, accentRgb.b)
        });
      } else {
        resolve({
          primary: 'rgb(30, 30, 40)',
          secondary: 'rgb(20, 20, 30)',
          accent: 'rgb(60, 60, 80)'
        });
      }
    };

    img.onerror = () => {
      resolve({
        primary: 'rgb(30, 30, 40)',
        secondary: 'rgb(20, 20, 30)',
        accent: 'rgb(60, 60, 80)'
      });
    };

    img.src = imageUrl;
  });
}
```

---

## Task 2: 更新 CSS 样式

**Files:**
- Modify: `src/index.css`

**Step 1: 添加背景样式和过渡**

在文件末尾添加：

```css
/* 智能背景色 */
body {
  transition: background 800ms cubic-bezier(0.4, 0, 0.2, 1);
}

.smart-background {
  background: radial-gradient(
    ellipse at 20% 20%,
    var(--bg-primary, rgb(30, 30, 40)) 0%,
    var(--bg-secondary, rgb(20, 20, 30)) 30%,
    #050505 70%,
    #000000 100%
  );
}

/* 默认纯黑背景 */
.default-background {
  background: #000000;
}
```

---

## Task 3: 集成背景色逻辑到 App.tsx

**Files:**
- Modify: `src/App.tsx`

**Step 1: 导入新工具函数**

找到顶部 imports，在 `import { cn } from './lib/utils';` 后面添加：

```typescript
import { extractEnhancedColors } from './lib/color-utils';
```

**Step 2: 添加状态和设置**

在 `useState` 部分添加：

```typescript
const [dynamicBackgroundEnabled, setDynamicBackgroundEnabled] = useState<boolean>(() => {
  const saved = localStorage.getItem('dynamic-background');
  return saved !== 'false'; // 默认开启
});
const [backgroundColors, setBackgroundColors] = useState<{
  primary: string;
  secondary: string;
  accent: string;
} | null>(null);
```

**Step 3: 添加更新背景色的 effect**

在现有 `useEffect` 后面添加：

```typescript
// 更新背景色 based on current track or selected item
useEffect(() => {
  if (!dynamicBackgroundEnabled) {
    setBackgroundColors(null);
    document.body.classList.remove('smart-background');
    document.body.classList.add('default-background');
    return;
  }

  // 确定颜色源
  const sourceItem = (currentTrack && isPlaying) ? currentTrack : items[activeIndex];
  
  if (sourceItem) {
    const imageUrl = getImageUrl(sourceItem);
    extractEnhancedColors(imageUrl).then(colors => {
      setBackgroundColors(colors);
      document.body.classList.add('smart-background');
      document.body.classList.remove('default-background');
      document.body.style.setProperty('--bg-primary', colors.primary);
      document.body.style.setProperty('--bg-secondary', colors.secondary);
      document.body.style.setProperty('--bg-accent', colors.accent);
    });
  }
}, [currentTrack, isPlaying, activeIndex, items, getImageUrl, dynamicBackgroundEnabled]);
```

**Step 4: 在设置面板添加开关**

找到设置面板的表单部分（约 1130 行左右），在 Provider 选择之前添加：

```tsx
{/* 动态背景开关 */}
<div className="space-y-3">
  <div className="flex items-center justify-between">
    <span className="text-[10px] uppercase tracking-widest opacity-50">动态背景</span>
    <button
      type="button"
      onClick={() => {
        setDynamicBackgroundEnabled(prev => {
          const newValue = !prev;
          localStorage.setItem('dynamic-background', String(newValue));
          return newValue;
        });
      }}
      className={`relative w-12 h-6 rounded-full transition-colors ${
        dynamicBackgroundEnabled ? 'bg-white' : 'bg-white/20'
      }`}
    >
      <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-black transition-transform ${
        dynamicBackgroundEnabled ? 'translate-x-6' : 'translate-x-0'
      }`} />
    </button>
  </div>
</div>
```

**Step 5: 移除旧的颜色提取逻辑**

找到旧的 `extractDominantColor` 函数和相关的 mediaSession 背景色设置代码（约 188-272 行），可以保留但不再主要使用。

---

## Task 4: 测试验证

**Files:** 无需新建文件

**Step 1: 启动开发服务器**

```bash
npm run dev
```

**Step 2: 验证功能**

1. 确认默认状态下动态背景是开启的
2. 滚动封面流，验证背景跟随选中封面变化
3. 播放歌曲，验证背景跟随当前播放歌曲
4. 打开设置面板，关闭动态背景，验证回到纯黑背景
5. 再次打开，验证动态背景恢复
6. 验证 800ms 的平滑过渡效果

---

## Final Checklist

- [x] 新增颜色处理工具函数
- [x] 更新 CSS 样式支持渐变背景
- [x] 集成背景色逻辑到 App 组件
- [x] 添加设置开关
- [x] 测试验证功能正常
