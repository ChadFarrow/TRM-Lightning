'use client';

import { useState, useEffect, memo } from 'react';
import Image from 'next/image';
import { ChevronDown, ChevronUp, Play, Clock, ExternalLink, List } from 'lucide-react';
import { PodcastParser } from '@/lib/podcast-parser';
import type { PodcastChapter } from '@/lib/types/podcast';
import { DARK_CARD_CLASSES } from '@/lib/theme-utils';

interface ChapterNavigationProps {
  chaptersUrl?: string;
  chapters?: PodcastChapter[];
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  variant?: 'compact' | 'full';
  className?: string;
}

function ChapterNavigation({
  chaptersUrl,
  chapters: initialChapters,
  currentTime,
  duration,
  onSeek,
  variant = 'compact',
  className = ''
}: ChapterNavigationProps) {
  const [chapters, setChapters] = useState<PodcastChapter[]>(initialChapters || []);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch chapters from URL if provided
  useEffect(() => {
    if (chaptersUrl && (!initialChapters || initialChapters.length === 0)) {
      setIsLoading(true);
      setError(null);

      PodcastParser.fetchChapters(chaptersUrl)
        .then((fetchedChapters) => {
          setChapters(fetchedChapters);
        })
        .catch((err) => {
          console.error('Error fetching chapters:', err);
          setError('Failed to load chapters');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [chaptersUrl, initialChapters]);

  // Update chapters if initialChapters changes
  useEffect(() => {
    if (initialChapters && initialChapters.length > 0) {
      setChapters(initialChapters);
    }
  }, [initialChapters]);

  // Find current chapter based on playback time
  const getCurrentChapterIndex = (): number => {
    for (let i = chapters.length - 1; i >= 0; i--) {
      if (currentTime >= chapters[i].startTime) {
        return i;
      }
    }
    return 0;
  };

  const currentChapterIndex = getCurrentChapterIndex();
  const currentChapter = chapters[currentChapterIndex];

  // Format time as MM:SS or H:MM:SS
  const formatTime = (seconds: number): string => {
    const totalSeconds = Math.floor(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate chapter progress
  const getChapterProgress = (chapterIndex: number): number => {
    const chapter = chapters[chapterIndex];
    const nextChapter = chapters[chapterIndex + 1];

    const chapterStart = chapter.startTime;
    const chapterEnd = nextChapter?.startTime || duration;
    const chapterDuration = chapterEnd - chapterStart;

    if (currentTime < chapterStart) return 0;
    if (currentTime >= chapterEnd) return 100;

    return ((currentTime - chapterStart) / chapterDuration) * 100;
  };

  if (isLoading) {
    return (
      <div className={`${DARK_CARD_CLASSES} p-3 ${className}`}>
        <div className="flex items-center gap-2 text-gray-400">
          <List className="w-4 h-4 animate-pulse" />
          <span className="text-sm">Loading chapters...</span>
        </div>
      </div>
    );
  }

  if (error || chapters.length === 0) {
    return null;
  }

  if (variant === 'compact') {
    return (
      <div className={`${DARK_CARD_CLASSES} ${className}`}>
        {/* Current chapter display */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full p-3 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            {currentChapter?.img && (
              <div className="relative w-10 h-10 rounded overflow-hidden flex-shrink-0">
                <Image
                  src={currentChapter.img}
                  alt={currentChapter.title}
                  fill
                  className="object-cover"
                  sizes="40px"
                />
              </div>
            )}
            <div className="min-w-0 text-left">
              <p className="text-white text-sm font-medium truncate">
                {currentChapter?.title || 'Chapter'}
              </p>
              <p className="text-gray-400 text-xs">
                Chapter {currentChapterIndex + 1} of {chapters.length}
              </p>
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
          )}
        </button>

        {/* Chapter progress bar */}
        <div className="px-3 pb-2">
          <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 transition-all duration-200"
              style={{ width: `${getChapterProgress(currentChapterIndex)}%` }}
            />
          </div>
        </div>

        {/* Expanded chapter list */}
        {isExpanded && (
          <div className="border-t border-gray-800 max-h-64 overflow-y-auto">
            {chapters.map((chapter, index) => (
              <button
                key={index}
                onClick={() => {
                  onSeek(chapter.startTime);
                  setIsExpanded(false);
                }}
                className={`w-full p-3 flex items-center gap-3 hover:bg-white/5 transition-colors ${
                  index === currentChapterIndex ? 'bg-purple-500/10' : ''
                }`}
              >
                {chapter.img && (
                  <div className="relative w-8 h-8 rounded overflow-hidden flex-shrink-0">
                    <Image
                      src={chapter.img}
                      alt={chapter.title}
                      fill
                      className="object-cover"
                      sizes="32px"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0 text-left">
                  <p className={`text-sm truncate ${
                    index === currentChapterIndex ? 'text-purple-400 font-medium' : 'text-white'
                  }`}>
                    {chapter.title}
                  </p>
                </div>
                <span className="text-gray-400 text-xs flex-shrink-0">
                  {formatTime(chapter.startTime)}
                </span>
                {index === currentChapterIndex && (
                  <Play className="w-3 h-3 text-purple-400 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Full variant - always show all chapters
  return (
    <div className={`${DARK_CARD_CLASSES} ${className}`}>
      <div className="p-4 border-b border-gray-800">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <List className="w-5 h-5 text-purple-400" />
          Chapters ({chapters.length})
        </h3>
      </div>

      <div className="divide-y divide-gray-800 max-h-96 overflow-y-auto">
        {chapters.map((chapter, index) => {
          const isCurrentChapter = index === currentChapterIndex;
          const progress = getChapterProgress(index);

          return (
            <button
              key={index}
              onClick={() => onSeek(chapter.startTime)}
              className={`w-full p-4 flex items-start gap-4 hover:bg-white/5 transition-colors text-left ${
                isCurrentChapter ? 'bg-purple-500/10' : ''
              }`}
            >
              {chapter.img && (
                <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                  <Image
                    src={chapter.img}
                    alt={chapter.title}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                  {isCurrentChapter && (
                    <div className="absolute inset-0 bg-purple-500/30 flex items-center justify-center">
                      <Play className="w-6 h-6 text-white" />
                    </div>
                  )}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className={`font-medium mb-1 ${
                  isCurrentChapter ? 'text-purple-400' : 'text-white'
                }`}>
                  {chapter.title}
                </p>

                <div className="flex items-center gap-3 text-gray-400 text-sm">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(chapter.startTime)}
                  </span>

                  {chapter.url && (
                    <a
                      href={chapter.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 hover:text-purple-400 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Link
                    </a>
                  )}
                </div>

                {/* Chapter progress bar */}
                {isCurrentChapter && (
                  <div className="mt-2 h-1 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 transition-all duration-200"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
              </div>

              <span className="text-gray-500 text-sm flex-shrink-0">
                #{index + 1}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default memo(ChapterNavigation);
