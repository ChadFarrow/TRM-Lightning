'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useAudio } from '@/contexts/AudioContext';
import { useLightning } from '@/contexts/LightningContext';
import { toast } from '@/components/Toast';
import { fetchPodcast, podcastToAlbum, episodeToTrack } from '@/lib/podcasts-service';
import {
  Mic,
  Play,
  Pause,
  Clock,
  Calendar,
  Globe,
  Zap,
  Loader2,
  ArrowLeft,
  ExternalLink,
  Users,
  FileText,
  MapPin,
  Shield,
  Heart
} from 'lucide-react';
import dynamic from 'next/dynamic';
import confetti from 'canvas-confetti';
import { extractColorsFromImage, createAlbumBackground, ExtractedColors } from '@/lib/color-utils';
import { DARK_CARD_CLASSES, DARK_BADGE_BG, DARK_BADGE_TEXT } from '@/lib/theme-utils';
import type { Podcast, Episode } from '@/lib/types/podcast';
import type { Album } from '@/lib/types/album';

// Dynamic imports
const EpisodeCard = dynamic(() => import('@/components/EpisodeCard'), {
  loading: () => <div className="bg-white/5 backdrop-blur-sm rounded-xl h-24 animate-pulse"></div>,
  ssr: false
});

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

interface PodcastDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function PodcastDetailPage({ params }: PodcastDetailPageProps) {
  const router = useRouter();
  const { id } = use(params);
  const { isLightningEnabled } = useLightning();
  const { playAlbumAndOpenNowPlaying, currentTrack, isPlaying, pause, resume } = useAudio();

  const [podcast, setPodcast] = useState<Podcast | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [extractedColors, setExtractedColors] = useState<ExtractedColors | null>(null);
  const [showAllEpisodes, setShowAllEpisodes] = useState(false);

  // Boost modal state
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [boostAmount, setBoostAmount] = useState(50);
  const [senderName, setSenderName] = useState('');
  const [boostMessage, setBoostMessage] = useState('');

  // Load podcast data
  useEffect(() => {
    async function loadPodcast() {
      try {
        setIsLoading(true);
        setError(null);

        const podcastData = await fetchPodcast(decodeURIComponent(id));

        if (!podcastData) {
          setError('Podcast not found');
          return;
        }

        setPodcast(podcastData);

        // Extract colors from cover art
        if (podcastData.coverArt) {
          try {
            const colors = await extractColorsFromImage(podcastData.coverArt);
            setExtractedColors(colors);
          } catch (err) {
            console.warn('Failed to extract colors:', err);
          }
        }
      } catch (err) {
        console.error('Error loading podcast:', err);
        setError('Failed to load podcast');
      } finally {
        setIsLoading(false);
      }
    }

    loadPodcast();
  }, [id]);

  // Handle playing all episodes
  const handlePlayAll = useCallback(() => {
    if (!podcast || podcast.episodes.length === 0) return;

    const album = podcastToAlbum(podcast);
    playAlbumAndOpenNowPlaying(album.tracks, 0, album.title);
  }, [podcast, playAlbumAndOpenNowPlaying]);

  // Handle playing a specific episode
  const handlePlayEpisode = useCallback((episode: Episode, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!podcast) return;

    const album = podcastToAlbum(podcast);
    const episodeIndex = podcast.episodes.findIndex(ep => ep.guid === episode.guid);
    playAlbumAndOpenNowPlaying(album.tracks, episodeIndex >= 0 ? episodeIndex : 0, album.title);
  }, [podcast, playAlbumAndOpenNowPlaying]);

  // Handle boost success
  const handleBoostSuccess = useCallback((response: any) => {
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

  const handleBoostError = useCallback((error: string) => {
    toast.error('Failed to send boost');
  }, []);

  // Determine if currently playing this podcast
  const isCurrentPodcast = podcast && currentTrack?.feedGuid === podcast.feedGuid;

  // Get background style
  const backgroundStyle = extractedColors
    ? { background: createAlbumBackground(extractedColors) }
    : {};

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-4" />
          <p className="text-lg text-white">Loading podcast...</p>
        </div>
      </div>
    );
  }

  if (error || !podcast) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Mic className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-lg text-white mb-4">{error || 'Podcast not found'}</p>
          <Link
            href="/podcasts"
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Podcasts
          </Link>
        </div>
      </div>
    );
  }

  // Episodes to display
  const displayedEpisodes = showAllEpisodes ? podcast.episodes : podcast.episodes.slice(0, 10);

  return (
    <div className="min-h-screen" style={backgroundStyle}>
      <div className="min-h-screen bg-gradient-to-b from-black/60 via-gray-900/90 to-gray-900">
        <div className="container mx-auto px-4 py-8 pb-32">
          {/* Back button */}
          <Link
            href="/podcasts"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Podcasts
          </Link>

          {/* Podcast Header */}
          <div className="flex flex-col md:flex-row gap-6 mb-8">
            {/* Cover Art */}
            <div className="relative w-48 h-48 md:w-64 md:h-64 flex-shrink-0 mx-auto md:mx-0">
              <div className="relative w-full h-full rounded-xl overflow-hidden shadow-2xl">
                {podcast.coverArt ? (
                  <Image
                    src={podcast.coverArt}
                    alt={podcast.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 192px, 256px"
                    priority
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-600 to-purple-900 flex items-center justify-center">
                    <Mic className="w-16 h-16 text-white/50" />
                  </div>
                )}
              </div>

              {/* Podcast badge */}
              <div className="absolute -bottom-2 -right-2 bg-purple-600 rounded-full px-3 py-1 text-sm text-white flex items-center gap-1 shadow-lg">
                <Mic className="w-3 h-3" />
                Podcast
              </div>
            </div>

            {/* Podcast Info */}
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2">
                {podcast.title}
              </h1>
              <p className="text-lg text-gray-300 mb-3">{podcast.author}</p>

              {/* Categories */}
              {podcast.categories && podcast.categories.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center md:justify-start mb-4">
                  {podcast.categories.map((category, index) => (
                    <span
                      key={index}
                      className={`${DARK_BADGE_BG} ${DARK_BADGE_TEXT} px-2 py-1 rounded-full text-xs`}
                    >
                      {category}
                    </span>
                  ))}
                </div>
              )}

              {/* Episode count and language */}
              <div className="flex items-center gap-4 justify-center md:justify-start text-gray-400 text-sm mb-4">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {podcast.episodes.length} episodes
                </span>
                {podcast.language && (
                  <span className="flex items-center gap-1">
                    <Globe className="w-4 h-4" />
                    {podcast.language.toUpperCase()}
                  </span>
                )}
                {podcast.explicit && (
                  <span className="text-red-400 flex items-center gap-1">
                    <Shield className="w-4 h-4" />
                    Explicit
                  </span>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                <button
                  onClick={handlePlayAll}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-full font-semibold flex items-center gap-2 transition-colors"
                >
                  {isCurrentPodcast && isPlaying ? (
                    <>
                      <Pause className="w-5 h-5" />
                      Now Playing
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 ml-0.5" />
                      Play All
                    </>
                  )}
                </button>

                {isLightningEnabled && podcast.paymentRecipients && podcast.paymentRecipients.length > 0 && (
                  <button
                    onClick={() => setShowBoostModal(true)}
                    className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-black rounded-full font-semibold flex items-center gap-2 transition-colors"
                  >
                    <Zap className="w-5 h-5" />
                    Boost
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          {podcast.description && (
            <div className={`${DARK_CARD_CLASSES} p-4 sm:p-6 mb-8`}>
              <h2 className="text-lg font-semibold text-white mb-3">About</h2>
              <p className="text-gray-300 whitespace-pre-line">{podcast.description}</p>
            </div>
          )}

          {/* Persons/Hosts */}
          {podcast.persons && podcast.persons.length > 0 && (
            <div className={`${DARK_CARD_CLASSES} p-4 sm:p-6 mb-8`}>
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-400" />
                Hosts & Contributors
              </h2>
              <PersonDisplay persons={podcast.persons} />
            </div>
          )}

          {/* Funding */}
          {podcast.funding && podcast.funding.length > 0 && (
            <div className={`${DARK_CARD_CLASSES} p-4 sm:p-6 mb-8`}>
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <Heart className="w-5 h-5 text-red-400" />
                Support the Show
              </h2>
              <div className="space-y-2">
                {podcast.funding.map((fund, index) => (
                  <a
                    key={index}
                    href={fund.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {fund.message || fund.url}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Location */}
          {podcast.location && (
            <div className={`${DARK_CARD_CLASSES} p-4 sm:p-6 mb-8`}>
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-green-400" />
                Location
              </h2>
              <p className="text-gray-300">{podcast.location.name}</p>
            </div>
          )}

          {/* Payment Splits */}
          {isLightningEnabled && podcast.paymentRecipients && podcast.paymentRecipients.length > 0 && (
            <div className={`${DARK_CARD_CLASSES} p-4 sm:p-6 mb-8`}>
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                Value Splits
              </h2>
              <PaymentSplitsDisplay recipients={podcast.paymentRecipients} totalAmount={0} />
            </div>
          )}

          {/* Episodes List */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-400" />
                Episodes
              </h2>
              <span className="text-gray-400 text-sm">
                {podcast.episodes.length} episodes
              </span>
            </div>

            <div className="space-y-3">
              {displayedEpisodes.map((episode, index) => (
                <EpisodeCard
                  key={episode.guid || index}
                  episode={episode}
                  podcast={podcast}
                  isPlaying={isPlaying}
                  isCurrentEpisode={currentTrack?.guid === episode.guid}
                  onPlay={handlePlayEpisode}
                  variant="list"
                />
              ))}
            </div>

            {/* Show more/less button */}
            {podcast.episodes.length > 10 && (
              <div className="mt-6 text-center">
                <button
                  onClick={() => setShowAllEpisodes(!showAllEpisodes)}
                  className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  {showAllEpisodes
                    ? 'Show Less'
                    : `Show All ${podcast.episodes.length} Episodes`}
                </button>
              </div>
            )}
          </div>

          {/* Copyright */}
          {podcast.copyright && (
            <p className="text-gray-500 text-sm text-center">
              {podcast.copyright}
            </p>
          )}
        </div>

        {/* Boost Modal */}
        {showBoostModal && isLightningEnabled && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className={`${DARK_CARD_CLASSES} p-6 max-w-md w-full max-h-[90vh] overflow-y-auto`}>
              <div className="flex items-center gap-3 mb-4">
                <Zap className="w-6 h-6 text-yellow-500" />
                <h3 className="text-xl font-semibold text-white">
                  Boost {podcast.title}
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
                recipient={podcast.paymentRecipients?.[0]?.address || ''}
                recipients={podcast.paymentRecipients?.map(r => ({
                  address: r.address,
                  split: r.split,
                  name: r.name,
                  fee: r.fee,
                  type: r.type
                }))}
                enableBoosts={true}
                boostMetadata={{
                  title: podcast.title,
                  podcastFeedGuid: podcast.feedGuid,
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
