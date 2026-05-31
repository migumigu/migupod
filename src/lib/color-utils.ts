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
