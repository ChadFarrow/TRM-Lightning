import { useState, useEffect, useMemo } from 'react';

/**
 * Hook for handling image format fallback
 * Tries multiple formats simultaneously and displays the first one that loads successfully
 * 
 * @param baseName - Base name of the image file (e.g., 'background', 'logo', 'placeholder-album-art')
 * @param formats - Array of format extensions to try (default: ['webp', 'png', 'jpg', 'jpeg'])
 * @param useNextImage - Whether to use Next.js Image component (default: false, uses regular img tag)
 * @returns Object with imageSrc, hasError, onError, and onLoad handlers
 */
export function useImageFormatFallback(
  baseName: string,
  formats: string[] = ['webp', 'png', 'jpg', 'jpeg'],
  useNextImage: boolean = false
) {
  const [loadedFormat, setLoadedFormat] = useState<number | null>(null);
  const [failedFormats, setFailedFormats] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  
  // Memoize formats string to use as dependency (stable reference)
  // Convert array to string for stable comparison
  const formatsStr = formats.join(',');
  const formatsKey = useMemo(() => formatsStr, [formatsStr]);
  
  // Memoize imagePaths to prevent recreation on every render
  const imagePaths = useMemo(() => {
    const formatsList = formatsKey.split(',');
    return formatsList.map(format => `/${baseName}.${format}`);
  }, [baseName, formatsKey]);
  
  // Reset when baseName or formats change
  useEffect(() => {
    setLoadedFormat(null);
    setFailedFormats(new Set());
    setIsLoading(true);

    // Check if any image is already cached and loaded
    // This handles the case where images are cached by the browser
    const checkCachedImages = () => {
      let hasLoaded = false;
      const formatsList = formatsKey.split(',');
      const paths = formatsList.map(format => `/${baseName}.${format}`);

      paths.forEach((path, index) => {
        const img = new Image();
        img.onload = () => {
          // Image is cached and ready
          if (!hasLoaded) {
            hasLoaded = true;
            setLoadedFormat(index);
            setIsLoading(false);
          }
        };
        img.onerror = () => {
          // This format doesn't exist or failed
          setFailedFormats(prev => {
            const newSet = new Set(Array.from(prev));
            newSet.add(index);
            if (newSet.size === formatsList.length && !hasLoaded) {
              setIsLoading(false);
            }
            return newSet;
          });
        };
        // Try to load the image to check if it's cached
        img.src = path;
      });
    };

    // Small delay to ensure DOM is ready
    const timeoutId = setTimeout(checkCachedImages, 50);
    return () => clearTimeout(timeoutId);
  }, [baseName, formatsKey]);
  
  const handleError = (index: number) => {
    // Mark this format as failed
    setFailedFormats(prev => {
      const newSet = new Set(Array.from(prev));
      newSet.add(index);
      
      // If all formats have failed, stop loading
      if (newSet.size === formats.length) {
        setIsLoading(false);
      }
      
      return newSet;
    });
  };
  
  const handleLoad = (index: number) => {
    // Mark this format as successfully loaded (only the first one that loads)
    // Use a function to ensure we only set it once even if multiple load handlers fire
    setLoadedFormat(prev => {
      if (prev === null) {
        setIsLoading(false);
        return index;
      }
      return prev; // Keep the first one that loaded
    });
  };
  
  // Consider it an error only if all formats have failed and we're done loading
  const hasError = !isLoading && loadedFormat === null && failedFormats.size === formats.length;
  
  return {
    imagePaths,
    loadedFormat,
    hasError,
    isLoading,
    handleError,
    handleLoad,
    useNextImage,
  };
}

