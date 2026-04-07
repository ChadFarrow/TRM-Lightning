'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useAudio } from '@/contexts/AudioContext';
import { useLightning } from '@/contexts/LightningContext';
import { toast } from '@/components/Toast';
import { fetchPodcast, episodeToTrack } from '@/lib/podcasts-service';
import { getEnclosureLabel, selectBestSource, getMediaType } from '@/lib/enclosure-utils';
import { generateSlug } from '@/lib/url-utils';
import {
  Play,
  Pause,
  Clock,
  Calendar,
  Zap,
  Loader2,
  ArrowLeft,
  Mic,
  Video,
  FileText,
  Users,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MapPin,
  Scissors,
  Download,
  SkipBack,
  SkipForward,
  X,
  Maximize2
} from 'lucide-react';
import dynamic from 'next/dynamic';
import confetti from 'canvas-confetti';
import { extractColorsFromImage, createAlbumBackground, ExtractedColors } from '@/lib/color-utils';
import { DARK_CARD_CLASSES, DARK_BADGE_BG, DARK_BADGE_TEXT } from '@/lib/theme-utils';
import type { Podcast, Episode, PodcastChapter } from '@/lib/types/podcast';

const BitcoinConnectPayment = dynamic(
  () => import('@/components/BitcoinConnect').then(mod => ({ default: mod.BitcoinConnectPayment })),
  { ssr: false }
);

const PersonDisplay = dynamic(() => import('@/components/PersonDisplay'), {
  loading: () => <div className="h-12 bg-gray-800/50 rounded-lg animate-pulse"></div>,
  ssr: false
});

const PaymentSplitsDisplay = dynamic(() => import('@/components/PaymentSplitsDisplay'), {
  loading: () => <div className="h-20 bg-gray-800/50 rounded-lg animate-pulse"></div>,
  ssr: false
});

interface EpisodeDetailPageProps {
  params: Promise<{ id: string; episodeId: string }>;
}

export default function EpisodeDetailPage({ params }: EpisodeDetailPageProps) {
  const router = useRouter();
  const { id, episodeId } = use(params);
  const { isLightningEnabled } = useLightning();
  const {
    playTrack,
    currentTrack,
    isPlaying,
    pause,
    resume,
    currentTime,
    duration,
    seekTo,
    setExternalPlayerFullscreen,
    closeNowPlaying
  } = useAudio();

  const [podcast, setPodcast] = useState<Podcast | null>(null);
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [extractedColors, setExtractedColors] = useState<ExtractedColors | null>(null);
  const [chapters, setChapters] = useState<PodcastChapter[]>([]);
  const [showTranscript, setShowTranscript] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [loadingTranscript, setLoadingTranscript] = useState(false);

  // Boost modal state
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [boostAmount, setBoostAmount] = useState(50);
  const [senderName, setSenderName] = useState('');
  const [boostMessage, setBoostMessage] = useState('');
  const [boostChapterIndex, setBoostChapterIndex] = useState<number | null>(null); // null = boost whole episode

  // Fullscreen player state
  const [showFullscreenPlayer, setShowFullscreenPlayer] = useState(false);

  // Sync fullscreen state with AudioContext to hide GlobalNowPlayingBar and NowPlayingScreen
  useEffect(() => {
    if (showFullscreenPlayer) {
      setExternalPlayerFullscreen(true);
      closeNowPlaying(); // Close the NowPlayingScreen modal if open
    } else {
      setExternalPlayerFullscreen(false);
    }
    return () => setExternalPlayerFullscreen(false);
  }, [showFullscreenPlayer, setExternalPlayerFullscreen, closeNowPlaying]);

  // Determine if currently playing this episode (computed early for chapter functions)
  const isCurrentEpisode = episode && currentTrack?.guid === episode.guid;
  const isEpisodePlaying = isCurrentEpisode && isPlaying;

  // Get current chapter index based on playback time
  const getCurrentChapterIndex = useCallback(() => {
    if (!chapters.length || !isCurrentEpisode) return -1;
    for (let i = chapters.length - 1; i >= 0; i--) {
      if (currentTime >= chapters[i].startTime) {
        return i;
      }
    }
    return 0;
  }, [chapters, currentTime, isCurrentEpisode]);

  const currentChapterIndex = getCurrentChapterIndex();
  const currentChapter = currentChapterIndex >= 0 ? chapters[currentChapterIndex] : null;

  // Navigate to next chapter
  const nextChapter = useCallback(() => {
    if (!chapters.length || !episode || !podcast) return;

    const nextIndex = currentChapterIndex + 1;
    if (nextIndex < chapters.length) {
      if (!isCurrentEpisode) {
        const track = episodeToTrack(episode, podcast);
        playTrack(track, podcast.title);
        setTimeout(() => seekTo(chapters[nextIndex].startTime), 500);
      } else {
        seekTo(chapters[nextIndex].startTime);
      }
    }
  }, [chapters, currentChapterIndex, episode, podcast, isCurrentEpisode, playTrack, seekTo]);

  // Navigate to previous chapter (or restart current chapter if > 3 seconds in)
  const previousChapter = useCallback(() => {
    if (!chapters.length || !episode || !podcast) return;

    const currentChapterStart = chapters[currentChapterIndex]?.startTime || 0;

    // If more than 3 seconds into chapter, restart current chapter
    if (currentTime - currentChapterStart > 3) {
      seekTo(currentChapterStart);
    } else {
      // Go to previous chapter
      const prevIndex = Math.max(0, currentChapterIndex - 1);
      if (!isCurrentEpisode) {
        const track = episodeToTrack(episode, podcast);
        playTrack(track, podcast.title);
        setTimeout(() => seekTo(chapters[prevIndex].startTime), 500);
      } else {
        seekTo(chapters[prevIndex].startTime);
      }
    }
  }, [chapters, currentChapterIndex, currentTime, episode, podcast, isCurrentEpisode, playTrack, seekTo]);

  // Get payment recipients for a specific time (chapter) based on valueTimeSplits
  const getRecipientsForTime = useCallback((time: number) => {
    if (!episode) return null;

    // Check if there's a valueTimeSplit that covers this time
    if (episode.valueTimeSplits && episode.valueTimeSplits.length > 0) {
      for (const split of episode.valueTimeSplits) {
        if (time >= split.startTime && time < split.startTime + split.duration) {
          return split.recipients || null;
        }
      }
    }

    // Fall back to episode recipients, then podcast recipients
    return episode.paymentRecipients || podcast?.paymentRecipients || null;
  }, [episode, podcast]);

  // Get recipients for current chapter
  const currentChapterRecipients = currentChapter
    ? getRecipientsForTime(currentChapter.startTime)
    : (episode?.paymentRecipients || podcast?.paymentRecipients || null);

  // Load podcast and episode data
  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        setError(null);

        const podcastData = await fetchPodcast(decodeURIComponent(id));

        if (!podcastData) {
          setError('Podcast not found');
          return;
        }

        setPodcast(podcastData);

        // Find episode by guid or slug
        const decodedEpisodeId = decodeURIComponent(episodeId);
        const foundEpisode = podcastData.episodes.find(
          ep => ep.guid === decodedEpisodeId || generateSlug(ep.title) === decodedEpisodeId
        );

        if (!foundEpisode) {
          setError('Episode not found');
          return;
        }

        setEpisode(foundEpisode);

        // Load chapters if available
        if (foundEpisode.chapters && foundEpisode.chapters.length > 0) {
          setChapters(foundEpisode.chapters);
        } else if (foundEpisode.chaptersUrl) {
          try {
            const chaptersResponse = await fetch(`/api/proxy-chapters?url=${encodeURIComponent(foundEpisode.chaptersUrl)}`);
            if (chaptersResponse.ok) {
              const chaptersData = await chaptersResponse.json();
              if (chaptersData.chapters) {
                setChapters(chaptersData.chapters);
              }
            }
          } catch (err) {
            console.warn('Failed to load chapters:', err);
          }
        }

        // Extract colors from episode or podcast cover
        const coverImage = foundEpisode.image || podcastData.coverArt;
        if (coverImage) {
          try {
            const colors = await extractColorsFromImage(coverImage);
            setExtractedColors(colors);
          } catch (err) {
            console.warn('Failed to extract colors:', err);
          }
        }
      } catch (err) {
        console.error('Error loading episode:', err);
        setError('Failed to load episode');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [id, episodeId]);

  // Load transcript
  const loadTranscript = useCallback(async () => {
    if (!episode?.transcripts || episode.transcripts.length === 0) return;
    if (transcript) {
      setShowTranscript(!showTranscript);
      return;
    }

    setLoadingTranscript(true);
    try {
      const transcriptUrl = episode.transcripts[0].url;
      const response = await fetch(`/api/proxy-chapters?url=${encodeURIComponent(transcriptUrl)}`);
      if (response.ok) {
        const text = await response.text();
        setTranscript(text);
        setShowTranscript(true);
      }
    } catch (err) {
      console.warn('Failed to load transcript:', err);
      toast.error('Failed to load transcript');
    } finally {
      setLoadingTranscript(false);
    }
  }, [episode, transcript, showTranscript]);

  // Handle play/pause
  const handlePlayPause = useCallback(() => {
    if (!episode || !podcast) return;

    const isCurrentEpisode = currentTrack?.guid === episode.guid;

    if (isCurrentEpisode) {
      if (isPlaying) {
        pause();
      } else {
        resume();
      }
    } else {
      const track = episodeToTrack(episode, podcast);
      playTrack(track, podcast.title);
    }
  }, [episode, podcast, currentTrack, isPlaying, pause, resume, playTrack]);

  // Handle chapter click
  const handleChapterClick = useCallback((chapter: PodcastChapter) => {
    if (!episode || !podcast) return;

    const isCurrentEpisode = currentTrack?.guid === episode.guid;

    if (!isCurrentEpisode) {
      const track = episodeToTrack(episode, podcast);
      playTrack(track, podcast.title);
    }

    // Seek to chapter start time
    setTimeout(() => {
      seekTo(chapter.startTime);
    }, isCurrentEpisode ? 0 : 500);
  }, [episode, podcast, currentTrack, playTrack, seekTo]);

  // Handle boost success
  const handleBoostSuccess = useCallback(() => {
    setShowBoostModal(false);
    setBoostMessage('');

    const count = 200;
    const defaults = {
      origin: { y: 0.7 },
      colors: ['#FFD700', '#FFA500', '#FF8C00', '#FFE55C', '#FFFF00']
    };

    function fire(particleRatio: number, opts: any) {
      confetti(Object.assign({}, defaults, opts, {
        particleCount: Math.floor(count * particleRatio)
      }));
    }

    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.2, { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    fire(0.1, { spread: 120, startVelocity: 45 });

    toast.success('Boost sent successfully!');
  }, []);

  const handleBoostError = useCallback(() => {
    toast.error('Failed to send boost');
  }, []);

  // Format time for display
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format publication date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return '';
    }
  };

  // Progress percentage
  const progressPercent = isCurrentEpisode && duration > 0 ? (currentTime / duration) * 100 : 0;

  // Get background style
  const backgroundStyle = extractedColors
    ? { background: createAlbumBackground(extractedColors) }
    : {};

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-4" />
          <p className="text-lg text-white">Loading episode...</p>
        </div>
      </div>
    );
  }

  if (error || !podcast || !episode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Mic className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-lg text-white mb-4">{error || 'Episode not found'}</p>
          <Link
            href={`/podcast/${id}`}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Podcast
          </Link>
        </div>
      </div>
    );
  }

  const episodeImage = episode.image || podcast.coverArt;

  return (
    <div className="min-h-screen" style={backgroundStyle}>
      <div className="min-h-screen bg-gradient-to-b from-black/60 via-gray-900/90 to-gray-900">
        <div className="container mx-auto px-4 py-8 pb-32">
          {/* Back button */}
          <Link
            href={`/podcast/${id}`}
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to {podcast.title}
          </Link>

          {/* Episode Header */}
          <div className="flex flex-col md:flex-row gap-6 mb-8">
            {/* Episode Artwork */}
            <div className="relative w-64 h-64 md:w-80 md:h-80 flex-shrink-0 mx-auto md:mx-0">
              <div className="relative w-full h-full rounded-xl overflow-hidden shadow-2xl">
                {episodeImage ? (
                  <Image
                    src={episodeImage}
                    alt={episode.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 256px, 320px"
                    priority
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-600 to-purple-900 flex items-center justify-center">
                    {episode.mediaType === 'video' ? (
                      <Video className="w-16 h-16 text-white/50" />
                    ) : (
                      <Mic className="w-16 h-16 text-white/50" />
                    )}
                  </div>
                )}
              </div>

              {/* Media type badge */}
              <div className={`absolute -bottom-2 -right-2 ${episode.mediaType === 'video' ? 'bg-blue-600' : 'bg-purple-600'} rounded-full px-3 py-1 text-sm text-white flex items-center gap-1 shadow-lg`}>
                {episode.mediaType === 'video' ? (
                  <><Video className="w-3 h-3" /> Video</>
                ) : (
                  <><Mic className="w-3 h-3" /> Audio</>
                )}
              </div>
            </div>

            {/* Episode Info */}
            <div className="flex-1 text-center md:text-left">
              {/* Episode type badge and Season/Episode number */}
              <div className="flex items-center gap-2 justify-center md:justify-start mb-2">
                {episode.episodeType && episode.episodeType !== 'full' && (
                  <span className={`${episode.episodeType === 'trailer' ? 'bg-orange-600' : 'bg-green-600'} px-2 py-0.5 rounded text-xs text-white font-medium`}>
                    {episode.episodeType.charAt(0).toUpperCase() + episode.episodeType.slice(1)}
                  </span>
                )}
                {(episode.season || episode.episodeNumber) && (
                  <span className="text-purple-400 text-sm">
                    {episode.season && `Season ${episode.season}`}
                    {episode.season && episode.episodeNumber && ', '}
                    {episode.episodeNumber && `Episode ${episode.episodeNumber}`}
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2">
                {episode.title}
              </h1>

              {/* Subtitle */}
              {episode.subtitle && (
                <p className="text-gray-400 text-lg mb-2">{episode.subtitle}</p>
              )}

              <Link
                href={`/podcast/${id}`}
                className="text-lg text-gray-300 hover:text-purple-400 transition-colors"
              >
                {podcast.title}
              </Link>

              {/* Metadata */}
              <div className="flex flex-wrap items-center gap-3 justify-center md:justify-start text-gray-400 text-sm mt-4">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {episode.duration}
                </span>
                {episode.pubDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {formatDate(episode.pubDate)}
                  </span>
                )}
                {episode.explicit && (
                  <span className={`${DARK_BADGE_BG} ${DARK_BADGE_TEXT} px-2 py-0.5 rounded text-xs`}>
                    Explicit
                  </span>
                )}
                {episode.mimeType && (
                  <span className="text-gray-500 text-xs">
                    {episode.mimeType}
                  </span>
                )}
              </div>

              {/* Large Play Button & Controls */}
              <div className="mt-6">
                <div className="flex items-center gap-4 justify-center md:justify-start">
                  <button
                    onClick={() => {
                      handlePlayPause();
                      if (chapters.length > 0) {
                        setShowFullscreenPlayer(true);
                      }
                    }}
                    className="w-16 h-16 bg-purple-600 hover:bg-purple-700 text-white rounded-full font-semibold flex items-center justify-center transition-colors shadow-lg"
                    title={chapters.length > 0 ? "Play and open fullscreen player" : "Play/Pause"}
                  >
                    {isEpisodePlaying ? (
                      <Pause className="w-7 h-7" />
                    ) : (
                      <Play className="w-7 h-7 ml-1" />
                    )}
                  </button>

                  {isLightningEnabled && (episode.paymentRecipients?.length || podcast.paymentRecipients?.length) && (
                    <button
                      onClick={() => {
                        setBoostChapterIndex(null); // Boost whole episode
                        setBoostMessage('');
                        setShowBoostModal(true);
                      }}
                      className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-black rounded-full font-semibold flex items-center gap-2 transition-colors"
                    >
                      <Zap className="w-5 h-5" />
                      Boost
                    </button>
                  )}
                </div>

                {/* Progress bar and chapter controls (only show if this episode is current) */}
                {isCurrentEpisode && (
                  <div className="mt-4 max-w-md mx-auto md:mx-0">
                    {/* Current chapter display */}
                    {currentChapter && (
                      <div className="text-sm text-purple-400 mb-2 truncate">
                        <span className="text-gray-500">Chapter:</span> {currentChapter.title}
                      </div>
                    )}

                    {/* Progress bar */}
                    <div
                      className="h-2 bg-gray-700 rounded-full cursor-pointer"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const percent = (e.clientX - rect.left) / rect.width;
                        seekTo(percent * duration);
                      }}
                    >
                      <div
                        className="h-full bg-purple-500 rounded-full transition-all"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>

                    {/* Chapter skip controls */}
                    {chapters.length > 0 && (
                      <div className="flex items-center justify-center gap-4 mt-3">
                        <button
                          onClick={previousChapter}
                          className="p-2 hover:bg-white/10 rounded-full transition-colors"
                          title="Previous chapter"
                        >
                          <SkipBack className="w-5 h-5 text-gray-300" />
                        </button>
                        <span className="text-xs text-gray-400">
                          {currentChapterIndex + 1} / {chapters.length}
                        </span>
                        <button
                          onClick={nextChapter}
                          disabled={currentChapterIndex >= chapters.length - 1}
                          className="p-2 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50"
                          title="Next chapter"
                        >
                          <SkipForward className="w-5 h-5 text-gray-300" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Description / Summary */}
          {(episode.description || episode.summary) && (
            <div className={`${DARK_CARD_CLASSES} p-4 sm:p-6 mb-6`}>
              <h2 className="text-lg font-semibold text-white mb-3">Episode Description</h2>
              <div
                className="text-gray-300 prose prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: episode.description || episode.summary || '' }}
              />
            </div>
          )}

          {/* Chapters */}
          {chapters.length > 0 && (
            <div className={`${DARK_CARD_CLASSES} p-4 sm:p-6 mb-6`}>
              <h2 className="text-lg font-semibold text-white mb-3">Chapters</h2>
              <div className="space-y-2">
                {chapters.map((chapter, index) => {
                  const chapterRecipients = getRecipientsForTime(chapter.startTime);
                  const hasSpecificRecipients = episode?.valueTimeSplits?.some(
                    split => chapter.startTime >= split.startTime && chapter.startTime < split.startTime + split.duration
                  );

                  return (
                    <div
                      key={index}
                      className={`flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors ${
                        index === currentChapterIndex && isCurrentEpisode ? 'bg-purple-600/20 ring-1 ring-purple-500/50' : ''
                      }`}
                    >
                      {/* Chapter image */}
                      {chapter.img && (
                        <div className="relative w-12 h-12 rounded overflow-hidden flex-shrink-0">
                          <Image
                            src={chapter.img}
                            alt={chapter.title}
                            fill
                            className="object-cover"
                            sizes="48px"
                          />
                        </div>
                      )}

                      {/* Chapter info */}
                      <button
                        onClick={() => handleChapterClick(chapter)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <p className={`font-medium truncate ${index === currentChapterIndex && isCurrentEpisode ? 'text-purple-400' : 'text-white'}`}>
                          {chapter.title}
                        </p>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-400">{formatTime(chapter.startTime)}</span>
                          {hasSpecificRecipients && (
                            <span className="text-yellow-500 flex items-center gap-1">
                              <Zap className="w-3 h-3" />
                              <span className="text-xs">Split</span>
                            </span>
                          )}
                        </div>
                      </button>

                      {/* Play button */}
                      <button
                        onClick={() => handleChapterClick(chapter)}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                        title="Play chapter"
                      >
                        {index === currentChapterIndex && isCurrentEpisode && isEpisodePlaying ? (
                          <Pause className="w-4 h-4 text-purple-400" />
                        ) : (
                          <Play className="w-4 h-4 text-gray-400" />
                        )}
                      </button>

                      {/* Boost button for chapter (if lightning enabled and has recipients) */}
                      {isLightningEnabled && chapterRecipients && chapterRecipients.length > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Set boost context to this chapter
                            setBoostChapterIndex(index);
                            setBoostAmount(50);
                            setBoostMessage('');
                            setShowBoostModal(true);
                          }}
                          className="p-2 hover:bg-yellow-500/20 rounded-full transition-colors"
                          title="Boost this chapter"
                        >
                          <Zap className="w-4 h-4 text-yellow-500" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Guests/Contributors */}
          {episode.persons && episode.persons.length > 0 && (
            <div className={`${DARK_CARD_CLASSES} p-4 sm:p-6 mb-6`}>
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-400" />
                Guests & Contributors
              </h2>
              <PersonDisplay persons={episode.persons} variant="full" />
            </div>
          )}

          {/* Transcript */}
          {episode.transcripts && episode.transcripts.length > 0 && (
            <div className={`${DARK_CARD_CLASSES} p-4 sm:p-6 mb-6`}>
              <button
                onClick={loadTranscript}
                className="w-full flex items-center justify-between text-left"
                disabled={loadingTranscript}
              >
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-400" />
                  Transcript
                </h2>
                {loadingTranscript ? (
                  <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                ) : showTranscript ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>
              {showTranscript && transcript && (
                <div className="mt-4 text-gray-300 text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
                  {transcript}
                </div>
              )}
            </div>
          )}

          {/* Soundbites */}
          {episode.soundbites && episode.soundbites.length > 0 && (
            <div className={`${DARK_CARD_CLASSES} p-4 sm:p-6 mb-6`}>
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <Scissors className="w-5 h-5 text-purple-400" />
                Soundbites
              </h2>
              <div className="space-y-2">
                {episode.soundbites.map((soundbite, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      if (!isCurrentEpisode) {
                        const track = episodeToTrack(episode, podcast);
                        playTrack(track, podcast.title);
                        setTimeout(() => seekTo(soundbite.startTime), 500);
                      } else {
                        seekTo(soundbite.startTime);
                      }
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors text-left"
                  >
                    <div className="w-10 h-10 bg-purple-600/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <Play className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">
                        {soundbite.title || `Soundbite ${index + 1}`}
                      </p>
                      <p className="text-gray-400 text-sm">
                        {formatTime(soundbite.startTime)} · {soundbite.duration}s
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Location */}
          {episode.location && (
            <div className={`${DARK_CARD_CLASSES} p-4 sm:p-6 mb-6`}>
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-green-400" />
                Location
              </h2>
              <p className="text-gray-300">{episode.location.name}</p>
              {episode.location.geo && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${episode.location.geo.replace('geo:', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:text-purple-300 text-sm mt-2 inline-flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  View on map
                </a>
              )}
            </div>
          )}

          {/* Alternate Enclosures (different quality/format options) */}
          {episode.alternateEnclosures && episode.alternateEnclosures.length > 0 && (
            <div className={`${DARK_CARD_CLASSES} p-4 sm:p-6 mb-6`}>
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                {getMediaType(episode.alternateEnclosures[0]?.type || '') === 'video' ? (
                  <Video className="w-5 h-5 text-blue-400" />
                ) : (
                  <Download className="w-5 h-5 text-blue-400" />
                )}
                Alternate Formats
              </h2>
              <div className="space-y-2">
                {episode.alternateEnclosures.map((enclosure, index) => {
                  const sourceUrl = selectBestSource(enclosure);
                  if (!sourceUrl) return null;
                  return (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      <button
                        onClick={() => {
                          if (podcast) {
                            const track = episodeToTrack(episode, podcast);
                            track.url = sourceUrl;
                            track.mimeType = enclosure.type;
                            track.mediaType = getMediaType(enclosure.type);
                            playTrack(track, podcast.title);
                          }
                        }}
                        className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                        title={`Play ${getEnclosureLabel(enclosure)}`}
                      >
                        <Play className="w-4 h-4 text-white" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium">
                          {getEnclosureLabel(enclosure)}
                        </p>
                        <p className="text-gray-400 text-sm">
                          {enclosure.type}
                          {enclosure.bitrate && ` · ${enclosure.bitrate}kbps`}
                          {enclosure.height && ` · ${enclosure.height}p`}
                        </p>
                      </div>
                      <a
                        href={sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-400 hover:text-white transition-colors"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Value/Payment Splits */}
          {isLightningEnabled && (episode.paymentRecipients || podcast.paymentRecipients) && (
            <div className={`${DARK_CARD_CLASSES} p-4 sm:p-6 mb-6`}>
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                Value Splits
              </h2>
              <PaymentSplitsDisplay
                recipients={episode.paymentRecipients || podcast.paymentRecipients || []}
                totalAmount={0}
              />
            </div>
          )}

          {/* External link */}
          {episode.link && (
            <div className={`${DARK_CARD_CLASSES} p-4 sm:p-6 mb-6`}>
              <a
                href={episode.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                View on podcast website
              </a>
            </div>
          )}
        </div>

        {/* Fullscreen Player Modal */}
        {showFullscreenPlayer && chapters.length > 0 && (
          <div className="fixed inset-0 z-[60] bg-black flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <div className="flex items-center gap-3">
                {(episode.image || podcast.coverArt) && (
                  <div className="relative w-12 h-12 rounded overflow-hidden">
                    <Image
                      src={episode.image || podcast.coverArt}
                      alt={episode.title}
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  </div>
                )}
                <div>
                  <h3 className="text-white font-semibold truncate max-w-[200px] sm:max-w-none">
                    {episode.title}
                  </h3>
                  <p className="text-gray-400 text-sm">{podcast.title}</p>
                </div>
              </div>
              <button
                onClick={() => setShowFullscreenPlayer(false)}
                className="p-2 hover:bg-gray-800 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            {/* Main content area - current chapter */}
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              {currentChapter?.img && (
                <div className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-xl overflow-hidden shadow-2xl mb-6">
                  <Image
                    src={currentChapter.img}
                    alt={currentChapter.title}
                    fill
                    className="object-cover"
                    sizes="320px"
                  />
                </div>
              )}
              <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-2">
                {currentChapter?.title || episode.title}
              </h2>
              <p className="text-gray-400 text-center">
                Chapter {currentChapterIndex + 1} of {chapters.length}
              </p>
            </div>

            {/* Controls */}
            <div className="p-6 border-t border-gray-800">
              {/* Progress bar */}
              <div className="mb-4">
                <div
                  className="h-2 bg-gray-700 rounded-full cursor-pointer"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const percent = (e.clientX - rect.left) / rect.width;
                    seekTo(percent * duration);
                  }}
                >
                  <div
                    className="h-full bg-purple-500 rounded-full transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Playback controls */}
              <div className="flex items-center justify-center gap-6">
                <button
                  onClick={previousChapter}
                  className="p-3 hover:bg-gray-800 rounded-full transition-colors"
                  title="Previous chapter"
                >
                  <SkipBack className="w-8 h-8 text-white" />
                </button>
                <button
                  onClick={handlePlayPause}
                  className="w-20 h-20 bg-purple-600 hover:bg-purple-700 rounded-full flex items-center justify-center transition-colors"
                >
                  {isEpisodePlaying ? (
                    <Pause className="w-10 h-10 text-white" />
                  ) : (
                    <Play className="w-10 h-10 text-white ml-1" />
                  )}
                </button>
                <button
                  onClick={nextChapter}
                  disabled={currentChapterIndex >= chapters.length - 1}
                  className="p-3 hover:bg-gray-800 rounded-full transition-colors disabled:opacity-50"
                  title="Next chapter"
                >
                  <SkipForward className="w-8 h-8 text-white" />
                </button>
              </div>
            </div>

          </div>
        )}

        {/* Boost Modal */}
        {showBoostModal && isLightningEnabled && (() => {
          // Determine recipients based on whether boosting a chapter or the whole episode
          const boostChapter = boostChapterIndex !== null ? chapters[boostChapterIndex] : null;
          const boostRecipients = boostChapter
            ? getRecipientsForTime(boostChapter.startTime)
            : (episode.paymentRecipients || podcast.paymentRecipients);
          const boostTitle = boostChapter ? boostChapter.title : episode.title;

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <div className={`${DARK_CARD_CLASSES} p-6 max-w-md w-full max-h-[90vh] overflow-y-auto`}>
                <div className="flex items-center gap-3 mb-4">
                  <Zap className="w-6 h-6 text-yellow-500" />
                  <div>
                    <h3 className="text-xl font-semibold text-white">
                      {boostChapter ? 'Boost Chapter' : 'Boost Episode'}
                    </h3>
                    {boostChapter && (
                      <p className="text-sm text-gray-400 truncate">{boostChapter.title}</p>
                    )}
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-gray-400 text-sm mb-2">Amount (sats)</label>
                  <input
                    type="number"
                    value={boostAmount}
                    onChange={(e) => setBoostAmount(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    min="1"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-gray-400 text-sm mb-2">Your Name (optional)</label>
                  <input
                    type="text"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="Anonymous"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="mb-6">
                  <label className="block text-gray-400 text-sm mb-2">Message (optional)</label>
                  <textarea
                    value={boostMessage}
                    onChange={(e) => setBoostMessage(e.target.value)}
                    placeholder="Say something nice..."
                    rows={3}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 resize-none"
                  />
                </div>

                {/* Show recipients */}
                {boostRecipients && boostRecipients.length > 0 && (
                  <div className="mb-4 p-3 bg-gray-800/50 rounded-lg">
                    <p className="text-xs text-gray-400 mb-2">Payment splits:</p>
                    <div className="space-y-1">
                      {boostRecipients.slice(0, 3).map((r, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-gray-300 truncate">{r.name || 'Recipient'}</span>
                          <span className="text-gray-400">{r.split}%</span>
                        </div>
                      ))}
                      {boostRecipients.length > 3 && (
                        <p className="text-xs text-gray-500">+{boostRecipients.length - 3} more</p>
                      )}
                    </div>
                  </div>
                )}

                <BitcoinConnectPayment
                  amount={boostAmount}
                  recipient={boostRecipients?.[0]?.address || ''}
                  recipients={boostRecipients?.map(r => ({
                    address: r.address,
                    split: r.split,
                    name: r.name,
                    fee: r.fee,
                    type: r.type
                  }))}
                  enableBoosts={true}
                  boostMetadata={{
                    title: boostTitle,
                    podcastFeedGuid: podcast.feedGuid,
                    itemGuid: episode.guid,
                    senderName: senderName || 'Anonymous',
                    message: boostMessage
                  }}
                  onSuccess={handleBoostSuccess}
                  onError={handleBoostError}
                />

                <button
                  onClick={() => {
                    setShowBoostModal(false);
                    setBoostChapterIndex(null);
                  }}
                  className="w-full mt-4 px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
