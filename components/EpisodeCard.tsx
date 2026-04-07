'use client';

import { useState, memo } from 'react';
import Link from 'next/link';
import { Play, Pause, Clock, Calendar, FileText, Users, Zap, Video, Mic } from 'lucide-react';
import { stripHtml } from '@/lib/html-utils';
import { useLightning } from '@/contexts/LightningContext';
import { DARK_CARD_CLASSES, DARK_BADGE_BG, DARK_BADGE_TEXT } from '@/lib/theme-utils';
import { generateSlug } from '@/lib/url-utils';
import type { Episode, Podcast } from '@/lib/types/podcast';
import VideoCover from './VideoCover';

interface EpisodeCardProps {
  episode: Episode;
  podcast?: Podcast;
  isPlaying?: boolean;
  isCurrentEpisode?: boolean;
  onPlay: (episode: Episode, e: React.MouseEvent | React.TouchEvent) => void;
  onBoostClick?: (episode: Episode, podcast?: Podcast) => void;
  showPodcastInfo?: boolean;
  variant?: 'grid' | 'list';
  className?: string;
}

function EpisodeCard({
  episode,
  podcast,
  isPlaying = false,
  isCurrentEpisode = false,
  onPlay,
  onBoostClick,
  showPodcastInfo = false,
  variant = 'list',
  className = ''
}: EpisodeCardProps) {
  const { isLightningEnabled } = useLightning();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(false);
  };

  // Format publication date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return '';
    }
  };

  // Get episode image (fallback to podcast cover)
  const episodeImage = episode.image || podcast?.coverArt || '';

  // Episode type badge color
  const getEpisodeTypeBadge = () => {
    switch (episode.episodeType) {
      case 'trailer':
        return { bg: 'bg-orange-600/80', text: 'Trailer' };
      case 'bonus':
        return { bg: 'bg-green-600/80', text: 'Bonus' };
      default:
        return null;
    }
  };

  const episodeTypeBadge = getEpisodeTypeBadge();

  // Check if episode has transcripts
  const hasTranscript = episode.transcripts && episode.transcripts.length > 0;

  // Check if episode has persons/guests
  const hasPersons = episode.persons && episode.persons.length > 0;

  // Generate episode URL - prefer title slug over GUID for cleaner URLs
  const podcastSlug = podcast ? generateSlug(podcast.title) : '';
  const episodeSlug = generateSlug(episode.title);
  const episodeUrl = podcast ? `/podcast/${podcastSlug}/episode/${episodeSlug}` : '#';

  if (variant === 'grid') {
    return (
      <Link
        href={episodeUrl}
        className={`group relative ${DARK_CARD_CLASSES} overflow-hidden hover:scale-[1.02] active:scale-[0.98] block ${className}`}
      >
        {/* Episode Artwork */}
        <div className="relative aspect-square overflow-hidden">
          <VideoCover
            src={episodeImage}
            alt={episode.title}
            fill
            className="object-cover"
            onLoad={handleImageLoad}
            onError={handleImageError}
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
          />

          {/* Loading placeholder */}
          {!imageLoaded && !imageError && (
            <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
              {episode.mediaType === 'video' ? (
                <Video className="w-8 h-8 text-gray-400 animate-pulse" />
              ) : (
                <Mic className="w-8 h-8 text-gray-400 animate-pulse" />
              )}
            </div>
          )}

          {/* Error placeholder */}
          {imageError && (
            <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
              {episode.mediaType === 'video' ? (
                <Video className="w-8 h-8 text-gray-400" />
              ) : (
                <Mic className="w-8 h-8 text-gray-400" />
              )}
            </div>
          )}

          {/* Play/Pause Overlay */}
          <div className="absolute inset-0 bg-black/20 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onPlay(episode, e);
              }}
              className="w-14 h-14 md:w-10 md:h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 active:bg-white/40 transition-colors duration-200 touch-manipulation pointer-events-auto"
              aria-label={isPlaying && isCurrentEpisode ? 'Pause' : 'Play'}
            >
              {isPlaying && isCurrentEpisode ? (
                <Pause className="w-5 h-5 text-white" />
              ) : (
                <Play className="w-5 h-5 text-white ml-0.5" />
              )}
            </button>
          </div>

          {/* Episode type badge */}
          {episodeTypeBadge && (
            <div className={`absolute top-1 left-1 sm:top-2 sm:left-2 ${episodeTypeBadge.bg} backdrop-blur-sm rounded-full px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs text-white`}>
              {episodeTypeBadge.text}
            </div>
          )}

          {/* Duration badge */}
          <div className={`absolute top-1 right-1 sm:top-2 sm:right-2 ${DARK_BADGE_BG} backdrop-blur-sm rounded-full px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs ${DARK_BADGE_TEXT} flex items-center gap-1`}>
            <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            {episode.duration}
          </div>

          {/* Media type indicator */}
          <div className={`absolute bottom-1 left-1 sm:bottom-2 sm:left-2 ${episode.mediaType === 'video' ? 'bg-blue-600/80' : 'bg-purple-600/80'} backdrop-blur-sm rounded-full p-1 sm:p-1.5`}>
            {episode.mediaType === 'video' ? (
              <Video className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
            ) : (
              <Mic className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
            )}
          </div>

          {/* Feature indicators */}
          <div className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 flex items-center gap-1">
            {hasTranscript && (
              <div className="bg-gray-600/80 backdrop-blur-sm rounded-full p-1" title="Has transcript">
                <FileText className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
              </div>
            )}
            {hasPersons && (
              <div className="bg-gray-600/80 backdrop-blur-sm rounded-full p-1" title="Has guests">
                <Users className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
              </div>
            )}
          </div>
        </div>

        {/* Episode Info */}
        <div className="p-2 sm:p-3 bg-black/70 backdrop-blur-sm">
          {episode.season && episode.episodeNumber && (
            <p className="text-purple-400 text-[10px] sm:text-xs mb-0.5">
              S{episode.season} E{episode.episodeNumber}
            </p>
          )}
          <h3 className="font-semibold text-white text-xs sm:text-sm leading-tight line-clamp-2">
            {episode.title}
          </h3>
          {showPodcastInfo && podcast && (
            <p className="text-gray-400 text-[10px] sm:text-xs mt-0.5 line-clamp-1">
              {podcast.title}
            </p>
          )}
          {episode.pubDate && (
            <p className="text-gray-500 text-[10px] sm:text-xs mt-0.5">
              {formatDate(episode.pubDate)}
            </p>
          )}
        </div>
      </Link>
    );
  }

  // List variant (default)
  return (
    <Link
      href={episodeUrl}
      className={`group relative flex items-start gap-3 sm:gap-4 p-3 sm:p-4 ${DARK_CARD_CLASSES} hover:bg-white/5 transition-colors ${isCurrentEpisode ? 'ring-2 ring-purple-500/50' : ''} block ${className}`}
    >
      {/* Episode Artwork (smaller for list view) */}
      <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 rounded-lg overflow-hidden">
        <VideoCover
          src={episodeImage}
          alt={episode.title}
          fill
          className="object-cover"
          onLoad={handleImageLoad}
          onError={handleImageError}
          sizes="80px"
        />

        {/* Loading/Error placeholder */}
        {(!imageLoaded || imageError) && (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
            {episode.mediaType === 'video' ? (
              <Video className="w-6 h-6 text-gray-400" />
            ) : (
              <Mic className="w-6 h-6 text-gray-400" />
            )}
          </div>
        )}

        {/* Play button overlay */}
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none group-hover:pointer-events-auto">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPlay(episode, e);
            }}
            className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
            aria-label={isPlaying && isCurrentEpisode ? 'Pause' : 'Play'}
          >
            {isPlaying && isCurrentEpisode ? (
              <Pause className="w-4 h-4 text-white" />
            ) : (
              <Play className="w-4 h-4 text-white ml-0.5" />
            )}
          </button>
        </div>

        {/* Episode type badge */}
        {episodeTypeBadge && (
          <div className={`absolute top-0.5 left-0.5 ${episodeTypeBadge.bg} backdrop-blur-sm rounded px-1 py-0.5 text-[8px] text-white`}>
            {episodeTypeBadge.text}
          </div>
        )}
      </div>

      {/* Episode Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {episode.season && episode.episodeNumber && (
              <p className="text-purple-400 text-[10px] sm:text-xs mb-0.5">
                Season {episode.season}, Episode {episode.episodeNumber}
              </p>
            )}
            <h3 className="font-semibold text-white text-sm sm:text-base leading-tight line-clamp-2">
              {episode.title}
            </h3>
            {showPodcastInfo && podcast && (
              <p className="text-gray-400 text-xs sm:text-sm mt-0.5 line-clamp-1">
                {podcast.title}
              </p>
            )}
          </div>

          {/* Boost button */}
          {isLightningEnabled && episode.paymentRecipients && episode.paymentRecipients.length > 0 && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onBoostClick) {
                  onBoostClick(episode, podcast);
                }
              }}
              className="w-8 h-8 bg-yellow-500/90 hover:bg-yellow-600/90 backdrop-blur-sm rounded-full flex items-center justify-center transition-colors flex-shrink-0"
              aria-label="Boost episode"
            >
              <Zap className="w-4 h-4 text-black" />
            </button>
          )}
        </div>

        {/* Description */}
        {episode.description && (
          <p className="text-gray-400 text-xs sm:text-sm mt-1.5 line-clamp-2">
            {stripHtml(episode.description)}
          </p>
        )}

        {/* Metadata row */}
        <div className="flex items-center gap-3 mt-2 text-gray-500 text-[10px] sm:text-xs">
          {/* Duration */}
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{episode.duration}</span>
          </div>

          {/* Publication date */}
          {episode.pubDate && (
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{formatDate(episode.pubDate)}</span>
            </div>
          )}

          {/* Media type */}
          <div className="flex items-center gap-1">
            {episode.mediaType === 'video' ? (
              <>
                <Video className="w-3 h-3" />
                <span>Video</span>
              </>
            ) : (
              <>
                <Mic className="w-3 h-3" />
                <span>Audio</span>
              </>
            )}
          </div>

          {/* Feature indicators */}
          {hasTranscript && (
            <div className="flex items-center gap-1" title="Has transcript">
              <FileText className="w-3 h-3" />
              <span>Transcript</span>
            </div>
          )}
          {hasPersons && (
            <div className="flex items-center gap-1" title="Has guests">
              <Users className="w-3 h-3" />
              <span>{episode.persons?.length} guest{episode.persons?.length !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export default memo(EpisodeCard);
