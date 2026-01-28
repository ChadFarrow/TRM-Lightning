'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAudio } from '@/contexts/AudioContext';
import { useLightning } from '@/contexts/LightningContext';
import { toast } from '@/components/Toast';
import { fetchPodcasts, podcastToAlbum, fetchAllEpisodes, episodeToTrack } from '@/lib/podcasts-service';
import { Mic, Clock, ArrowRight, Zap, Loader2 } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import confetti from 'canvas-confetti';
import { generateSlug } from '@/lib/url-utils';
import { getSiteName } from '@/lib/site-config';
import { DARK_CARD_CLASSES, DARK_BADGE_BG, DARK_BADGE_TEXT } from '@/lib/theme-utils';
import type { Podcast, Episode } from '@/lib/types/podcast';
import type { Album, Track } from '@/lib/types/album';

// Dynamic imports for components
const PodcastCard = dynamic(() => import('@/components/PodcastCard'), {
  loading: () => <div className="bg-white/5 backdrop-blur-sm rounded-xl aspect-square animate-pulse"></div>,
  ssr: false
});

const EpisodeCard = dynamic(() => import('@/components/EpisodeCard'), {
  loading: () => <div className="bg-white/5 backdrop-blur-sm rounded-xl h-24 animate-pulse"></div>,
  ssr: false
});

const BitcoinConnectPayment = dynamic(
  () => import('@/components/BitcoinConnect').then(mod => ({ default: mod.BitcoinConnectPayment })),
  { ssr: false }
);

export default function PodcastsPage() {
  const { isLightningEnabled } = useLightning();
  const { playAlbumAndOpenNowPlaying, currentTrack, isPlaying } = useAudio();

  const [isLoading, setIsLoading] = useState(true);
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [latestEpisodes, setLatestEpisodes] = useState<(Episode & { podcast: Podcast })[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Boost modal state
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [selectedPodcast, setSelectedPodcast] = useState<Podcast | null>(null);
  const [boostAmount, setBoostAmount] = useState(50);
  const [senderName, setSenderName] = useState('');
  const [boostMessage, setBoostMessage] = useState('');

  // Load podcasts on mount
  useEffect(() => {
    async function loadPodcasts() {
      try {
        setIsLoading(true);
        setError(null);

        const [podcastsData, episodesData] = await Promise.all([
          fetchPodcasts(),
          fetchAllEpisodes({ limit: 10 })
        ]);

        setPodcasts(podcastsData);
        setLatestEpisodes(episodesData.episodes);
      } catch (err) {
        console.error('Error loading podcasts:', err);
        setError('Failed to load podcasts. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    }

    loadPodcasts();
  }, []);

  // Handle playing a podcast (starts with first episode)
  const handlePlayPodcast = useCallback((podcast: Podcast, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (podcast.episodes.length === 0) {
      toast.error('This podcast has no episodes');
      return;
    }

    const album = podcastToAlbum(podcast);
    playAlbumAndOpenNowPlaying(album as unknown as Album);
    toast.success(`Now playing: ${podcast.title}`);
  }, [playAlbumAndOpenNowPlaying]);

  // Handle playing a specific episode
  const handlePlayEpisode = useCallback((episode: Episode & { podcast: Podcast }, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const album = podcastToAlbum(episode.podcast);
    const episodeIndex = episode.podcast.episodes.findIndex(ep => ep.guid === episode.guid);
    playAlbumAndOpenNowPlaying(album as unknown as Album, episodeIndex >= 0 ? episodeIndex : 0);
    toast.success(`Now playing: ${episode.title}`);
  }, [playAlbumAndOpenNowPlaying]);

  // Handle boost click
  const handleBoostClick = useCallback((podcast: Podcast) => {
    setSelectedPodcast(podcast);
    setShowBoostModal(true);
  }, []);

  // Handle boost success
  const handleBoostSuccess = useCallback((response: any) => {
    setShowBoostModal(false);
    setBoostMessage('');

    // Trigger confetti
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

  const handleBoostError = useCallback((error: string) => {
    toast.error('Failed to send boost');
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-4" />
          <p className="text-lg text-white">Loading podcasts...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Mic className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-lg text-white mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
      <div className="container mx-auto px-4 py-8 pb-32">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Mic className="w-8 h-8 text-purple-500" />
            <h1 className="text-3xl sm:text-4xl font-bold text-white">Podcasts</h1>
          </div>
          <p className="text-gray-400">
            Listen to podcasts with Value4Value support
          </p>
        </div>

        {/* Latest Episodes Section */}
        {latestEpisodes.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl sm:text-2xl font-semibold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-400" />
                Latest Episodes
              </h2>
            </div>

            <div className="space-y-3">
              {latestEpisodes.map((episode, index) => (
                <EpisodeCard
                  key={episode.guid || index}
                  episode={episode}
                  podcast={episode.podcast}
                  isPlaying={isPlaying}
                  isCurrentEpisode={currentTrack?.guid === episode.guid}
                  onPlay={(ep, e) => handlePlayEpisode(episode, e)}
                  showPodcastInfo={true}
                  variant="list"
                />
              ))}
            </div>
          </section>
        )}

        {/* All Podcasts Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl sm:text-2xl font-semibold text-white flex items-center gap-2">
              <Mic className="w-5 h-5 text-purple-400" />
              All Podcasts
            </h2>
            <span className="text-gray-400 text-sm">
              {podcasts.length} {podcasts.length === 1 ? 'podcast' : 'podcasts'}
            </span>
          </div>

          {podcasts.length === 0 ? (
            <div className={`${DARK_CARD_CLASSES} p-8 text-center`}>
              <Mic className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400">No podcasts available yet.</p>
              <p className="text-gray-500 text-sm mt-2">
                Podcast feeds will be loaded here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {podcasts.map((podcast, index) => (
                <PodcastCard
                  key={podcast.feedGuid || podcast.feedUrl || index}
                  podcast={podcast}
                  isPlaying={isPlaying && currentTrack?.feedGuid === podcast.feedGuid}
                  onPlay={handlePlayPodcast}
                  onBoostClick={handleBoostClick}
                />
              ))}
            </div>
          )}
        </section>

        {/* Boost Modal */}
        {showBoostModal && selectedPodcast && isLightningEnabled && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className={`${DARK_CARD_CLASSES} p-6 max-w-md w-full max-h-[90vh] overflow-y-auto`}>
              <div className="flex items-center gap-3 mb-4">
                <Zap className="w-6 h-6 text-yellow-500" />
                <h3 className="text-xl font-semibold text-white">
                  Boost {selectedPodcast.title}
                </h3>
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

              <BitcoinConnectPayment
                amount={boostAmount}
                recipientAddress={selectedPodcast.paymentRecipients?.[0]?.address || ''}
                recipientName={selectedPodcast.author}
                splits={selectedPodcast.paymentRecipients}
                metadata={{
                  podcast: selectedPodcast.title,
                  feedGuid: selectedPodcast.feedGuid,
                  senderName: senderName || 'Anonymous',
                  message: boostMessage
                }}
                onSuccess={handleBoostSuccess}
                onError={handleBoostError}
              />

              <button
                onClick={() => setShowBoostModal(false)}
                className="w-full mt-4 px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
