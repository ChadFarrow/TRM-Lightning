'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Play, Pause, SkipBack, SkipForward, Volume2, Zap, Music, Video } from 'lucide-react';
import { parseBandName } from '@/lib/band-parser';
import { useAudio } from '@/contexts/AudioContext';
import { useLightning } from '@/contexts/LightningContext';
import { BitcoinConnectPayment } from '@/components/BitcoinConnect';
import type { RSSValue } from '@/lib/rss-parser';
import dynamic from 'next/dynamic';
import confetti from 'canvas-confetti';
import PerformanceMonitor from '@/components/PerformanceMonitor';
import { getSiteName, getSiteUrl } from '@/lib/site-config';
import { PlaceholderAlbumArtImage } from '@/lib/image-helpers';
import { createBoostMetadata } from '@/lib/boost-metadata-utils';
import { extractPaymentRecipients, extractTrackPaymentRecipients } from '@/lib/payment-recipient-utils';
import PaymentSplitsDisplay from '@/components/PaymentSplitsDisplay';
import { generateSlug } from '@/lib/url-utils';
import { DARK_HEADER_BG, DARK_HEADER_BORDER, DARK_CARD_CLASSES, DARK_BUTTON_CLASSES, DARK_BADGE_BG, DARK_OVERLAY_BG_DARK } from '@/lib/theme-utils';

// Dynamic import for ControlsBar
const ControlsBar = dynamic(() => import('@/components/ControlsBar'), {
  loading: () => (
    <div className="mb-8 p-4 bg-gray-800/20 rounded-lg animate-pulse">
      <div className="flex items-center gap-4">
        <div className="h-8 bg-gray-700/50 rounded w-24"></div>
        <div className="h-8 bg-gray-700/50 rounded w-20"></div>
        <div className="h-8 bg-gray-700/50 rounded w-16"></div>
        <div className="h-8 bg-gray-700/50 rounded w-20"></div>
      </div>
    </div>
  ),
  ssr: true
});

// Dynamic import for VideoSegmentPlayer
const VideoSegmentPlayer = dynamic(() => import('@/components/VideoSegmentPlayer'), {
  loading: () => (
    <div className="bg-black/40 backdrop-blur-md rounded-xl border border-white/20 overflow-hidden">
      <div className="aspect-video bg-black/60 animate-pulse flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    </div>
  ),
  ssr: false
});

import { Album, Track, PaymentRecipient } from '@/lib/types/album';

interface AlbumDetailClientProps {
  albumTitle: string;
  initialAlbum: Album | null;
}

export default function AlbumDetailClient({ albumTitle, initialAlbum }: AlbumDetailClientProps) {
  const { isLightningEnabled } = useLightning();
  const searchParams = useSearchParams();
  const bandFilter = searchParams.get('band');

  const [album, setAlbum] = useState<Album | null>(initialAlbum);
  const [isLoading, setIsLoading] = useState(!initialAlbum);
  const [error, setError] = useState<string | null>(null);
  const [relatedAlbums, setRelatedAlbums] = useState<Album[]>([]);
  const [siteAlbums, setSiteAlbums] = useState<Album[]>([]);
  const [senderName, setSenderName] = useState('');
  const [boostAmount, setBoostAmount] = useState(50);
  const [boostMessage, setBoostMessage] = useState('');
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [showTrackBoostModal, setShowTrackBoostModal] = useState(false);
  const [trackBoostAmount, setTrackBoostAmount] = useState(50);
  const [trackBoostMessage, setTrackBoostMessage] = useState('');

  // Video/Audio view mode toggle for band sets
  const [viewMode, setViewMode] = useState<'audio' | 'video'>('audio');

  // Filter tracks by band if band parameter is present
  const filteredTracks = useMemo(() => {
    if (!album?.tracks || !bandFilter) return album?.tracks || [];
    return album.tracks.filter(track => {
      const trackBandName = parseBandName(track.title);
      return trackBandName?.toLowerCase() === bandFilter.toLowerCase();
    });
  }, [album?.tracks, bandFilter]);

  // Check if we're in band-filtered mode
  const isBandFiltered = Boolean(bandFilter && filteredTracks.length > 0);

  // Find the main video track with chapters (for band video segments)
  const videoTrackWithChapters = useMemo(() => {
    if (!album?.tracks) return null;
    return album.tracks.find(track =>
      track.mediaType === 'video' && track.chaptersUrl
    ) || null;
  }, [album?.tracks]);

  // Load saved boost preferences from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSenderName = localStorage.getItem('boost-sender-name');
      const savedBoostAmount = localStorage.getItem('boost-amount');
      
      if (savedSenderName) {
        setSenderName(savedSenderName);
      }
      
      if (savedBoostAmount) {
        const amount = parseInt(savedBoostAmount, 10);
        if (!isNaN(amount) && amount > 0) {
          setBoostAmount(amount);
          setTrackBoostAmount(amount);
        }
      }
    }
  }, []);
  
  // Album boost modal state
  const [showAlbumBoostModal, setShowAlbumBoostModal] = useState(false);
  
  // Request deduplication refs
  const loadingAlbumsRef = useRef(false);
  const loadingRelatedRef = useRef(false);
  const loadingAlbumRef = useRef(false);
  const hasLoadedRef = useRef(false);
  const currentAlbumTitleRef = useRef<string | null>(null);
  
  
  // Global audio context
  const { 
    playAlbum: globalPlayAlbum, 
    currentTrack,
    isPlaying: globalIsPlaying,
    pause: globalPause,
    resume: globalResume,
    toggleShuffle
  } = useAudio();

  // Lightning payment handlers
  const handleBoostSuccess = (response: any) => {
    setShowAlbumBoostModal(false);
    setBoostMessage(''); // Clear the message input after successful boost
    
    // Trigger multiple confetti bursts for dramatic effect
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

    fire(0.25, {
      spread: 26,
      startVelocity: 55,
    });
    fire(0.2, {
      spread: 60,
    });
    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 45,
    });
  };

  const handleBoostError = (error: string) => {
  };

  // Get Lightning payment recipients from pre-processed server-side data
  // Memoize payment recipients to prevent render loop
  const paymentRecipients = useMemo(() => {
    if (!album) return null;
    return extractPaymentRecipients(album);
  }, [album]);

  // Get Lightning payment recipients for a specific track
  const getTrackPaymentRecipients = (track: Track): PaymentRecipient[] | null => {
    if (!track) return null;
    return extractTrackPaymentRecipients(track, album || undefined);
  };
  
  // Get fallback recipient for backwards compatibility
  const getFallbackRecipient = (): { address: string; amount: number } => {
    return {
      address: '03740ea02585ed87b83b2f76317a4562b616bd7b8ec3f925be6596932b2003fc9e',
      amount: 50
    };
  };
  
  // Background state
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [backgroundLoaded, setBackgroundLoaded] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const preloadAttemptedRef = useRef(false);

  useEffect(() => {
    setIsClient(true);
    
    const checkDevice = () => {
      setIsDesktop(window.innerWidth > 768);
    };
    
    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  // Define loading functions before useEffect that uses them
  const loadSiteAlbums = useCallback(async () => {
    // Prevent duplicate requests
    if (loadingAlbumsRef.current) {
      return [];
    }
    
    try {
      loadingAlbumsRef.current = true;
      // Use the unified albums endpoint with static source for lightweight loading
      const response = await fetch('/api/albums?source=static');
      if (response.ok) {
        const data = await response.json();
        const albums = data.albums || [];
        setSiteAlbums(albums);
        return albums;
      } else {
      }
    } catch (error) {
    } finally {
      loadingAlbumsRef.current = false;
    }
    return [];
  }, []);

  const loadRelatedAlbums = useCallback(async () => {
    // Prevent duplicate requests
    if (loadingRelatedRef.current) {
      return;
    }
    
    loadingRelatedRef.current = true;
    
    try {
      const response = await fetch('/api/albums?source=auto');
      if (response.ok) {
        const data = await response.json();
        const albums = Array.isArray(data) ? data : [];
        
        const relatedAlbums = albums.filter((relatedAlbum: Album) => {
          // Simple related album logic - same artist or exclude current album
          return relatedAlbum.feedId !== album?.feedId && 
                 (relatedAlbum.artist === album?.artist || 
                  relatedAlbum.title.toLowerCase().includes(album?.title?.toLowerCase() || ''));
        }).slice(0, 6);
        
        setRelatedAlbums(relatedAlbums);
      } else {
      }
    } catch (error) {
    } finally {
      loadingRelatedRef.current = false;
    }
  }, [album]);

  const loadAlbum = useCallback(async () => {
    // Prevent duplicate requests
    if (loadingAlbumRef.current) {
      return;
    }
    
    loadingAlbumRef.current = true;
    const startTime = Date.now();
    const minLoadTime = 300; // Minimum 300ms to prevent flashing
    
    try {
      setIsLoading(true);
      setError(null); // Clear any previous errors
      
      // Convert album title back to URL slug format for API call
      const albumSlug = generateSlug(albumTitle);
      
      // Use the new individual album endpoint that does live RSS parsing with GUID data
      const response = await fetch(`/api/album/${encodeURIComponent(albumSlug)}`);
      
      if (!response.ok) {
        // If 404, set a more specific error message
        if (response.status === 404) {
          setError('Album not found');
        } else {
          setError(`Failed to load album: ${response.status}`);
        }
        hasLoadedRef.current = true;
        return;
      }

      const data = await response.json();
      
      if (data.album) {
        
        // Ensure minimum load time to prevent flashing
        const elapsed = Date.now() - startTime;
        const remainingTime = Math.max(0, minLoadTime - elapsed);
        
        if (remainingTime > 0) {
          await new Promise(resolve => setTimeout(resolve, remainingTime));
        }
        
        setAlbum(data.album);
        setError(null);
        hasLoadedRef.current = true;
        
        // Always set background image for vibrant album backgrounds
        if (data.album.coverArt && !preloadAttemptedRef.current) {
          preloadAttemptedRef.current = true;
          preloadBackgroundImage(data.album);
        }
        
        // Load related albums in background (non-blocking)
        loadRelatedAlbums().catch(error => {
        });
        
        // Load site albums in background (non-blocking)
        loadSiteAlbums().catch(error => {
        });
      } else {
        setError('Album not found');
        hasLoadedRef.current = true;
      }
    } catch (err) {
      setError('Failed to load album');
      hasLoadedRef.current = true;
    } finally {
      setIsLoading(false);
      loadingAlbumRef.current = false;
    }
  }, [albumTitle, loadRelatedAlbums, loadSiteAlbums]);

  // Load album data if not provided
  useEffect(() => {
    // Reset everything if navigating to a different album
    if (currentAlbumTitleRef.current !== albumTitle) {
      currentAlbumTitleRef.current = albumTitle;
      hasLoadedRef.current = false;
      loadingAlbumRef.current = false;
      setError(null);
      setAlbum(null);
      setIsLoading(true);
    }
    
    // Prevent multiple loads for the same album
    if (hasLoadedRef.current) {
      return;
    }
    
    if (!initialAlbum) {
      loadAlbum();
    } else {
      // Set album immediately for faster rendering
      setAlbum(initialAlbum);
      setIsLoading(false);
      hasLoadedRef.current = true;
      
      // Load related data in background with delays to prevent blocking
      setTimeout(() => {
        loadRelatedAlbums().catch(error => {
        });
      }, 200);
      
      setTimeout(() => {
        loadSiteAlbums().catch(error => {
        });
      }, 400);
      
    }
  }, [albumTitle, initialAlbum, loadAlbum, loadRelatedAlbums, loadSiteAlbums]);

  // Separate useEffect for background image preloading to avoid re-running API calls
  useEffect(() => {
    if (initialAlbum && initialAlbum.coverArt && !preloadAttemptedRef.current) {
      preloadAttemptedRef.current = true;
      preloadBackgroundImage(initialAlbum);
    }
  }, [initialAlbum]);

  // Load saved sender name from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSenderName = localStorage.getItem('boost-sender-name');
      if (savedSenderName) {
        setSenderName(savedSenderName);
      }
    }
  }, []);

  // Save sender name to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && senderName.trim()) {
      localStorage.setItem('boost-sender-name', senderName.trim());
    }
  }, [senderName]);

  const preloadBackgroundImage = async (albumData: Album) => {
    if (!albumData.coverArt) {
      setBackgroundLoaded(true);
      return;
    }
    
    try {
      // Set background immediately for faster perceived loading
      setBackgroundImage(albumData.coverArt);
      setBackgroundLoaded(true);
      
      // Preload in background for better caching, but don't block rendering
      const img = new window.Image();
      img.decoding = 'async';
      img.src = albumData.coverArt;
    } catch (error) {
      setBackgroundImage(null);
      setBackgroundLoaded(true);
    }
  };


  const handlePlayAlbum = () => {
    if (!album) return;

    // Use filtered tracks when band-filtered
    const tracksToPlay = isBandFiltered ? filteredTracks : album.tracks;
    const audioTracks = tracksToPlay.map(track => ({
      ...track,
      artist: album.artist,
      album: album.title,
      image: track.image || album.coverArt
    }));

    globalPlayAlbum(audioTracks, 0, isBandFiltered && bandFilter ? `${bandFilter} - ${album.title}` : album.title);
  };

  const handlePlayTrack = (track: Track, index: number) => {
    if (!album) return;

    // Use filtered tracks when band-filtered
    const tracksToPlay = isBandFiltered ? filteredTracks : album.tracks;
    const audioTracks = tracksToPlay.map(t => ({
      ...t,
      artist: album.artist,
      album: album.title,
      image: t.image || album.coverArt
    }));

    globalPlayAlbum(audioTracks, index, isBandFiltered && bandFilter ? `${bandFilter} - ${album.title}` : album.title);
  };


  const isTrackPlaying = (track: Track) => {
    return currentTrack?.url === track.url && globalIsPlaying;
  };

  const formatDuration = (duration: string): string => {
    if (!duration) return '0:00';
    if (duration.includes(':')) return duration;
    
    const seconds = parseInt(duration);
    if (!isNaN(seconds)) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return duration;
  };

  const getReleaseYear = () => {
    if (!album) return '';
    try {
      return new Date(album.releaseDate).getFullYear();
    } catch {
      return '';
    }
  };

  const getAlbumSlug = (albumData: Album) => {
    return generateSlug(albumData.title);
  };

  const getPublisherSlug = (publisherName: string) => {
    return generateSlug(publisherName);
  };

  // Combine and deduplicate related albums
  const getCombinedRelatedAlbums = () => {
    const combined: Album[] = [];
    const seen = new Set<string>();
    
    // Add site albums
    relatedAlbums.forEach(album => {
      const key = `${album.title.toLowerCase()}|${album.artist.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(album);
      }
    });
    
    return combined.slice(0, 8); // Limit to 8 total albums
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white">
        {/* Header Skeleton */}
        <header className="bg-black/50 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-9 h-9 bg-gray-700 rounded-lg animate-pulse"></div>
                <div className="hidden sm:flex items-center gap-2">
                  <div className="w-32 h-4 bg-gray-700 rounded animate-pulse"></div>
                  <div className="w-2 h-4 bg-gray-700 rounded animate-pulse"></div>
                  <div className="w-24 h-4 bg-gray-700 rounded animate-pulse"></div>
                </div>
              </div>
              <div className="hidden sm:block">
                <div className="w-20 h-4 bg-gray-700 rounded animate-pulse"></div>
              </div>
            </div>
          </div>
        </header>

        {/* Album Hero Section Skeleton */}
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col lg:flex-row gap-6 items-start">
              {/* Album Artwork Skeleton */}
              <div className="flex-shrink-0 mx-auto lg:mx-0">
                <div className="w-64 h-64 lg:w-80 lg:h-80 bg-gray-700 rounded-xl animate-pulse"></div>
              </div>

              {/* Album Info Skeleton */}
              <div className="flex-1 text-center lg:text-left">
                <div className="mb-4">
                  <div className="h-12 lg:h-16 bg-gray-700 rounded animate-pulse mb-2"></div>
                  <div className="h-6 lg:h-8 bg-gray-700 rounded animate-pulse mb-2"></div>
                  <div className="h-4 bg-gray-700 rounded animate-pulse mb-4"></div>
                  
                  <div className="flex items-center justify-center lg:justify-start gap-4 mb-6">
                    <div className="h-4 bg-gray-700 rounded animate-pulse w-16"></div>
                    <div className="h-4 bg-gray-700 rounded animate-pulse w-20"></div>
                  </div>

                  <div className="max-w-2xl mx-auto lg:mx-0 mb-6 bg-gray-800/30 rounded-xl p-6">
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-700 rounded animate-pulse"></div>
                      <div className="h-4 bg-gray-700 rounded animate-pulse"></div>
                      <div className="h-4 bg-gray-700 rounded animate-pulse w-3/4"></div>
                    </div>
                  </div>
                </div>

                {/* Play Controls Skeleton */}
                <div className="flex items-center justify-center lg:justify-start gap-4 mb-6">
                  <div className="h-12 bg-gray-700 rounded-full animate-pulse w-32"></div>
                  <div className="h-12 bg-gray-700 rounded-full animate-pulse w-12"></div>
                  <div className="h-12 bg-gray-700 rounded-full animate-pulse w-20"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Track List Skeleton */}
        <div className="container mx-auto px-4 pb-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-black/30 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden">
              <div className="p-6 border-b border-white/10">
                <div className="h-8 bg-gray-700 rounded animate-pulse w-24"></div>
              </div>
              
              <div className="divide-y divide-white/5">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="flex items-center gap-4 p-4">
                    <div className="w-8 h-4 bg-gray-700 rounded animate-pulse"></div>
                    <div className="w-12 h-12 bg-gray-700 rounded animate-pulse"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-700 rounded animate-pulse mb-1"></div>
                      <div className="h-3 bg-gray-700 rounded animate-pulse w-1/2"></div>
                    </div>
                    <div className="h-4 bg-gray-700 rounded animate-pulse w-12"></div>
                    <div className="h-8 bg-gray-700 rounded-lg animate-pulse w-16"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom spacing */}
        <div className="h-24" />
      </div>
    );
  }

  // Only show error if we've actually tried to load and it failed
  // This prevents flashing during initial load
  if ((error || (!album && !isLoading)) && hasLoadedRef.current) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
        <h1 className="text-2xl font-semibold mb-4">{error || 'Album not found'}</h1>
        <Link 
          href="/"
          className="text-blue-400 hover:text-blue-300 transition-colors"
        >
          ← Back to albums
        </Link>
      </div>
    );
  }

  // TypeScript guard: album is guaranteed to be non-null here or we're loading
  if (!album) {
    // Still loading, show spinner
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white relative overflow-hidden">
      <style jsx>{`
        .text-shadow {
          text-shadow: 0 2px 4px rgba(0,0,0,0.5);
        }
        .text-shadow-sm {
          text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        }
      `}</style>
      {/* Dynamic Background with fallback */}
      <div className="fixed inset-0 z-0">
        {/* Primary album background */}
        {backgroundImage && backgroundLoaded ? (
          <Image
            src={backgroundImage}
            alt={`${album.title} background`}
            fill
            className="object-cover w-full h-full"
            priority
            unoptimized={backgroundImage.toLowerCase().endsWith('.gif')}
          />
        ) : (
          /* Fallback to default background */
          <div className="w-full h-full bg-gradient-to-br from-gray-900 to-black"></div>
        )}
        
        {/* Very subtle gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/30"></div>
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="bg-black/40 backdrop-blur-md border-b border-white/20 sticky top-0 z-50 shadow-lg">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link
                  href="/"
                  className="p-2 hover:bg-black/50 rounded-lg transition-colors group"
                  title="Back to albums"
                >
                  <ArrowLeft className="w-5 h-5 group-hover:scale-110 transition-transform" />
                </Link>
                
                <div className="hidden sm:flex items-center gap-2 text-sm">
                  <Link href="/" className="text-gray-400 hover:text-white transition-colors">
                    {getSiteName()}
                  </Link>
                  <span className="text-gray-600">/</span>
                  {isBandFiltered ? (
                    <>
                      <Link href={`/album/${generateSlug(album.title)}`} className="text-gray-400 hover:text-white transition-colors truncate max-w-[150px]">
                        {album.title}
                      </Link>
                      <span className="text-gray-600">/</span>
                      <span className="font-medium truncate max-w-[150px]">{bandFilter}</span>
                    </>
                  ) : (
                    <span className="font-medium truncate max-w-[200px]">{album.title}</span>
                  )}
                </div>
              </div>

              {/* Desktop Version Info */}
              <div className="hidden sm:block text-xs text-gray-400">
                {filteredTracks.length} tracks • {getReleaseYear()}
              </div>
            </div>
          </div>
        </header>

        {/* Album Hero Section */}
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col lg:flex-row gap-6 items-start">
              {/* Album Artwork */}
              <div className="flex-shrink-0 mx-auto lg:mx-0">
                <div className="w-64 h-64 lg:w-80 lg:h-80 relative rounded-xl shadow-2xl overflow-hidden border border-white/20 group cursor-pointer">
                  <Image
                    src={album.coverArt}
                    alt={album.title}
                    fill
                    className="object-cover"
                    priority
                    sizes="(min-width: 1024px) 320px, 256px"
                    unoptimized={album.coverArt.toLowerCase().endsWith('.gif')}
                  />
                  
                  {/* Play Button Overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={handlePlayAlbum}
                      className="p-4 lg:p-6 bg-black/60 backdrop-blur-md border border-white/30 text-white rounded-full hover:scale-110 hover:bg-black/70 transition-all shadow-2xl"
                      title={`Play ${album.title}`}
                    >
                      <svg className="w-8 h-8 lg:w-12 lg:h-12 ml-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Album Info */}
              <div className="flex-1 text-center lg:text-left">
                <div className="mb-4 bg-black/70 rounded-2xl p-6 lg:bg-transparent lg:p-0">
                  <h1 className="text-4xl lg:text-5xl font-bold mb-2 text-white text-shadow drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                    {isBandFiltered ? bandFilter : album.title}
                  </h1>
                  <p className="text-xl lg:text-2xl text-white mb-2 text-shadow-sm drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                    {isBandFiltered ? album.title : album.artist}
                  </p>

                  {/* Publisher Link - hide when band filtered */}
                  {!isBandFiltered && album.publisher && (
                    <div className="mb-4">
                      <Link
                        href={`/publisher/${getPublisherSlug(album.artist)}`}
                        className="inline-flex items-center gap-2 text-sm text-white hover:text-yellow-400 transition-colors underline underline-offset-2 text-shadow-sm drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                        title={`View all albums by ${album.artist}`}
                      >
                        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                        View all albums by {album.artist}
                      </Link>
                    </div>
                  )}

                  <div className="flex items-center justify-center lg:justify-start gap-4 text-sm text-white font-medium mb-6 text-shadow-sm drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                    <span className="flex items-center gap-1.5 bg-black/40 px-3 py-1 rounded-full">
                      <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                      {getReleaseYear()}
                    </span>
                    <span className="flex items-center gap-1.5 bg-black/40 px-3 py-1 rounded-full">
                      <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                      {filteredTracks.length} tracks
                    </span>
                  </div>

                  {/* Description - hide when band filtered */}
                  {!isBandFiltered && album.description && (
                    <div className="max-w-2xl mx-auto lg:mx-0 mb-6 bg-black/40 backdrop-blur-md rounded-xl border border-white/20 p-6">
                      <p className="text-white leading-relaxed">{album.description}</p>
                    </div>
                  )}

                </div>


                {/* Play Controls */}
                <div className="flex items-center justify-center lg:justify-start gap-4 mb-6">
                  <button
                    onClick={handlePlayAlbum}
                    className="flex items-center gap-2 px-8 py-3 bg-black/60 backdrop-blur-md border border-white/20 hover:bg-black/70 hover:border-white/30 rounded-full transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 text-white"
                  >
                    <Play className="w-5 h-5" />
                    <span className="font-semibold">Play Album</span>
                  </button>
                  
                  <button
                    onClick={() => toggleShuffle()}
                    className="p-3 bg-black/50 hover:bg-black/60 rounded-full transition-all backdrop-blur-md border-2 border-white/20 hover:border-white/30 shadow-lg"
                    title="Shuffle"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14.83 13.41L13.42 14.82L16.55 17.95L14.5 20H20V14.5L17.96 16.54L14.83 13.41M14.5 4L16.54 6.04L4 18.59L5.41 20L17.96 7.46L20 9.5V4M10.59 9.17L5.41 4L4 5.41L9.17 10.58L10.59 9.17Z"/>
                    </svg>
                  </button>
                  
                  {/* Album Boost Button */}
                  {isLightningEnabled && (
                    <button
                      onClick={() => setShowAlbumBoostModal(true)}
                      className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-yellow-500 to-orange-600 text-white rounded-full font-semibold transition-all duration-200 hover:from-yellow-400 hover:to-orange-500 hover:shadow-lg transform hover:scale-105 active:scale-95"
                    >
                      <Zap className="w-4 h-4" />
                      <span>Boost</span>
                    </button>
                  )}
                </div>

                {/* Funding Information - Support This Artist */}
                {album.funding && album.funding.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold mb-3 text-white text-center lg:text-left">Support This Artist</h3>
                    <div className="flex flex-wrap justify-center lg:justify-start gap-3">
                      {album.funding.map((funding, index) => (
                        <a
                          key={index}
                          href={funding.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-black/60 backdrop-blur-md border border-white/20 hover:bg-black/70 hover:border-white/30 text-white px-4 py-2 rounded-full text-sm font-medium transition-all transform hover:scale-105 flex items-center gap-2"
                        >
                          💝 {funding.message || 'Support'}
                        </a>
                      ))}
                    </div>
                  </div>
                )}


              </div>
            </div>
          </div>
        </div>

        {/* Track List */}
        <div className="container mx-auto px-4 pb-8">
          <div className="max-w-4xl mx-auto">
            {/* Audio/Video Toggle - only shown when band filtered and video with chapters exists */}
            {isBandFiltered && videoTrackWithChapters && (
              <div className="flex items-center gap-2 mb-4 bg-black/80 p-2 rounded-xl w-fit">
                <button
                  onClick={() => setViewMode('audio')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-all ${
                    viewMode === 'audio'
                      ? 'bg-white text-black shadow-lg'
                      : 'bg-black/60 text-white border border-white/20 hover:bg-black/80'
                  }`}
                >
                  <Music className="w-4 h-4" />
                  Audio Tracks
                </button>
                <button
                  onClick={() => setViewMode('video')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-all ${
                    viewMode === 'video'
                      ? 'bg-white text-black shadow-lg'
                      : 'bg-black/60 text-white border border-white/20 hover:bg-black/80'
                  }`}
                >
                  <Video className="w-4 h-4" />
                  Watch Video
                </button>
              </div>
            )}

            {/* Video Player - shown when in video mode */}
            {isBandFiltered && viewMode === 'video' && videoTrackWithChapters && bandFilter && (
              <VideoSegmentPlayer
                videoUrl={videoTrackWithChapters.url}
                chaptersUrl={videoTrackWithChapters.chaptersUrl}
                bandName={bandFilter}
                title={album.title}
                coverArt={filteredTracks[0]?.image || album.coverArt}
              />
            )}

            {/* Track List - hidden when viewing video */}
            {viewMode === 'audio' && (
            <div className="bg-black/80 border border-white/20 rounded-xl shadow-lg overflow-hidden">
              <div className="p-6 border-b border-white/20">
                <h2 className="text-2xl font-bold text-white drop-shadow-lg">Tracks</h2>
              </div>

              <div className="divide-y divide-white/10">
                {filteredTracks.map((track, index) => {
                  const isCurrentTrack = currentTrack?.url === track.url;
                  const isCurrentlyPlaying = isTrackPlaying(track);
                  
                  return (
                    <div
                      key={track.trackNumber}
                      className={`flex items-center gap-4 p-4 hover:bg-black/50 transition-colors cursor-pointer group ${
                        isCurrentTrack ? 'bg-black/60' : ''
                      }`}
                      onClick={() => handlePlayTrack(track, index)}
                    >
                      {/* Track Number / Play Icon */}
                      <div className="w-8 flex items-center justify-center">
                        {isCurrentlyPlaying ? (
                          <div className="w-4 h-4 flex items-center justify-center">
                            <div className="w-1 h-3 bg-blue-400 animate-pulse mr-0.5"></div>
                            <div className="w-1 h-2 bg-blue-400 animate-pulse delay-75 mr-0.5"></div>
                            <div className="w-1 h-4 bg-blue-400 animate-pulse delay-150"></div>
                          </div>
                        ) : (
                          <span className={`text-sm font-medium ${isCurrentTrack ? 'text-blue-400' : 'text-gray-200 group-hover:text-white'} text-shadow-sm`}>
                            {isBandFiltered ? index + 1 : track.trackNumber}
                          </span>
                        )}
                      </div>

                      {/* Track Artwork */}
                      <div className="w-12 h-12 relative flex-shrink-0 rounded overflow-hidden">
                        <Image
                          src={track.image || album.coverArt}
                          alt={track.title}
                          fill
                          className="object-cover"
                          sizes="48px"
                          unoptimized={(track.image || album.coverArt).toLowerCase().endsWith('.gif')}
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Play className="w-4 h-4 text-white" />
                        </div>
                      </div>

                      {/* Track Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-medium truncate ${
                          isCurrentTrack ? 'text-blue-400' : 'text-white'
                        }`}>
                          {track.title}
                        </h3>
                        <p className="text-sm text-gray-300 truncate text-shadow-sm">{album.artist}</p>
                      </div>

                      {/* Duration or Video indicator */}
                      <div className="text-sm text-gray-200 font-mono text-shadow-sm flex items-center gap-1">
                        {track.mediaType === 'video' ? (
                          <>
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                            </svg>
                            {track.duration && track.duration !== '0:00' ? (
                              <span>{formatDuration(track.duration)}</span>
                            ) : (
                              <span className="text-xs">Video</span>
                            )}
                          </>
                        ) : (
                          formatDuration(track.duration)
                        )}
                      </div>

                      {/* Track Lightning Boost Button */}
                      {isLightningEnabled && (
                        <div 
                          className="flex items-center justify-center ml-2"
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent track play when clicking boost
                          }}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTrack(track);
                              setShowTrackBoostModal(true);
                            }}
                            className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 hover:from-yellow-400 hover:to-orange-500 hover:shadow-lg transform hover:scale-105 active:scale-95"
                          >
                            <Zap className="w-4 h-4" />
                            <span className="hidden sm:inline">Boost</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            )}
          </div>
        </div>



        {/* Album Boost Modal */}
        {isLightningEnabled && showAlbumBoostModal && album && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative bg-black/40 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[85vh] sm:max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300">
              {/* Header with Album Art */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80 z-10" />
                <Image
                  src={album.coverArt}
                  alt={album.title}
                  width={400}
                  height={200}
                  className="w-full h-32 sm:h-40 object-cover"
                  unoptimized={album.coverArt.toLowerCase().endsWith('.gif')}
                />
                <button
                  onClick={() => setShowAlbumBoostModal(false)}
                  className="absolute top-4 right-4 z-20 p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors backdrop-blur-sm"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <div className="absolute bottom-4 left-6 right-6 z-20">
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-1">{album.title}</h3>
                  <p className="text-sm sm:text-base text-gray-200">{album.artist}</p>
                </div>
              </div>
              
              <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(85vh-8rem)] sm:max-h-[calc(90vh-10rem)]">
                {/* Amount Input */}
                <div>
                  <label className="text-gray-400 text-sm font-medium">Amount</label>
                  <div className="flex items-center gap-3 mt-2">
                    <input
                      type="number"
                      value={boostAmount}
                      onChange={(e) => {
                        const newAmount = Math.max(1, parseInt(e.target.value) || 1);
                        setBoostAmount(newAmount);
                        localStorage.setItem('boost-amount', newAmount.toString());
                      }}
                      className="flex-1 px-4 py-3 bg-black/60 backdrop-blur-md border border-white/20 text-white rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-white/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="Enter amount"
                      min="1"
                    />
                    <span className="text-gray-400 font-medium">sats</span>
                  </div>
                </div>

                {/* Payment Splits Display */}
                {boostAmount > 0 && (
                  <PaymentSplitsDisplay
                    recipients={paymentRecipients}
                    totalAmount={boostAmount}
                    fallbackRecipient={{
                      address: getFallbackRecipient().address,
                      name: 'Recipient'
                    }}
                  />
                )}
                
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
                
                {/* Boost Button */}
                <BitcoinConnectPayment
                  amount={boostAmount}
                  description={`Boost for ${album.title} by ${album.artist}`}
                  onSuccess={handleBoostSuccess}
                  onError={handleBoostError}
                  className="w-full !mt-6"
                  recipients={paymentRecipients || undefined}
                  recipient={getFallbackRecipient().address}
                  enableBoosts={true}
                  boostMetadata={createBoostMetadata({
                    album,
                    senderName,
                    message: boostMessage,
                    url: `${getSiteUrl()}/album/${encodeURIComponent(albumTitle)}`
                  })}
                />
              </div>
            </div>
          </div>
        )}

        {/* Track Boost Modal */}
        {isLightningEnabled && showTrackBoostModal && selectedTrack && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative bg-black/40 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[85vh] sm:max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300">
              {/* Header with Track Art */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80 z-10" />
                {selectedTrack.image || album?.coverArt ? (
                  <Image
                    src={selectedTrack.image || album?.coverArt || ''}
                    alt={selectedTrack.title}
                    width={400}
                    height={200}
                    className="w-full h-32 sm:h-40 object-cover"
                    unoptimized={(selectedTrack.image || album?.coverArt || '').toLowerCase().endsWith('.gif')}
                  />
                ) : (
                  <PlaceholderAlbumArtImage
                    alt={selectedTrack.title}
                    width={400}
                    height={200}
                    className="w-full h-32 sm:h-40 object-cover"
                  />
                )}
                <button
                  onClick={() => {
                    setShowTrackBoostModal(false);
                    setSelectedTrack(null);
                  }}
                  className="absolute top-4 right-4 z-20 p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors backdrop-blur-sm"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <div className="absolute bottom-4 left-6 right-6 z-20">
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-1">{selectedTrack.title}</h3>
                  <p className="text-sm sm:text-base text-gray-200">{album?.artist}</p>
                </div>
              </div>
              
              <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(85vh-8rem)] sm:max-h-[calc(90vh-10rem)]">
                {/* Amount Input */}
                <div>
                  <label className="text-gray-400 text-sm font-medium">Amount</label>
                  <div className="flex items-center gap-3 mt-2">
                    <input
                      type="number"
                      value={trackBoostAmount}
                      onChange={(e) => {
                        const newAmount = Math.max(1, parseInt(e.target.value) || 1);
                        setTrackBoostAmount(newAmount);
                        localStorage.setItem('boost-amount', newAmount.toString());
                      }}
                      className="flex-1 px-4 py-3 bg-black/60 backdrop-blur-md border border-white/20 text-white rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-white/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="Enter amount"
                      min="1"
                    />
                    <span className="text-gray-400 font-medium">sats</span>
                  </div>
                </div>

                {/* Payment Splits Display */}
                {trackBoostAmount > 0 && (
                  <PaymentSplitsDisplay
                    recipients={getTrackPaymentRecipients(selectedTrack)}
                    totalAmount={trackBoostAmount}
                    fallbackRecipient={{
                      address: getFallbackRecipient().address,
                      name: 'Recipient'
                    }}
                  />
                )}
                
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
                    <span className="text-gray-500 text-xs">{trackBoostMessage.length}/250</span>
                  </div>
                  <textarea
                    value={trackBoostMessage}
                    onChange={(e) => setTrackBoostMessage(e.target.value)}
                    className="w-full px-4 py-3 bg-black/60 backdrop-blur-md border border-white/20 text-white rounded-xl text-base resize-none focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-white/30"
                    placeholder="Share your thoughts..."
                    maxLength={250}
                    rows={3}
                  />
                </div>
                
                {/* Boost Button */}
                <BitcoinConnectPayment
                  amount={trackBoostAmount}
                  description={`Boost for "${selectedTrack.title}" by ${album?.artist}`}
                  onSuccess={(response) => {
                    handleBoostSuccess(response);
                    setShowTrackBoostModal(false);
                    setSelectedTrack(null);
                    setTrackBoostMessage('');
                  }}
                  onError={handleBoostError}
                  className="w-full !mt-6"
                  recipients={getTrackPaymentRecipients(selectedTrack) || undefined}
                  recipient={getFallbackRecipient().address}
                  enableBoosts={true}
                  boostMetadata={createBoostMetadata({
                    album: album || undefined,
                    track: selectedTrack,
                    senderName,
                    message: trackBoostMessage,
                    episode: selectedTrack.title,
                    url: `${getSiteUrl()}/album/${encodeURIComponent(albumTitle)}`
                  })}
                />
              </div>
            </div>
          </div>
        )}

        {/* Bottom spacing for audio player */}
        <div className="h-24" />
      </div>
      
      {/* Performance Monitor (development only) */}
      <PerformanceMonitor />
    </div>
  );
}