// Server-side color extraction using Sharp
// This runs on Node.js and can extract colors from images during RSS parsing

import sharp from 'sharp';
import { ExtractedColors, ColorPalette } from './color-utils';

/**
 * Extract colors from an image URL (server-side)
 * This is used during RSS parsing to pre-extract colors
 */
export async function extractColorsFromImageServer(imageUrl: string): Promise<ExtractedColors | null> {
  try {
    console.log('🖼️ [Server] Starting color extraction for:', imageUrl);
    
    // Fetch the image
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TRM-Lightning/1.0)',
      },
    });
    
    if (!response.ok) {
      console.warn(`⚠️ [Server] Failed to fetch image: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const imageBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(imageBuffer);
    
    // Use sharp to resize and extract raw pixel data
    const { data, info } = await sharp(buffer)
      .resize(100, 100, { fit: 'cover' }) // Resize for performance
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // Extract RGB pixels
    const pixels: Array<[number, number, number]> = [];
    const channels = info.channels;
    
    for (let i = 0; i < data.length; i += channels) {
      const r = data[i];
      const g = data[i + 1] || r;
      const b = data[i + 2] || r;
      
      // Skip very light or very dark pixels
      const brightness = (r + g + b) / 3;
      if (brightness < 20 || brightness > 235) continue;
      
      pixels.push([r, g, b]);
    }
    
    if (pixels.length === 0) {
      console.warn('⚠️ [Server] No valid pixels found');
      return null;
    }
    
    // Use KMeans to find representative colors
    const kMeansColors = kMeans(pixels, 5);
    
    // Find the most vibrant color
    let bestColor = kMeansColors[0];
    let bestScore = 0;
    
    for (const color of kMeansColors) {
      const [r, g, b] = color;
      const hsl = rgbToHsl(r, g, b);
      const saturation = hsl.s / 100;
      const lightness = hsl.l / 100;
      
      // Score based on saturation and avoiding too dark/light colors
      const score = saturation * (1 - Math.abs(lightness - 0.5));
      
      if (score > bestScore) {
        bestScore = score;
        bestColor = color;
      }
    }
    
    const [r, g, b] = bestColor;
    const generatedPalette = generateColorPalette(r, g, b);
    const isDark = isColorDark(r, g, b);
    
    console.log('🎨 [Server] Extracted colors:', {
      dominant: `rgb(${r}, ${g}, ${b})`,
      isDark,
    });
    
    return {
      dominant: `rgb(${r}, ${g}, ${b})`,
      palette: generatedPalette,
      isDark,
    };
  } catch (error) {
    console.error('❌ [Server] Failed to extract colors:', error);
    return null;
  }
}

// KMeans clustering for color extraction
function kMeans(pixels: Array<[number, number, number]>, k: number): Array<[number, number, number]> {
  if (pixels.length === 0) return [[64, 64, 64]];
  if (pixels.length < k) return pixels.slice(0, k);
  
  // Initialize centroids randomly
  const centroids: Array<[number, number, number]> = [];
  for (let i = 0; i < k; i++) {
    const randomIndex = Math.floor(Math.random() * pixels.length);
    centroids.push([...pixels[randomIndex]]);
  }
  
  // Run KMeans for a few iterations
  for (let iter = 0; iter < 10; iter++) {
    // Assign pixels to nearest centroid
    const clusters: Array<Array<[number, number, number]>> = Array(k).fill(null).map(() => []);
    
    for (const pixel of pixels) {
      let minDistance = Infinity;
      let bestCluster = 0;
      
      for (let c = 0; c < k; c++) {
        const distance = Math.sqrt(
          Math.pow(pixel[0] - centroids[c][0], 2) +
          Math.pow(pixel[1] - centroids[c][1], 2) +
          Math.pow(pixel[2] - centroids[c][2], 2)
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          bestCluster = c;
        }
      }
      
      clusters[bestCluster].push(pixel);
    }
    
    // Update centroids
    for (let c = 0; c < k; c++) {
      if (clusters[c].length > 0) {
        const avgR = clusters[c].reduce((sum, p) => sum + p[0], 0) / clusters[c].length;
        const avgG = clusters[c].reduce((sum, p) => sum + p[1], 0) / clusters[c].length;
        const avgB = clusters[c].reduce((sum, p) => sum + p[2], 0) / clusters[c].length;
        
        centroids[c] = [Math.round(avgR), Math.round(avgG), Math.round(avgB)];
      }
    }
  }
  
  return centroids;
}

// Convert RGB to HSL
function rgbToHsl(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    
    h /= 6;
  }
  
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

// Check if a color is dark
function isColorDark(r: number, g: number, b: number): boolean {
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness < 128;
}

// Generate a color palette based on a dominant color
function generateColorPalette(r: number, g: number, b: number): ColorPalette {
  const hsl = rgbToHsl(r, g, b);
  
  // Create variations
  const primary = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
  const secondary = `hsl(${hsl.h}, ${Math.max(0, hsl.s - 20)}%, ${Math.min(100, hsl.l + 10)}%)`;
  const accent = `hsl(${(hsl.h + 30) % 360}, ${hsl.s}%, ${hsl.l}%)`;
  
  // Create background gradient
  const background = `linear-gradient(135deg, 
    hsl(${hsl.h}, ${hsl.s}%, ${Math.max(0, hsl.l - 40)}%) 0%, 
    hsl(${hsl.h}, ${Math.max(0, hsl.s - 30)}%, ${Math.max(0, hsl.l - 60)}%) 100%)`;
  
  // Determine text color based on background brightness
  const text = hsl.l > 50 ? '#000000' : '#ffffff';
  
  return {
    primary,
    secondary,
    accent,
    background,
    text,
  };
}

