'use client';

import { useState, useEffect, memo } from 'react';
import Link from 'next/link';
import { Play, Pause, Mic, Zap } from 'lucide-react';
import { useLightning } from '@/contexts/LightningContext';
import { generateSlug } from '@/lib/url-utils';
import { DARK_CARD_CLASSES, DARK_BADGE_BG, DARK_BADGE_TEXT } from '@/lib/theme-utils';
import type { Podcast } from '@/lib/types/podcast';
import VideoCover from './VideoCover';

interface PodcastCardProps {
  podcast: Podcast;
  isPlaying?: boolean;
  onPlay: (podcast: Podcast, e: React.MouseEvent | React.TouchEvent) => void;
  onBoostClick?: (podcast: Podcast) => void;
  className?: string;
}

function PodcastCard({ podcast, isPlaying = false, onPlay, onBoostClick, className = '' }: PodcastCardProps) {
  const { isLightningEnabled } = useLightning();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      console.log('Left swipe detected - next episode');
    } else if (isRightSwipe) {
      console.log('Right swipe detected - previous episode');
    }
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(false);
  };

  const getPodcastUrl = (podcast: Podcast) => {
    const slug = generateSlug(podcast.title);
    return `/podcast/${encodeURIComponent(slug)}`;
  };

  const podcastUrl = getPodcastUrl(podcast);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🎙️ Podcast card mounted: "${podcast.title}" -> URL: ${podcastUrl}`);
    }
  }, [podcast.title, podcastUrl]);

  // Format episode count
  const episodeCount = podcast.episodes.length;
  const episodeText = episodeCount === 1 ? '1 episode' : `${episodeCount} episodes`;

  return (
    <div className={`group relative ${DARK_CARD_CLASSES} overflow-hidden hover:scale-[1.02] active:scale-[0.98] block ${className}`}>

      <Link
        href={podcastUrl}
        aria-label={`View podcast details for ${podcast.title} by ${podcast.author}`}
        className="block"
      >
      {/* Podcast Artwork */}
      <div
        className="relative aspect-square overflow-hidden"
        onTouchStart={(e) => {
          if (!(e.target as HTMLElement).closest('button')) {
            onTouchStart(e);
          }
        }}
        onTouchMove={(e) => {
          if (!(e.target as HTMLElement).closest('button')) {
            onTouchMove(e);
          }
        }}
        onTouchEnd={(e) => {
          if (!(e.target as HTMLElement).closest('button')) {
            onTouchEnd(e);
          }
        }}
      >
        <VideoCover
          src={podcast.coverArt}
          alt={`${podcast.title} by ${podcast.author}`}
          fill
          className="object-cover"
          onLoad={handleImageLoad}
          onError={handleImageError}
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
        />

        {/* Loading placeholder */}
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
            <Mic className="w-8 h-8 text-gray-400 animate-pulse" />
          </div>
        )}

        {/* Error placeholder */}
        {imageError && (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
            <Mic className="w-8 h-8 text-gray-400" />
          </div>
        )}

        {/* Play/Pause Overlay */}
        <div className="absolute inset-0 bg-black/20 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();

              const scrolling = document.body.classList.contains('is-scrolling');
              if (!scrolling) {
                onPlay(podcast, e);
              }
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              (e.currentTarget as HTMLElement).dataset.touched = 'true';
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();

              const button = e.currentTarget as HTMLElement;
              if (button.dataset.touched === 'true') {
                delete button.dataset.touched;
                setTimeout(() => {
                  const scrolling = document.body.classList.contains('is-scrolling');
                  if (!scrolling) {
                    onPlay(podcast, e);
                  }
                }, 150);
              }
            }}
            className="w-16 h-16 md:w-12 md:h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 active:bg-white/40 transition-colors duration-200 touch-manipulation pointer-events-auto"
            aria-label={isPlaying ? 'Pause' : 'Play latest episode'}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 text-white" />
            ) : (
              <Play className="w-6 h-6 text-white ml-1" />
            )}
          </button>
        </div>

        {/* Lightning boost button */}
        {isLightningEnabled && podcast.paymentRecipients && podcast.paymentRecipients.length > 0 && (
          <div className="absolute top-1 left-1 sm:top-2 sm:left-2 flex items-center gap-1 sm:gap-2">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onBoostClick) {
                  onBoostClick(podcast);
                }
              }}
              className="w-6 h-6 sm:w-7 sm:h-7 bg-yellow-500/90 hover:bg-yellow-600/90 backdrop-blur-sm rounded-full flex items-center justify-center transition-colors z-10"
              aria-label={`Boost ${podcast.author}`}
            >
              <Zap className="w-3 h-3 sm:w-4 sm:h-4 text-black" />
            </button>
          </div>
        )}

        {/* Episode count badge */}
        {episodeCount > 0 && (
          <div className={`absolute top-1 right-1 sm:top-2 sm:right-2 ${DARK_BADGE_BG} backdrop-blur-sm rounded-full px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs ${DARK_BADGE_TEXT}`}>
            {episodeText}
          </div>
        )}

        {/* Podcast indicator badge */}
        <div className="absolute bottom-1 left-1 sm:bottom-2 sm:left-2 bg-purple-600/80 backdrop-blur-sm rounded-full px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs text-white flex items-center gap-1">
          <Mic className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
          <span>Podcast</span>
        </div>
      </div>

      {/* Podcast Info */}
      <div className="p-2 sm:p-3 bg-black/70 backdrop-blur-sm">
        <h3 className="font-semibold text-white text-xs sm:text-sm leading-tight line-clamp-2 group-hover:text-gray-200 transition-colors duration-200">
          {podcast.title}
        </h3>
        <p className="text-gray-300 text-[10px] sm:text-xs mt-0.5 sm:mt-1 line-clamp-1">
          {podcast.author}
        </p>

        {/* Categories or description preview */}
        <div className="flex items-center justify-between mt-0.5 sm:mt-1">
          {podcast.categories && podcast.categories.length > 0 ? (
            <p className="text-gray-400 text-[10px] sm:text-xs line-clamp-1">
              {podcast.categories[0]}
            </p>
          ) : podcast.description ? (
            <p className="text-gray-400 text-[10px] sm:text-xs line-clamp-1">
              {podcast.description.substring(0, 50)}...
            </p>
          ) : null}
        </div>
      </div>

      {/* Mobile touch feedback */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-white/5 opacity-0 group-active:opacity-100 transition-opacity duration-150" />
      </div>
      </Link>
    </div>
  );
}

export default memo(PodcastCard);
