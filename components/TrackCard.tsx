'use client';

import { useState, memo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Play, Pause, Music, Zap, Video, Volume2 } from 'lucide-react';
import { useLightning } from '@/contexts/LightningContext';
import { DARK_CARD_CLASSES, DARK_BADGE_BG, DARK_BADGE_TEXT } from '@/lib/theme-utils';
import { generateSlug } from '@/lib/url-utils';
import type { TrackWithContext } from '@/lib/band-parser';

interface TrackCardProps {
  track: TrackWithContext;
  isPlaying?: boolean;
  onPlay: (track: TrackWithContext, e: React.MouseEvent | React.TouchEvent) => void;
  onBoostClick?: (track: TrackWithContext) => void;
  className?: string;
}

function TrackCard({ track, isPlaying = false, onPlay, onBoostClick, className = '' }: TrackCardProps) {
  const { isLightningEnabled } = useLightning();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const coverImage = track.image || track.albumCoverArt;
  const isVideo = track.mediaType === 'video';

  // Generate album URL from album title
  const albumUrl = `/album/${encodeURIComponent(generateSlug(track.albumTitle))}`;

  return (
    <div className={`group relative ${DARK_CARD_CLASSES} overflow-hidden hover:scale-[1.02] active:scale-[0.98] ${className}`}>
      <Link href={albumUrl} className="block">
        {/* Track Artwork */}
        <div className="relative aspect-square overflow-hidden">
          <Image
            src={coverImage}
            alt={track.title}
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
              <Music className="w-8 h-8 text-gray-400 animate-pulse" />
            </div>
          )}

          {/* Error placeholder */}
          {imageError && (
            <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
              <Music className="w-8 h-8 text-gray-400" />
            </div>
          )}

          {/* Play/Pause Overlay */}
          <div className="absolute inset-0 bg-black/20 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onPlay(track, e);
              }}
              className="w-16 h-16 md:w-12 md:h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 active:bg-white/40 transition-colors duration-200 touch-manipulation pointer-events-auto"
              aria-label={isPlaying ? 'Pause' : 'Play'}
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
                  onBoostClick(track);
                }}
                className="w-6 h-6 sm:w-7 sm:h-7 bg-yellow-500/90 hover:bg-yellow-600/90 backdrop-blur-sm rounded-full flex items-center justify-center transition-colors z-10"
                aria-label={`Boost ${track.title}`}
              >
                <Zap className="w-3 h-3 sm:w-4 sm:h-4 text-black" />
              </button>
            </div>
          )}

          {/* Media type badge */}
          <div className={`absolute top-1 right-1 sm:top-2 sm:right-2 ${DARK_BADGE_BG} backdrop-blur-sm rounded-full px-1.5 sm:px-2 py-0.5 sm:py-1 flex items-center gap-1`}>
            {isVideo ? (
              <Video className="w-3 h-3 text-blue-400" />
            ) : (
              <Volume2 className="w-3 h-3 text-green-400" />
            )}
            <span className={`text-[10px] sm:text-xs ${DARK_BADGE_TEXT}`}>
              {track.duration}
            </span>
          </div>
        </div>

        {/* Track Info */}
        <div className="p-2 sm:p-3 bg-black/70 backdrop-blur-sm">
          <h3 className="font-semibold text-white text-xs sm:text-sm leading-tight line-clamp-2 group-hover:text-gray-200 transition-colors duration-200">
            {track.title}
          </h3>
          <p className="text-gray-300 text-[10px] sm:text-xs mt-0.5 sm:mt-1 line-clamp-1">
            {track.albumTitle}
          </p>
        </div>
      </Link>
    </div>
  );
}

export default memo(TrackCard);
