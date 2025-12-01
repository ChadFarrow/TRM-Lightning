'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';

// Import the GIF to video mapping at runtime
let gifVideoMapping: Record<string, { webm: string; mp4: string }> = {};

// Load mapping on client side
if (typeof window !== 'undefined') {
  fetch('/data/gif-video-mapping.json')
    .then(res => res.json())
    .then(data => { gifVideoMapping = data; })
    .catch(() => { /* Mapping not available, will use original GIFs */ });
}

interface VideoCoverProps {
  src: string;
  alt: string;
  fill?: boolean;
  className?: string;
  sizes?: string;
  priority?: boolean;
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * VideoCover component - displays video for GIF sources, images for others
 * Videos autoplay, loop, and are muted (like GIFs)
 */
export default function VideoCover({
  src,
  alt,
  fill = false,
  className = '',
  sizes,
  priority = false,
  onLoad,
  onError,
}: VideoCoverProps) {
  const [isVideo, setIsVideo] = useState(false);
  const [videoSources, setVideoSources] = useState<{ webm?: string; mp4?: string } | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Check if this GIF has a video version
  useEffect(() => {
    if (src?.toLowerCase().includes('.gif')) {
      // Check if we have a video version
      const mapping = gifVideoMapping[src];
      if (mapping) {
        setIsVideo(true);
        setVideoSources(mapping);
      } else {
        // Try to load mapping dynamically
        fetch('/data/gif-video-mapping.json')
          .then(res => res.json())
          .then(data => {
            gifVideoMapping = data;
            if (data[src]) {
              setIsVideo(true);
              setVideoSources(data[src]);
            }
          })
          .catch(() => {
            setIsVideo(false);
          });
      }
    } else {
      setIsVideo(false);
    }
  }, [src]);

  const handleVideoLoad = () => {
    setIsLoaded(true);
    setHasError(false);
    onLoad?.();
  };

  const handleVideoError = () => {
    // Fall back to original GIF if video fails
    setIsVideo(false);
    setHasError(false);
    onError?.();
  };

  const handleImageLoad = () => {
    setIsLoaded(true);
    setHasError(false);
    onLoad?.();
  };

  const handleImageError = () => {
    setHasError(true);
    setIsLoaded(false);
    onError?.();
  };

  // Render video for GIF sources with available video versions
  if (isVideo && videoSources) {
    return (
      <div className={`relative ${fill ? 'absolute inset-0' : ''}`}>
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
          style={fill ? { width: '100%', height: '100%', objectFit: 'cover' } : undefined}
          onLoadedData={handleVideoLoad}
          onError={handleVideoError}
        >
          {videoSources.webm && <source src={videoSources.webm} type="video/webm" />}
          {videoSources.mp4 && <source src={videoSources.mp4} type="video/mp4" />}
        </video>

        {/* Loading placeholder */}
        {!isLoaded && !hasError && (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center animate-pulse">
            <div className="w-8 h-8 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    );
  }

  // Render standard image for non-GIF sources or when video not available
  if (fill) {
    return (
      <>
        <Image
          src={src}
          alt={alt}
          fill
          className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
          sizes={sizes || '(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw'}
          priority={priority}
          onLoad={handleImageLoad}
          onError={handleImageError}
        />

        {/* Loading placeholder */}
        {!isLoaded && !hasError && (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center animate-pulse">
            <div className="w-8 h-8 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Error placeholder */}
        {hasError && (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
        )}
      </>
    );
  }

  // Non-fill image
  return (
    <Image
      src={src}
      alt={alt}
      width={400}
      height={400}
      className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
      sizes={sizes}
      priority={priority}
      onLoad={handleImageLoad}
      onError={handleImageError}
    />
  );
}
