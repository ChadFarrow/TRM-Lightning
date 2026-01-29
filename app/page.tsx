'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import VideoCover from '@/components/VideoCover';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useAudio } from '@/contexts/AudioContext';
import { useLightning } from '@/contexts/LightningContext';
import { toast } from '@/components/Toast';
import { preloadCriticalColors } from '@/lib/performance-utils';
import dynamic from 'next/dynamic';
import { Zap } from 'lucide-react';
import confetti from 'canvas-confetti';
import { generateAlbumSlug } from '@/lib/url-utils';
import { getSiteName } from '@/lib/site-config';
import { SiteLogo } from '@/lib/image-helpers';
import { Album, Track } from '@/lib/types/album';
import { extractPaymentRecipients } from '@/lib/payment-recipient-utils';
import PaymentSplitsDisplay from '@/components/PaymentSplitsDisplay';
import { createBoostMetadata } from '@/lib/boost-metadata-utils';
import { fetchAlbumsWithFallback } from '@/lib/album-fetch-utils';
import {
  isFullShow,
  isBandSet,
  extractBandSets,
  extractVideoTracks,
  extractAudioTracks,
  extractFullShowTracks,
  type BandSet,
  type TrackWithContext,
} from '@/lib/band-parser';
import { DARK_HEADER_BG, DARK_HEADER_BORDER, DARK_OVERLAY_BG, DARK_BUTTON_CLASSES, DARK_CARD_CLASSES, DARK_BADGE_BG, DARK_BADGE_TEXT } from '@/lib/theme-utils';
import BackgroundImage from '@/components/BackgroundImage';
import Sidebar from '@/components/Sidebar';

// Lazy load Lightning components - not needed on initial page load
const BitcoinConnectWallet = dynamic(
  () => import('@/components/BitcoinConnect').then(mod => ({ default: mod.BitcoinConnectWallet })),
  { 
    loading: () => <div className="w-32 h-10 bg-gray-800/50 rounded-lg animate-pulse" />,
    ssr: false 
  }
);

const BitcoinConnectPayment = dynamic(
  () => import('@/components/BitcoinConnect').then(mod => ({ default: mod.BitcoinConnectPayment })),
  { 
    loading: () => <div className="w-full h-10 bg-gray-800/50 rounded-lg animate-pulse" />,
    ssr: false 
  }
);

// Direct import of AlbumCard to fix lazy loading issue
import AlbumCard from '@/components/AlbumCard';
import LightningToggle from '@/components/LightningToggle';

const PublisherCard = dynamic(() => import('@/components/PublisherCard'), {
  loading: () => <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 h-20 animate-pulse"></div>,
  ssr: false
});

const TrackCard = dynamic(() => import('@/components/TrackCard'), {
  loading: () => <div className="bg-white/5 backdrop-blur-sm rounded-xl aspect-square animate-pulse"></div>,
  ssr: false
});

const BandSetCard = dynamic(() => import('@/components/BandSetCard'), {
  loading: () => <div className="bg-white/5 backdrop-blur-sm rounded-xl aspect-square animate-pulse"></div>,
  ssr: false
});

const ControlsBar = dynamic(() => import('@/components/ControlsBar'), {
  loading: () => <div className="mb-8 p-4 bg-gray-800/20 rounded-lg animate-pulse h-16"></div>,
  ssr: false
});

const PodcastCard = dynamic(() => import('@/components/PodcastCard'), {
  loading: () => <div className="bg-white/5 backdrop-blur-sm rounded-xl aspect-square animate-pulse"></div>,
  ssr: false
});

const EpisodeCard = dynamic(() => import('@/components/EpisodeCard'), {
  loading: () => <div className="bg-white/5 backdrop-blur-sm rounded-xl h-24 animate-pulse"></div>,
  ssr: false
});

// Import types from the ControlsBar component
import type { FilterType, ViewType } from '@/components/ControlsBar';
import type { Podcast, Episode } from '@/lib/types/podcast';
import { fetchPodcasts, podcastToAlbum } from '@/lib/podcasts-service';

export default function HomePage() {
  const { isLightningEnabled } = useLightning();
  const [isLoading, setIsLoading] = useState(true);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [publishers, setPublishers] = useState<any[]>([]);
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [podcastsLoading, setPodcastsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [totalFeedsCount, setTotalFeedsCount] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  
  // Ensure sidebar is closed on mount and page load - use ref to prevent re-renders
  const sidebarInitialized = useRef(false);
  useEffect(() => {
    if (!sidebarInitialized.current) {
      sidebarInitialized.current = true;
      setIsSidebarOpen(false);
    }
  }, []);
  
  // Force close sidebar on window load/focus
  useEffect(() => {
    const handleLoad = () => setIsSidebarOpen(false);
    const handleFocus = () => setIsSidebarOpen(false);
    
    window.addEventListener('load', handleLoad);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('load', handleLoad);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);
  
  // Close sidebar on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSidebarOpen) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isSidebarOpen]);
  
  // Boost modal state
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [boostAmount, setBoostAmount] = useState(50);
  const [senderName, setSenderName] = useState('');
  const [boostMessage, setBoostMessage] = useState('');
  
  // Global audio context
  const { playAlbumAndOpenNowPlaying: globalPlayAlbum, toggleShuffle } = useAudio();
  const hasLoadedRef = useRef(false);
  
  // Handle boost button click from album card
  const handleBoostClick = (album: Album) => {
    setSelectedAlbum(album);
    setShowBoostModal(true);
  };
  
  // Handle boost success
  const handleBoostSuccess = (response: any) => {
    setShowBoostModal(false);
    setBoostMessage(''); // Clear the message input after successful boost
    
    // Trigger confetti animation
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
    
    toast.success('⚡ Boost sent successfully!');
  };
  
  const handleBoostError = (error: string) => {
    toast.error('Failed to send boost');
  };
  
  // Static background state
  const [backgroundImageLoaded, setBackgroundImageLoaded] = useState(false);

  // Controls state
  const [activeFilter, setActiveFilter] = useState<FilterType>('full_shows');
  const [viewType, setViewType] = useState<ViewType>('grid');

  // Fisher-Yates shuffle algorithm
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Global shuffle functionality - plays all tracks from all albums in random order
  const handleShuffle = () => {
    try {
      // Collect all tracks from all albums
      const allTracks: Track[] = [];
      
      albums.forEach(album => {
        album.tracks.forEach(track => {
          // Only include tracks with valid URLs
          if (track.url && track.url.trim() !== '') {
            // Map track to include artist, album, and image metadata
            allTracks.push({
              ...track,
              artist: album.artist,
              album: album.title,
              image: track.image || track.imageUrl || album.coverArt
            });
          }
        });
      });

      if (allTracks.length === 0) {
        toast.error('No playable tracks found');
        return;
      }

      // Shuffle the tracks
      const shuffledTracks = shuffleArray(allTracks);

      // Play the shuffled playlist and open full screen player
      globalPlayAlbum(shuffledTracks, 0, 'Shuffle All');

      toast.success(`🎲 Shuffling ${shuffledTracks.length} tracks!`);
    } catch (error) {
      console.error('Error shuffling tracks:', error);
      toast.error('Error starting shuffle');
    }
  };

  useEffect(() => {
    setIsClient(true);
    
    // Load saved boost preferences
    const savedSenderName = localStorage.getItem('boost-sender-name');
    const savedBoostAmount = localStorage.getItem('boost-amount');
    
    if (savedSenderName) {
      setSenderName(savedSenderName);
    }
    
    if (savedBoostAmount) {
      const amount = parseInt(savedBoostAmount, 10);
      if (!isNaN(amount) && amount > 0) {
        setBoostAmount(amount);
      }
    }
    
    // Add scroll detection for mobile
    let scrollTimer: NodeJS.Timeout;
    const handleScroll = () => {
      document.body.classList.add('is-scrolling');
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        document.body.classList.remove('is-scrolling');
      }, 150);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('touchmove', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('touchmove', handleScroll);
      clearTimeout(scrollTimer);
    };
  }, []);

  // Load all albums and publishers - defined before useEffect that uses it
  const loadCriticalAlbums = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setLoadingProgress(0);
      
      // Load all albums directly
      const allAlbums = await loadAlbumsData();
      setAlbums(allAlbums);
      
      // Preload colors for first albums for instant Now Playing screen
      const firstAlbumTitles = allAlbums.slice(0, 10).map((album: any) => album.title);
      preloadCriticalColors(firstAlbumTitles).catch(() => {});
      
      // Load publisher data from API
      try {
        const publisherResponse = await fetch('/api/publishers');
        if (publisherResponse.ok) {
          const publisherData = await publisherResponse.json();
          const publishersList = publisherData.publishers || [];
          setPublishers(publishersList);
        } else {
          // Set empty array so UI doesn't break
          setPublishers([]);
        }
      } catch (error) {
        // Set empty array so UI doesn't break
        setPublishers([]);
      }
      
      setLoadingProgress(100);
      setIsLoading(false);
      
    } catch (error) {
      setError('Failed to load albums');
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Prevent multiple loads
    if (hasLoadedRef.current) {
      return;
    }
    
    hasLoadedRef.current = true;
    
    // Check for cached data first to speed up initial load
    const cachedAlbums = localStorage.getItem('cachedAlbums');
    const cacheTime = localStorage.getItem('albumsCacheTimestamp');
    
    if (cachedAlbums && cacheTime) {
      const cacheAge = Date.now() - parseInt(cacheTime);
      // Use cache if less than 10 minutes old
      if (cacheAge < 10 * 60 * 1000) {
        const albums = JSON.parse(cachedAlbums);
        setAlbums(albums);
        setIsLoading(false);
        
        // Still fetch fresh data in background
        setTimeout(() => loadCriticalAlbums(), 1000);
        return;
      }
    }
    
    // Progressive loading: Load critical data first, then enhance
    loadCriticalAlbums();
  }, [loadCriticalAlbums]); // Run only once on mount

  // Static background loading
  useEffect(() => {
    // Set a small delay to ensure the background image has time to load
    const timer = setTimeout(() => {
      setBackgroundImageLoaded(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  const loadAlbumsData = async () => {
    try {
      setLoadingProgress(75);
      const albums = await fetchAlbumsWithFallback({ useCache: true });
      return albums;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Error loading album data: ${errorMessage}`);
      toast.error(`Failed to load albums: ${errorMessage}`);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const playAlbum = async (album: Album, e: React.MouseEvent | React.TouchEvent) => {
    // Only prevent default/propagation for the play button, not the entire card
    e.stopPropagation();
    
    // Find the first playable track
    const firstTrack = album.tracks.find(track => track.url);
    
    if (!firstTrack || !firstTrack.url) {
      setError('No playable tracks found in this album');
      setTimeout(() => setError(null), 3000);
      return;
    }

    try {
      
      // Use global audio context to play album
      const audioTracks = album.tracks.map(track => ({
        ...track,
        artist: album.artist,
        album: album.title,
        image: track.image || album.coverArt
      }));
      
      globalPlayAlbum(audioTracks, 0, album.title);
    } catch (error) {
      let errorMessage = 'Unable to play audio - please try again';
      
      if (error instanceof DOMException) {
        switch (error.name) {
          case 'NotAllowedError':
            errorMessage = 'Tap the play button again to start playback';
            break;
          case 'NotSupportedError':
            errorMessage = 'Audio format not supported on this device';
            break;
        }
      }
      
      setError(errorMessage);
      toast.error(errorMessage);
      
      setTimeout(() => setError(null), 5000);
    }
  };

  // Helper functions for filtering and sorting
  const getFilteredAlbums = () => {
    // Filter out LNURL Testing Podcast from main page display (accessible via sidebar)
    const albumsToUse = albums.filter(album => album.title !== 'LNURL Testing Podcast');
    
          // Universal sorting function that implements hierarchical order: Pinned → Full Shows → Band Sets
      const sortWithHierarchy = (albums: Album[]) => {
        return albums.sort((a, b) => {
          // Pin specific albums to the top in order
          // Users can configure pinned albums via environment variable or config
          const pinnedOrder: string[] = process.env.NEXT_PUBLIC_PINNED_ALBUMS?.split(',') || [];
          const aIndex = pinnedOrder.indexOf(a.title);
          const bIndex = pinnedOrder.indexOf(b.title);

          // If both are pinned, sort by pinnedOrder
          if (aIndex !== -1 && bIndex !== -1) {
            return aIndex - bIndex;
          }
          // If only one is pinned, it goes first
          if (aIndex !== -1) return -1;
          if (bIndex !== -1) return 1;

          // Hierarchical sorting: Full Shows → Videos → Audio/Band Sets
          const aHasFullShow = a.tracks.some(track => isFullShow(track));
          const bHasFullShow = b.tracks.some(track => isFullShow(track));
          const aHasVideo = a.tracks.some(track => track.mediaType === 'video');
          const bHasVideo = b.tracks.some(track => track.mediaType === 'video');

          // Full shows come first
          if (aHasFullShow && !bHasFullShow) return -1;
          if (!aHasFullShow && bHasFullShow) return 1;

          // Videos come second
          if (aHasVideo && !bHasVideo) return -1;
          if (!aHasVideo && bHasVideo) return 1;

          // If same type, sort by title
          return a.title.localeCompare(b.title);
        });
      };
    
    // Apply filtering based on active filter
    let filtered = albumsToUse;
    
    switch (activeFilter) {
      case 'full_shows':
        // Albums containing full show tracks (long videos without band name pattern)
        filtered = albumsToUse.filter(album =>
          album.tracks.some(track => isFullShow(track))
        );
        break;
      case 'band_sets':
        // Albums containing individual band set tracks
        filtered = albumsToUse.filter(album =>
          album.tracks.some(track => isBandSet(track))
        );
        break;
      case 'videos':
        // Albums with video tracks
        filtered = albumsToUse.filter(album =>
          album.tracks.some(track => track.mediaType === 'video')
        );
        break;
      case 'audio':
        // Albums with audio tracks
        filtered = albumsToUse.filter(album =>
          album.tracks.some(track => track.mediaType === 'audio' || !track.mediaType)
        );
        break;
      default: // 'full_shows' and others - show all albums
        filtered = albumsToUse;
    }

    // Apply hierarchical sorting to filtered results
    return sortWithHierarchy(filtered);
  };

  const filteredAlbums = getFilteredAlbums();

  // Computed values for different filter types
  const bandSets = useMemo(() => extractBandSets(albums), [albums]);
  const videoTracks = useMemo(() => {
    const tracks = extractVideoTracks(albums);
    // Sort so [Raw Set] tracks appear at the end (case-insensitive)
    return tracks.sort((a, b) => {
      const aIsRaw = a.title.toLowerCase().includes('[raw set]');
      const bIsRaw = b.title.toLowerCase().includes('[raw set]');
      if (aIsRaw && !bIsRaw) return 1;
      if (!aIsRaw && bIsRaw) return -1;
      return 0;
    });
  }, [albums]);
  const audioTracks = useMemo(() => extractAudioTracks(albums), [albums]);
  const fullShowTracks = useMemo(() => extractFullShowTracks(albums), [albums]);

  // Load podcasts when filter changes to 'podcasts'
  useEffect(() => {
    if (activeFilter === 'podcasts' && podcasts.length === 0 && !podcastsLoading) {
      setPodcastsLoading(true);
      fetchPodcasts()
        .then((fetchedPodcasts) => {
          setPodcasts(fetchedPodcasts);
        })
        .catch((err) => {
          console.error('Error loading podcasts:', err);
          toast.error('Failed to load podcasts');
        })
        .finally(() => {
          setPodcastsLoading(false);
        });
    }
  }, [activeFilter, podcasts.length, podcastsLoading]);

  // Handle playing a podcast
  const handlePlayPodcast = useCallback((podcast: Podcast, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (podcast.episodes.length === 0) {
      toast.error('This podcast has no episodes');
      return;
    }

    const album = podcastToAlbum(podcast);
    globalPlayAlbum(album.tracks as Track[], 0, podcast.title);
  }, [globalPlayAlbum]);

  // Handle boost for podcast
  const handlePodcastBoostClick = useCallback((podcast: Podcast) => {
    const album = podcastToAlbum(podcast);
    setSelectedAlbum(album as Album);
    setShowBoostModal(true);
  }, []);

  // Get the count for the current filter
  const getFilteredCount = () => {
    switch (activeFilter) {
      case 'full_shows':
        return filteredAlbums.length;
      case 'band_sets':
        return bandSets.length;
      case 'videos':
        return videoTracks.length;
      case 'audio':
        return audioTracks.length;
      case 'podcasts':
        return podcasts.length;
      default:
        return filteredAlbums.length;
    }
  };


  return (
    <div className="min-h-screen text-white relative overflow-hidden">
      {/* Site Background */}
      <div className="fixed inset-0 z-0">
        <BackgroundImage />
        <div className="absolute inset-0 bg-black/60"></div>
      </div>

      {/* Content overlay */}
      <div className="relative z-10">
        {/* Header */}
        <header className={`${DARK_HEADER_BG} ${DARK_HEADER_BORDER} pt-6 shadow-lg`}>
          <div className="container mx-auto px-6 py-2">
            {/* Mobile Header */}
            <div className="block sm:hidden mb-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 transition-colors"
                    aria-label="Toggle menu"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                  <SiteLogo 
                    alt={`${getSiteName()} Logo`}
                    width={100}
                    height={32}
                    className="h-8 w-auto"
                  />
                </div>
                <div className="flex items-center gap-3">
                  {isLightningEnabled && <BitcoinConnectWallet />}
                </div>
              </div>
              <div className="text-center">
                <h1 className="text-xl font-bold mb-1">{getSiteName()}</h1>


              </div>
            </div>

            {/* Desktop Header */}
            <div className="hidden sm:block mb-4">
              <div className="relative flex items-center justify-center">
                <div className="absolute left-0 flex items-center gap-4">
                  <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 transition-colors"
                    aria-label="Toggle menu"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                  <SiteLogo 
                    alt={`${getSiteName()} Logo`}
                    width={120}
                    height={40}
                    className="h-10 w-auto"
                  />
                </div>
                <div className="text-center">
                  <h1 className="text-3xl font-bold mb-1">{getSiteName()}</h1>


                </div>
                <div className="absolute right-0 flex items-center gap-4">
                  {isLightningEnabled && <BitcoinConnectWallet />}
                </div>
              </div>
            </div>
            
            {/* Loading/Error Status */}
            {isClient && (
              <div className="flex items-center gap-2 text-sm">
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
                    <span className="text-yellow-400">
                      Loading albums...
                      {loadingProgress > 0 && ` (${Math.round(loadingProgress)}%)`}
                    </span>
                  </div>
                ) : error ? (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                    <span className="text-red-400">{error}</span>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </header>
        
        {/* Sidebar */}
        <Sidebar 
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          isLightningEnabled={isLightningEnabled}
        />
        
        {/* Main Content */}
        <div className="container mx-auto px-3 sm:px-6 py-6 sm:py-8 pb-28 relative z-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <LoadingSpinner 
                size="large"
                text="Loading music feeds..."
                showProgress={false}
              />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <h2 className="text-2xl font-semibold mb-4 text-red-400">Error Loading Albums</h2>
              <p className="text-gray-400">{error}</p>
              <button 
                onClick={() => loadCriticalAlbums()}
                className={`mt-4 px-4 py-2 ${DARK_BUTTON_CLASSES}`}
              >
                Retry
              </button>
            </div>
          ) : getFilteredCount() > 0 ? (
            <div className="max-w-7xl mx-auto">
              {/* Controls Bar */}
              <ControlsBar
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
                viewType={viewType}
                onViewChange={setViewType}
                showShuffle={activeFilter === 'full_shows'}
                onShuffle={handleShuffle}
                resultCount={getFilteredCount()}
                resultLabel={
                  activeFilter === 'full_shows' ? 'Shows' :
                  activeFilter === 'band_sets' ? 'Sets' :
                  activeFilter === 'videos' ? 'Videos' :
                  activeFilter === 'audio' ? 'Tracks' :
                  activeFilter === 'podcasts' ? 'Podcasts' : 'Items'}
                className="mb-8"
              />


              {/* Content Display based on active filter */}
              {activeFilter === 'full_shows' ? (
                // Full Shows - Display album cards
                viewType === 'list' ? (
                  <div className="space-y-2">
                    {filteredAlbums.map((album, index) => (
                      <div
                        key={`album-list-${index}`}
                        className={`${DARK_CARD_CLASSES} p-3 sm:p-4 flex items-center gap-3 sm:gap-4 cursor-pointer hover:bg-white/10 transition-colors`}
                        onClick={() => {
                          const audioTracks = album.tracks.map(track => ({
                            ...track,
                            artist: album.artist,
                            album: album.title,
                            image: track.image || album.coverArt
                          }));
                          globalPlayAlbum(audioTracks, 0, album.title);
                        }}
                      >
                        <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 rounded overflow-hidden">
                          <VideoCover
                            src={album.coverArt}
                            alt={album.title}
                            fill
                            className="object-cover"
                            sizes="80px"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-white text-sm sm:text-base truncate">{album.title}</h3>
                          <p className="text-gray-400 text-xs sm:text-sm truncate">{album.artist}</p>
                        </div>
                        <div className="text-gray-400 text-sm">{album.tracks.length} tracks</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
                    {filteredAlbums.map((album, index) => (
                      <AlbumCard
                        key={`album-${index}`}
                        album={album}
                        onPlay={playAlbum}
                        onBoostClick={handleBoostClick}
                      />
                    ))}
                  </div>
                )
              ) : activeFilter === 'band_sets' ? (
                // Band Sets - Display band set cards (band + show combination)
                viewType === 'list' ? (
                  <div className="space-y-2">
                    {bandSets.map((bandSet, index) => (
                      <div
                        key={`bandset-list-${index}`}
                        className={`${DARK_CARD_CLASSES} p-3 sm:p-4 flex items-center gap-3 sm:gap-4 cursor-pointer hover:bg-white/10 transition-colors`}
                        onClick={() => {
                          if (bandSet.tracks.length > 0) {
                            const tracks = bandSet.tracks.map(t => ({
                              ...t,
                              artist: bandSet.bandName,
                              album: bandSet.showName,
                              image: t.image || bandSet.coverArt
                            }));
                            globalPlayAlbum(tracks, 0, `${bandSet.bandName} - ${bandSet.showName}`);
                          }
                        }}
                      >
                        <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 rounded overflow-hidden">
                          <VideoCover
                            src={bandSet.coverArt}
                            alt={`${bandSet.bandName} - ${bandSet.showName}`}
                            fill
                            className="object-cover"
                            sizes="80px"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-white text-sm sm:text-base truncate">{bandSet.bandName}</h3>
                          <p className="text-gray-400 text-xs sm:text-sm truncate">{bandSet.showName}</p>
                        </div>
                        <div className="text-gray-400 text-sm">{bandSet.trackCount} tracks</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
                    {bandSets.map((bandSet, index) => (
                      <BandSetCard
                        key={`bandset-${index}`}
                        bandSet={bandSet}
                        onPlay={(bandSet) => {
                          // Play all tracks from this band set
                          if (bandSet.tracks.length > 0) {
                            const tracks = bandSet.tracks.map(t => ({
                              ...t,
                              artist: bandSet.bandName,
                              album: bandSet.showName,
                              image: t.image || bandSet.coverArt
                            }));
                            globalPlayAlbum(tracks, 0, `${bandSet.bandName} - ${bandSet.showName}`);
                          }
                        }}
                      />
                    ))}
                  </div>
                )
              ) : activeFilter === 'videos' ? (
                // Videos - Display track cards for video tracks
                viewType === 'list' ? (
                  <div className="space-y-2">
                    {videoTracks.map((track, index) => {
                      const isRawSet = track.title.toLowerCase().includes('[raw set]');
                      return (
                        <div
                          key={`video-list-${index}`}
                          className={`${DARK_CARD_CLASSES} p-3 sm:p-4 flex items-center gap-3 sm:gap-4 cursor-pointer hover:bg-white/10 transition-colors`}
                          onClick={() => {
                            const albumForTrack = albums.find(a => a.title === track.albumTitle);
                            if (albumForTrack) {
                              const trackIndex = albumForTrack.tracks.findIndex(t => t.title === track.title);
                              const tracks = albumForTrack.tracks.map(t => ({
                                ...t,
                                artist: albumForTrack.artist,
                                album: albumForTrack.title,
                                image: t.image || albumForTrack.coverArt
                              }));
                              globalPlayAlbum(tracks, trackIndex >= 0 ? trackIndex : 0, albumForTrack.title);
                            }
                          }}
                        >
                          <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 rounded overflow-hidden">
                            <Image
                              src={track.image || track.albumCoverArt}
                              alt={track.title}
                              fill
                              className="object-cover"
                              sizes="80px"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-white text-sm sm:text-base truncate">{track.title}</h3>
                            <p className="text-gray-400 text-xs sm:text-sm truncate">{track.albumTitle}</p>
                          </div>
                          <div className="text-gray-400 text-sm font-mono">{track.duration}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
                    {videoTracks.map((track, index) => (
                      <TrackCard
                        key={`video-${index}`}
                        track={track}
                        onPlay={(track) => {
                          const albumForTrack = albums.find(a => a.title === track.albumTitle);
                          if (albumForTrack) {
                            const trackIndex = albumForTrack.tracks.findIndex(t => t.title === track.title);
                            const tracks = albumForTrack.tracks.map(t => ({
                              ...t,
                              artist: albumForTrack.artist,
                              album: albumForTrack.title,
                              image: t.image || albumForTrack.coverArt
                            }));
                            globalPlayAlbum(tracks, trackIndex >= 0 ? trackIndex : 0, albumForTrack.title);
                          }
                        }}
                      />
                    ))}
                  </div>
                )
              ) : activeFilter === 'audio' ? (
                // Audio - Display track cards for audio tracks
                viewType === 'list' ? (
                  <div className="space-y-2">
                    {audioTracks.map((track, index) => (
                      <div
                        key={`audio-list-${index}`}
                        className={`${DARK_CARD_CLASSES} p-3 sm:p-4 flex items-center gap-3 sm:gap-4 cursor-pointer hover:bg-white/10 transition-colors`}
                        onClick={() => {
                          const albumForTrack = albums.find(a => a.title === track.albumTitle);
                          if (albumForTrack) {
                            const trackIndex = albumForTrack.tracks.findIndex(t => t.title === track.title);
                            const tracks = albumForTrack.tracks.map(t => ({
                              ...t,
                              artist: albumForTrack.artist,
                              album: albumForTrack.title,
                              image: t.image || albumForTrack.coverArt
                            }));
                            globalPlayAlbum(tracks, trackIndex >= 0 ? trackIndex : 0, albumForTrack.title);
                          }
                        }}
                      >
                        <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 rounded overflow-hidden">
                          <Image
                            src={track.image || track.albumCoverArt}
                            alt={track.title}
                            fill
                            className="object-cover"
                            sizes="80px"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-white text-sm sm:text-base truncate">{track.title}</h3>
                          <p className="text-gray-400 text-xs sm:text-sm truncate">{track.albumTitle}</p>
                        </div>
                        <div className="text-gray-400 text-sm font-mono">{track.duration}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
                    {audioTracks.map((track, index) => (
                      <TrackCard
                        key={`audio-${index}`}
                        track={track}
                        onPlay={(track) => {
                          const albumForTrack = albums.find(a => a.title === track.albumTitle);
                          if (albumForTrack) {
                            const trackIndex = albumForTrack.tracks.findIndex(t => t.title === track.title);
                            const tracks = albumForTrack.tracks.map(t => ({
                              ...t,
                              artist: albumForTrack.artist,
                              album: albumForTrack.title,
                              image: t.image || albumForTrack.coverArt
                            }));
                            globalPlayAlbum(tracks, trackIndex >= 0 ? trackIndex : 0, albumForTrack.title);
                          }
                        }}
                      />
                    ))}
                  </div>
                )
              ) : activeFilter === 'podcasts' ? (
                // Podcasts - Display podcast cards
                podcastsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <LoadingSpinner />
                    <span className="ml-3 text-gray-400">Loading podcasts...</span>
                  </div>
                ) : podcasts.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-400">No podcasts found. Add podcast feeds to get started.</p>
                  </div>
                ) : viewType === 'list' ? (
                  <div className="space-y-2">
                    {podcasts.map((podcast, index) => (
                      <div
                        key={`podcast-list-${index}`}
                        className={`${DARK_CARD_CLASSES} p-3 sm:p-4 flex items-center gap-3 sm:gap-4 cursor-pointer hover:bg-white/10 transition-colors`}
                        onClick={() => {
                          if (podcast.episodes.length > 0) {
                            const album = podcastToAlbum(podcast);
                            globalPlayAlbum(album.tracks as Track[], 0, podcast.title);
                          }
                        }}
                      >
                        <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 rounded overflow-hidden">
                          <VideoCover
                            src={podcast.coverArt}
                            alt={podcast.title}
                            fill
                            className="object-cover"
                            sizes="80px"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-white text-sm sm:text-base truncate">{podcast.title}</h3>
                          <p className="text-gray-400 text-xs sm:text-sm truncate">{podcast.author}</p>
                        </div>
                        <div className="text-gray-400 text-sm">{podcast.episodes.length} episodes</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
                    {podcasts.map((podcast, index) => (
                      <PodcastCard
                        key={`podcast-${index}`}
                        podcast={podcast}
                        onPlay={handlePlayPodcast}
                        onBoostClick={handlePodcastBoostClick}
                      />
                    ))}
                  </div>
                )
              ) : null}
            </div>
          ) : (
            <div className="text-center py-12">
              <h2 className="text-2xl font-semibold mb-4">No Albums Found</h2>
              <p className="text-gray-400">
                Unable to load album information from the RSS feeds.
              </p>
              <button 
                onClick={() => loadCriticalAlbums()}
                className={`mt-4 px-4 py-2 ${DARK_BUTTON_CLASSES}`}
              >
                Retry Loading Albums
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Boost Modal - Rendered outside of album cards - only show when Lightning is enabled */}
      {isLightningEnabled && showBoostModal && selectedAlbum && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200 isolate">
          <div className="relative bg-gray-900/95 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[calc(100vh-2rem)] overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">
            {/* Header with Album Art */}
            <div className="relative shrink-0 h-32 sm:h-40">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80 z-10" />
              <VideoCover
                src={selectedAlbum.coverArt}
                alt={selectedAlbum.title}
                fill
                className="object-cover"
              />
              <button
                onClick={() => {
                  setShowBoostModal(false);
                  setSelectedAlbum(null);
                }}
                className="absolute top-4 right-4 z-20 p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors backdrop-blur-sm"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="absolute bottom-2 left-4 right-4 z-20">
                <h3 className="text-lg sm:text-xl font-bold text-white mb-0.5 line-clamp-2">{selectedAlbum.title}</h3>
                <p className="text-xs sm:text-sm text-gray-200">{selectedAlbum.artist}</p>
              </div>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto flex-1 bg-gray-900 relative z-10">
              {/* Payment Splits Display */}
              {boostAmount > 0 && (
                <div className="p-3 bg-black/40 border border-white/10 rounded-xl">
                  <p className="text-gray-400 text-xs mb-2">Splitting to</p>
                  <PaymentSplitsDisplay
                    recipients={extractPaymentRecipients(selectedAlbum)}
                    totalAmount={boostAmount}
                    fallbackRecipient={{
                      address: "03740ea02585ed87b83b2f76317a4562b616bd7b8ec3f925be6596932b2003fc9e",
                      name: 'Recipient'
                    }}
                  />
                </div>
              )}

              {/* Amount Input */}
              <div>
                <label className="text-gray-400 text-sm font-medium">Amount (sats)</label>
                <input
                  type="number"
                  value={boostAmount}
                  onChange={(e) => {
                    const newAmount = Math.max(1, parseInt(e.target.value) || 1);
                    setBoostAmount(newAmount);
                    localStorage.setItem('boost-amount', newAmount.toString());
                  }}
                  className="w-full mt-2 px-4 py-3 bg-black/60 backdrop-blur-md border border-white/20 text-white rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-white/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="Enter amount"
                  min="1"
                />
              </div>
              
              {/* Sender Name */}
              <div>
                <label className="text-gray-400 text-sm font-medium">Your Name (Optional)</label>
                <input
                  type="text"
                  value={senderName}
                  onChange={(e) => {
                    setSenderName(e.target.value);
                    if (e.target.value.trim()) {
                      localStorage.setItem('boost-sender-name', e.target.value.trim());
                    }
                  }}
                  className="w-full mt-2 px-4 py-3 bg-black/60 backdrop-blur-md border border-white/20 text-white rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-white/30"
                  placeholder="Anonymous"
                  maxLength={50}
                />
              </div>

              {/* Boostagram Message */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-gray-400 text-sm font-medium">Message (Optional)</label>
                  <span className="text-gray-500 text-xs">{boostMessage.length}/250</span>
                </div>
                <textarea
                  value={boostMessage}
                  onChange={(e) => setBoostMessage(e.target.value)}
                  className="w-full px-4 py-3 bg-black/60 backdrop-blur-md border border-white/20 text-white rounded-xl text-base resize-none focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-white/30"
                  placeholder="Share your thoughts..."
                  maxLength={250}
                  rows={3}
                />
              </div>
              
              {/* Boost Button - Use album/channel level value block only */}
              <BitcoinConnectPayment
                amount={boostAmount}
                description={`Boost for ${selectedAlbum.title} by ${selectedAlbum.artist}`}
                onSuccess={handleBoostSuccess}
                onError={handleBoostError}
                className="w-full !mt-6"
                recipients={extractPaymentRecipients(selectedAlbum) || undefined}
                recipient="03740ea02585ed87b83b2f76317a4562b616bd7b8ec3f925be6596932b2003fc9e"
                enableBoosts={true}
                boostMetadata={createBoostMetadata({
                  album: selectedAlbum,
                  senderName,
                  message: boostMessage,
                  url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/album/${encodeURIComponent(selectedAlbum.feedId || selectedAlbum.title)}`
                })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}