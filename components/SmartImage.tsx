'use client';

import Image from 'next/image';
import { useState, useEffect, useCallback } from 'react';

interface SmartImageProps {
  src: string;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  className?: string;
  containerClassName?: string;
  sizes?: string;
  priority?: boolean;
  quality?: number;
  fallbackSrc?: string;
  useProxy?: boolean;
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * SmartImage - Unified image component combining features from:
 * - LazyImage: Loading states, error states
 * - OptimizedImage: Proxy support, fallback chain
 * - CachedImage: Cache awareness (removed - not adding value)
 *
 * Features:
 * - Loading skeleton with smooth opacity transition
 * - Error state with fallback icon
 * - Optional proxy for external images
 * - Fallback chain: proxy -> original -> fallbackSrc
 * - Supports both fill and fixed dimensions
 */
export default function SmartImage({
  src,
  alt,
  fill = false,
  width,
  height,
  className = '',
  containerClassName = '',
  sizes,
  priority = false,
  quality = 85,
  fallbackSrc,
  useProxy = false,
  onLoad,
  onError,
}: SmartImageProps) {
  const [currentSrc, setCurrentSrc] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Get optimized source URL
  const getOptimizedSrc = useCallback((originalSrc: string): string => {
    if (!originalSrc) return '';

    // Don't proxy internal URLs
    if (originalSrc.startsWith('/') || originalSrc.includes('/api/')) {
      return originalSrc;
    }

    // Use proxy for external images if requested
    if (useProxy) {
      return `/api/proxy-image?url=${encodeURIComponent(originalSrc)}`;
    }

    return originalSrc;
  }, [useProxy]);

  // Reset state when src changes
  useEffect(() => {
    if (!src) return;

    setCurrentSrc(getOptimizedSrc(src));
    setIsLoading(true);
    setHasError(false);
    setAttempt(0);
  }, [src, getOptimizedSrc]);

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
    onLoad?.();
  };

  const handleError = () => {
    // Fallback chain: proxy -> original -> fallbackSrc
    if (attempt === 0 && useProxy && currentSrc.includes('/api/proxy-image')) {
      // Try original URL without proxy
      setCurrentSrc(src);
      setAttempt(1);
      return;
    }

    if (attempt <= 1 && fallbackSrc && currentSrc !== fallbackSrc) {
      // Try fallback source
      setCurrentSrc(fallbackSrc);
      setAttempt(2);
      return;
    }

    // All attempts failed
    setIsLoading(false);
    setHasError(true);
    onError?.();
  };

  // Default sizes for responsive images
  const defaultSizes = fill
    ? '(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw'
    : sizes;

  // Common image props
  const imageProps = {
    src: currentSrc || src,
    alt,
    className: `transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'} ${className}`,
    onLoad: handleLoad,
    onError: handleError,
    priority,
    quality,
    sizes: defaultSizes,
    ...(fill ? { fill: true } : { width: width || 300, height: height || 300 }),
  };

  return (
    <div className={`relative ${containerClassName}`}>
      {/* Loading skeleton */}
      {isLoading && !hasError && (
        <div
          className={`absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-800 animate-pulse ${
            fill ? '' : 'rounded'
          }`}
        />
      )}

      {/* Error state */}
      {hasError && (
        <div
          className={`absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center ${
            fill ? '' : 'rounded'
          }`}
          aria-label={`Failed to load image: ${alt}`}
        >
          <svg
            className="w-8 h-8 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
            />
          </svg>
        </div>
      )}

      {/* Image - only render if we have a valid src */}
      {currentSrc && <Image {...imageProps} alt={alt} />}
    </div>
  );
}
