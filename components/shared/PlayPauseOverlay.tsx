'use client';

import { Play, Pause } from 'lucide-react';

interface PlayPauseOverlayProps {
  isPlaying: boolean;
  onPlay: (e: React.MouseEvent | React.TouchEvent) => void;
  ariaLabel?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Shared Play/Pause overlay button for card components.
 * Provides consistent look and behavior across AlbumCard, BandCard, TrackCard.
 */
export default function PlayPauseOverlay({
  isPlaying,
  onPlay,
  ariaLabel,
  size = 'md',
}: PlayPauseOverlayProps) {
  const sizeClasses = {
    sm: 'w-10 h-10 md:w-8 md:h-8',
    md: 'w-16 h-16 md:w-12 md:h-12',
    lg: 'w-20 h-20 md:w-16 md:h-16',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div className="absolute inset-0 bg-black/20 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onPlay(e);
        }}
        className={`${sizeClasses[size]} bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 active:bg-white/40 transition-colors duration-200 touch-manipulation pointer-events-auto`}
        aria-label={ariaLabel || (isPlaying ? 'Pause' : 'Play')}
      >
        {isPlaying ? (
          <Pause className={`${iconSizes[size]} text-white`} />
        ) : (
          <Play className={`${iconSizes[size]} text-white ml-1`} />
        )}
      </button>
    </div>
  );
}
