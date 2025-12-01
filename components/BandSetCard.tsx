'use client';

import { useState, memo } from 'react';
import Link from 'next/link';
import { Play, Pause, Video, Volume2, Users } from 'lucide-react';
import VideoCover from './VideoCover';
import { DARK_CARD_CLASSES, DARK_BADGE_BG, DARK_BADGE_TEXT } from '@/lib/theme-utils';
import { generateSlug } from '@/lib/url-utils';
import type { BandSet } from '@/lib/band-parser';

interface BandSetCardProps {
  bandSet: BandSet;
  isPlaying?: boolean;
  onPlay: (bandSet: BandSet, e: React.MouseEvent | React.TouchEvent) => void;
  className?: string;
}

function BandSetCard({ bandSet, isPlaying = false, onPlay, className = '' }: BandSetCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Generate album URL from show name with band filter
  const albumUrl = `/album/${encodeURIComponent(generateSlug(bandSet.showName))}?band=${encodeURIComponent(bandSet.bandName)}`;

  return (
    <div className={`group relative ${DARK_CARD_CLASSES} overflow-hidden hover:scale-[1.02] active:scale-[0.98] ${className}`}>
      <Link href={albumUrl} className="block">
        {/* Band Artwork */}
        <div className="relative aspect-square overflow-hidden">
          <VideoCover
            src={bandSet.coverArt}
            alt={`${bandSet.bandName} - ${bandSet.showName}`}
            fill
            className="object-cover"
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
                onPlay(bandSet, e);
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

          {/* Track count badge */}
          <div className={`absolute top-1 right-1 sm:top-2 sm:right-2 ${DARK_BADGE_BG} backdrop-blur-sm rounded-full px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs ${DARK_BADGE_TEXT}`}>
            {bandSet.trackCount} {bandSet.trackCount !== 1 ? 'tracks' : 'track'}
          </div>
        </div>

        {/* Band Info */}
        <div className="p-2 sm:p-3 bg-black/70 backdrop-blur-sm">
          <h3 className="font-semibold text-white text-xs sm:text-sm leading-tight line-clamp-2 group-hover:text-gray-200 transition-colors duration-200">
            {bandSet.bandName}
          </h3>

          {/* Show name */}
          <p className="text-gray-300 text-[10px] sm:text-xs mt-0.5 line-clamp-1">
            {bandSet.showName}
          </p>

          {/* Media type breakdown */}
          <div className="flex items-center gap-2 mt-1">
            {bandSet.videoCount > 0 && (
              <div className="flex items-center gap-0.5 text-[10px] sm:text-xs text-blue-400">
                <Video className="w-3 h-3" />
                <span>{bandSet.videoCount}</span>
              </div>
            )}
            {bandSet.audioCount > 0 && (
              <div className="flex items-center gap-0.5 text-[10px] sm:text-xs text-green-400">
                <Volume2 className="w-3 h-3" />
                <span>{bandSet.audioCount}</span>
              </div>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}

export default memo(BandSetCard);
