'use client';

import { useState, memo } from 'react';
import Image from 'next/image';
import { Play, Pause, Music, Zap, Video, Volume2, Users } from 'lucide-react';
import { useLightning } from '@/contexts/LightningContext';
import { DARK_CARD_CLASSES, DARK_BADGE_BG, DARK_BADGE_TEXT } from '@/lib/theme-utils';
import type { Band } from '@/lib/band-parser';

interface BandCardProps {
  band: Band;
  isPlaying?: boolean;
  onPlay: (band: Band, e: React.MouseEvent | React.TouchEvent) => void;
  onBoostClick?: (band: Band) => void;
  onClick?: (band: Band) => void;
  className?: string;
}

function BandCard({ band, isPlaying = false, onPlay, onBoostClick, onClick, className = '' }: BandCardProps) {
  const { isLightningEnabled } = useLightning();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Count video and audio tracks
  const videoCount = band.tracks.filter(t => t.mediaType === 'video').length;
  const audioCount = band.tracks.filter(t => t.mediaType === 'audio' || !t.mediaType).length;

  return (
    <div
      className={`group relative ${DARK_CARD_CLASSES} overflow-hidden hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${className}`}
      onClick={() => onClick?.(band)}
    >
      {/* Band Artwork */}
      <div className="relative aspect-square overflow-hidden">
        <Image
          src={band.coverArt}
          alt={band.name}
          fill
          className={`object-cover transition-opacity duration-300 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
        />

        {/* Loading placeholder */}
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
            <Users className="w-8 h-8 text-gray-400 animate-pulse" />
          </div>
        )}

        {/* Error placeholder */}
        {imageError && (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
            <Users className="w-8 h-8 text-gray-400" />
          </div>
        )}

        {/* Play/Pause Overlay */}
        <div className="absolute inset-0 bg-black/20 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPlay(band, e);
            }}
            className="w-16 h-16 md:w-12 md:h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 active:bg-white/40 transition-colors duration-200 touch-manipulation pointer-events-auto"
            aria-label={isPlaying ? 'Pause' : 'Play all tracks'}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 text-white" />
            ) : (
              <Play className="w-6 h-6 text-white ml-1" />
            )}
          </button>
        </div>

        {/* Lightning tip button */}
        {isLightningEnabled && onBoostClick && (
          <div className="absolute top-1 left-1 sm:top-2 sm:left-2">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onBoostClick(band);
              }}
              className="w-6 h-6 sm:w-7 sm:h-7 bg-yellow-500/90 hover:bg-yellow-600/90 backdrop-blur-sm rounded-full flex items-center justify-center transition-colors z-10"
              aria-label={`Boost ${band.name}`}
            >
              <Zap className="w-3 h-3 sm:w-4 sm:h-4 text-black" />
            </button>
          </div>
        )}

        {/* Track count badge */}
        <div className={`absolute top-1 right-1 sm:top-2 sm:right-2 ${DARK_BADGE_BG} backdrop-blur-sm rounded-full px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs ${DARK_BADGE_TEXT}`}>
          {band.trackCount} {band.trackCount !== 1 ? 'tracks' : 'track'}
        </div>
      </div>

      {/* Band Info */}
      <div className="p-2 sm:p-3 bg-black/70 backdrop-blur-sm">
        <h3 className="font-semibold text-white text-xs sm:text-sm leading-tight line-clamp-2 group-hover:text-gray-200 transition-colors duration-200">
          {band.name}
        </h3>

        {/* Media type breakdown */}
        <div className="flex items-center gap-2 mt-1">
          {videoCount > 0 && (
            <div className="flex items-center gap-0.5 text-[10px] sm:text-xs text-blue-400">
              <Video className="w-3 h-3" />
              <span>{videoCount}</span>
            </div>
          )}
          {audioCount > 0 && (
            <div className="flex items-center gap-0.5 text-[10px] sm:text-xs text-green-400">
              <Volume2 className="w-3 h-3" />
              <span>{audioCount}</span>
            </div>
          )}
        </div>

        {/* Shows appeared in */}
        <p className="text-gray-400 text-[10px] sm:text-xs mt-0.5 sm:mt-1 line-clamp-1">
          {band.shows.length} {band.shows.length !== 1 ? 'shows' : 'show'}
        </p>
      </div>
    </div>
  );
}

export default memo(BandCard);
