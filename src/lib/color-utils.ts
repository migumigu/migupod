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

/**
 * 优化颜色以适应深色主题 - 更有感知度的版本
 */
export function enhanceColorForBackground(r: number, g: number, b: number) {
  const hsl = rgbToHsl(r, g, b);
  
  // 保持较高饱和度，让颜色更明显
  hsl.s = Math.max(hsl.s, 0.4);
  // 调整到合适的亮度 - 深色但有明显色相
  hsl.l = Math.max(Math.min(hsl.l, 0.28), 0.15);
  
  return hslToRgb(hsl.h, hsl.s, hsl.l);
}

/**
 * 生成和谐的次色（类似色而非互补色，更高级）
 */
export function getAnalogousColor(r: number, g: number, b: number) {
  const hsl = rgbToHsl(r, g, b);
  // 顺时针旋转 30 度，产生和谐的类似色
  hsl.h = (hsl.h + 0.08333) % 1;
  // 保持高饱和度
  hsl.s = Math.max(hsl.s, 0.35);
  // 稍暗一点
  hsl.l = Math.max(hsl.l * 0.85, 0.12);
  return hslToRgb(hsl.h, hsl.s, hsl.l);
}

/**
 * RGB 转 CSS 字符串
 */
export function rgbToCss(r: number, g: number, b: number) {
  return `rgb(${r}, ${g}, ${b})`;
}

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
      canvas.width = 150;  // 提高采样精度
      canvas.height = 150;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.drawImage(img, 0, 0, 150, 150);
        const imageData = ctx.getImageData(0, 0, 150, 150);
        const data = imageData.data;
        const colorMap = new Map<string, { count: number; sat: number }>();

        // 统计颜色，优先保留饱和度高的颜色
        for (let i = 0; i < data.length; i += 4) {
          const r = Math.floor(data[i] / 16) * 16;
          const g = Math.floor(data[i + 1] / 16) * 16;
          const b = Math.floor(data[i + 2] / 16) * 16;
          
          // 计算饱和度
          const hsl = rgbToHsl(r, g, b);
          
          // 跳过太暗或太亮的颜色
          if (hsl.l > 0.08 && hsl.l < 0.92) {
            const color = `${r},${g},${b}`;
            const existing = colorMap.get(color);
            colorMap.set(color, { 
              count: (existing?.count || 0) + 1, 
              sat: hsl.s 
            });
          }
        }

        // 找到最佳主色（兼顾出现频率和饱和度）
        let dominantColor = { r: 30, g: 30, b: 40 };
        let bestScore = 0;
        
        colorMap.forEach((value, colorStr) => {
          const [r, g, b] = colorStr.split(',').map(Number);
          // 评分公式：频率 * 饱和度权重
          const score = value.count * (0.5 + value.sat * 1.5);
          if (score > bestScore) {
            bestScore = score;
            dominantColor = { r, g, b };
          }
        });

        // 优化主色
        const primaryRgb = enhanceColorForBackground(dominantColor.r, dominantColor.g, dominantColor.b);
        const secondaryRgb = getAnalogousColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
        
        // 强调色（明亮版本）
        const accentHsl = rgbToHsl(primaryRgb.r, primaryRgb.g, primaryRgb.b);
        accentHsl.l = Math.min(accentHsl.l * 2.2, 0.45);
        const accentRgb = hslToRgb(accentHsl.h, accentHsl.s, accentHsl.l);

        resolve({
          primary: rgbToCss(primaryRgb.r, primaryRgb.g, primaryRgb.b),
          secondary: rgbToCss(secondaryRgb.r, secondaryRgb.g, secondaryRgb.b),
          accent: rgbToCss(accentRgb.r, accentRgb.g, accentRgb.b)
        });
      } else {
        resolve({
          primary: 'rgb(45, 25, 60)',
          secondary: 'rgb(25, 35, 55)',
          accent: 'rgb(80, 50, 100)'
        });
      }
    };

    img.onerror = () => {
      resolve({
        primary: 'rgb(45, 25, 60)',
        secondary: 'rgb(25, 35, 55)',
        accent: 'rgb(80, 50, 100)'
      });
    };

    img.src = imageUrl;
  });
}
