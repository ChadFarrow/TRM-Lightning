'use client';

import React, { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Hls from 'hls.js';
import { useAudio } from '@/contexts/AudioContext';
import { useLightning } from '@/contexts/LightningContext';
import { useSwipeGestures } from '@/hooks/useSwipeGestures';
import { extractColorsFromImage, createAlbumBackground, createTextOverlay, createButtonStyles, ExtractedColors } from '@/lib/color-utils';
import { selectBestSource, getMediaType } from '@/lib/enclosure-utils';
import { PodcastParser } from '@/lib/podcast-parser';
import type { PodcastChapter } from '@/lib/types/podcast';
import { performanceMonitor, getMobileOptimizations, getCachedColors, debounce } from '@/lib/performance-utils';
import { BitcoinConnectPayment } from '@/components/BitcoinConnect';
import { useBitcoinConnect } from '@/contexts/BitcoinConnectContext';
import { getSiteName } from '@/lib/site-config';
import confetti from 'canvas-confetti';
import { extractPaymentRecipients } from '@/lib/payment-recipient-utils';
import PaymentSplitsDisplay from '@/components/PaymentSplitsDisplay';
import { generateSlug } from '@/lib/url-utils';
import { Album } from '@/lib/types/album';
import { createBoostMetadata } from '@/lib/boost-metadata-utils';

interface NowPlayingScreenProps {
  isOpen: boolean;
  onClose: () => void;
}

// Global color cache to persist across component remounts
const globalColorCache = new Map<string, ExtractedColors>();
let colorDataPromise: Promise<any> | null = null;

const NowPlayingScreen: React.FC<NowPlayingScreenProps> = ({ isOpen, onClose }) => {
  const router = useRouter();
  const { isLightningEnabled } = useLightning();
  const [extractedColors, setExtractedColors] = useState<ExtractedColors | null>(null);
  const [isLoadingColors, setIsLoadingColors] = useState(false);
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [boostAmount, setBoostAmount] = useState(50);
  const [senderName, setSenderName] = useState('');
  const [boostMessage, setBoostMessage] = useState('');
  const [albumData, setAlbumData] = useState<any>(null);
  const albumDataRef = useRef<any>(null);
  
  // Keep ref in sync with state
  useEffect(() => {
    albumDataRef.current = albumData;
  }, [albumData]);
  const colorCache = useRef<Map<string, ExtractedColors>>(globalColorCache);
  
  const [chapters, setChapters] = useState<PodcastChapter[]>([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(-1);
  const chaptersTrackKeyRef = useRef<string | null>(null);

  const { checkConnection } = useBitcoinConnect();

  const {
    currentTrack,
    currentAlbum,
    isPlaying,
    currentTime,
    duration,
    isShuffling,
    isRepeating,
    isVideo,
    videoRef,
    pause,
    resume,
    nextTrack,
    previousTrack,
    seekTo,
    toggleShuffle,
    toggleRepeat,
    switchSource,
    setVideoTime,
    setVideoDuration,
  } = useAudio();

  // Load chapters when track changes (use pre-loaded if available, fetch as fallback)
  useEffect(() => {
    const trackKey = currentTrack?.url || null;
    if (trackKey === chaptersTrackKeyRef.current) return;
    chaptersTrackKeyRef.current = trackKey;
    setChapters([]);
    setCurrentChapterIndex(-1);

    if (!currentTrack) return;

    // Use pre-loaded chapters from static data if available
    if (currentTrack.chapters && currentTrack.chapters.length > 0) {
      setChapters(currentTrack.chapters);
      return;
    }

    // Fallback: fetch chapters from URL
    if (!currentTrack.chaptersUrl) return;

    PodcastParser.fetchChapters(currentTrack.chaptersUrl).then((fetchedChapters) => {
      if (chaptersTrackKeyRef.current === trackKey && fetchedChapters.length > 0) {
        setChapters(fetchedChapters);
      }
    });
  }, [currentTrack?.url, currentTrack?.chaptersUrl, currentTrack?.chapters]);

  // Track current chapter based on playback time
  useEffect(() => {
    if (chapters.length === 0) {
      if (currentChapterIndex !== -1) setCurrentChapterIndex(-1);
      return;
    }
    let idx = -1;
    for (let i = chapters.length - 1; i >= 0; i--) {
      if (currentTime >= chapters[i].startTime) {
        idx = i;
        break;
      }
    }
    if (idx !== currentChapterIndex) setCurrentChapterIndex(idx);
  }, [currentTime, chapters, currentChapterIndex]);

  const currentChapter = currentChapterIndex >= 0 ? chapters[currentChapterIndex] : null;

  // Add swipe gestures for mobile
  const swipeRef = useSwipeGestures({
    onSwipeLeft: nextTrack,
    onSwipeRight: previousTrack,
    onSwipeDown: onClose,
    threshold: 50,
    velocityThreshold: 0.3
  });

  // Store HLS instance ref for cleanup
  const hlsRef = useRef<Hls | null>(null);

  // Handle video source setup when track changes (with HLS.js support)
  useEffect(() => {
    if (!isOpen || !isVideo || !currentTrack || !videoRef.current) return;

    const video = videoRef.current;
    const url = currentTrack.url;

    // Cleanup previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Video event handlers for time/duration sync
    const handleTimeUpdate = () => setVideoTime(video.currentTime);
    const handleDurationChange = () => {
      if (!isNaN(video.duration) && isFinite(video.duration)) {
        setVideoDuration(video.duration);
      }
    };
    const handleLoadedMetadata = () => {
      if (!isNaN(video.duration) && isFinite(video.duration)) {
        setVideoDuration(video.duration);
      }
    };

    // Add event listeners
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    // Check if this is an HLS stream
    const isHlsStream = url.includes('.m3u8') ||
      currentTrack.mimeType === 'application/x-mpegURL' ||
      currentTrack.mimeType === 'application/vnd.apple.mpegurl';

    if (isHlsStream) {
      // Check if native HLS is supported (Safari)
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        video.load();
        // Always auto-play when a new track is selected
        video.play().catch(error => {
          if (error.name !== 'AbortError') {
            console.warn('Video playback error:', error);
          }
        });
      } else if (Hls.isSupported()) {
        // Use HLS.js for Chrome, Firefox, etc.
        // Configure larger buffers for long-form content to reduce stalls
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          maxBufferLength: 60,           // Buffer up to 60s ahead (default 30s)
          maxMaxBufferLength: 600,       // Allow up to 10 min max buffer
          maxBufferHole: 0.5,            // Tolerate 0.5s gaps in buffer
          fragLoadingMaxRetry: 6,        // Retry fragment loads up to 6 times
          fragLoadingRetryDelay: 1000,   // Start with 1s retry delay
          manifestLoadingMaxRetry: 4,    // Retry manifest loads
          levelLoadingMaxRetry: 4,       // Retry level loads
        });
        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          // Always auto-play when manifest is ready (user clicked to play this track)
          video.play().catch(error => {
            if (error.name !== 'AbortError') {
              console.warn('Video playback error:', error);
            }
          });
        });
        // Get duration from HLS level data
        hls.on(Hls.Events.LEVEL_LOADED, (event, data) => {
          if (data.details && data.details.totalduration) {
            setVideoDuration(data.details.totalduration);
          }
        });
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            console.error('HLS fatal error:', data.type, data.details);
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              // Network error — restart loading to recover
              console.log('[HLS] Attempting network error recovery...');
              hls.startLoad();
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              // Media error — attempt recovery
              console.log('[HLS] Attempting media error recovery...');
              hls.recoverMediaError();
            }
          } else {
            // Non-fatal errors: log buffer stalls for diagnostics
            if (data.details === 'bufferStalledError') {
              console.warn('[HLS] Buffer stalled — playback may resume when data arrives');
            }
          }
        });
      } else {
        console.error('HLS is not supported in this browser');
      }
    } else {
      // Non-HLS video (MP4, WebM, etc.)
      video.src = url;
      video.load();
      // Always auto-play when a new track is selected
      video.play().catch(error => {
        if (error.name !== 'AbortError') {
          console.warn('Video playback error:', error);
        }
      });
    }

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [isVideo, currentTrack, videoRef, isOpen, setVideoTime, setVideoDuration]);

  // Handle video pause/resume separately (doesn't reinitialize HLS)
  useEffect(() => {
    if (!isOpen || !isVideo || !videoRef.current) return;
    const video = videoRef.current;

    if (isPlaying) {
      video.play().catch(error => {
        if (error.name !== 'AbortError') {
          console.warn('Video resume error:', error);
        }
      });
    } else {
      video.pause();
    }
  }, [isOpen, isVideo, isPlaying, videoRef]);

  // Stall recovery: detect when video is paused unexpectedly (e.g. buffer stall,
  // network hiccup) and attempt to resume playback. This is the main fix for
  // video stopping after long playback periods.
  useEffect(() => {
    if (!isOpen || !isVideo || !videoRef.current) return;

    const video = videoRef.current;
    let recoveryTimer: ReturnType<typeof setInterval> | null = null;

    const attemptRecovery = () => {
      // Only recover if we think we should be playing but the video is paused
      // and it hasn't ended
      if (video.paused && !video.ended && video.readyState >= 2) {
        console.log('[Video] Detected unexpected pause, attempting recovery...');
        video.play().catch(error => {
          if (error.name !== 'AbortError') {
            console.warn('[Video] Recovery play failed:', error);
            // If HLS, try restarting the load
            if (hlsRef.current) {
              console.log('[Video] Restarting HLS load for recovery...');
              hlsRef.current.startLoad();
            }
          }
        });
      }
    };

    // Listen for the video stalling — set up periodic recovery attempts
    const handleStalled = () => {
      console.log('[Video] Stalled event fired, starting recovery timer...');
      if (!recoveryTimer) {
        recoveryTimer = setInterval(attemptRecovery, 5000);
      }
    };

    // Once playing again, clear recovery timer
    const handlePlaying = () => {
      if (recoveryTimer) {
        clearInterval(recoveryTimer);
        recoveryTimer = null;
      }
    };

    video.addEventListener('stalled', handleStalled);
    video.addEventListener('waiting', handleStalled);
    video.addEventListener('playing', handlePlaying);

    return () => {
      video.removeEventListener('stalled', handleStalled);
      video.removeEventListener('waiting', handleStalled);
      video.removeEventListener('playing', handlePlaying);
      if (recoveryTimer) {
        clearInterval(recoveryTimer);
      }
    };
  }, [isOpen, isVideo, videoRef]);

  // Performance-optimized color loading with mobile considerations
  const loadColors = useRef(debounce(async (albumTitle: string, track: any) => {
    const timer = performanceMonitor.startTimer('colorLoad');
    // Create cache key that includes track info for track-specific colors
    const cacheKey = track.image 
      ? `${albumTitle.toLowerCase()}-${track.title?.toLowerCase() || 'unknown'}` 
      : albumTitle.toLowerCase();
    
    console.log('🎨 [Color Load] Starting color extraction:', {
      albumTitle,
      trackTitle: track.title,
      trackImage: track.image,
      cacheKey,
    });
    
    try {
      // Check memory cache first
      if (colorCache.current.has(cacheKey)) {
        const cachedColors = colorCache.current.get(cacheKey)!;
        console.log('🎨 [Color Load] Using memory cache for:', cacheKey, {
          dominant: cachedColors.dominant,
          isDark: cachedColors.isDark,
        });
        setExtractedColors(cachedColors);
        performanceMonitor.recordCacheHit();
        return;
      }

      // Note: Skip preloaded cache check for now to ensure we check for track-specific colors
      // We'll check preloaded colors later as a fallback

      console.log('🎨 [Color Load] Loading colors from network for:', albumTitle);
      setIsLoadingColors(true);

      // Create or reuse the shared promise for color data loading
      if (!colorDataPromise) {
        colorDataPromise = fetch('/data/albums-with-colors.json')
          .then(async response => {
            if (!response.ok) {
              // File doesn't exist - return empty data
              return { albums: [] };
            }
            
            // Check content type
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
              return { albums: [] };
            }
            
            const text = await response.text();
            if (!text || text.trim().length === 0) {
              return { albums: [] };
            }
            
            try {
              return JSON.parse(text);
            } catch (parseError) {
              // Invalid JSON - return empty data
              return { albums: [] };
            }
          })
          .catch(error => {
            // Silently fail - color data is optional
            colorDataPromise = null;
            return { albums: [] };
          });
      }

      const data = await colorDataPromise;
      const album = data.albums?.find((a: any) => 
        a.title?.toLowerCase() === albumTitle.toLowerCase()
      );
      
      console.log('🎨 [Color Load] Album lookup result:', {
        found: !!album,
        hasTracks: !!album?.tracks,
        tracksCount: album?.tracks?.length || 0,
        hasAlbumColors: !!album?.colors,
      });
      
      let colors = null;
      
      // Check for track-specific colors first
      if (album?.tracks && track.image) {
        console.log('🎵 [Color Load] Checking for track-specific colors:', {
          trackTitle: track.title,
          trackImage: track.image,
          availableTracks: album.tracks.map((t: any) => ({
            title: t.title,
            image: t.image,
            hasColors: !!t.colors,
          })),
        });
        
        const trackMatch = album.tracks.find((t: any) => 
          t.title?.toLowerCase() === track.title?.toLowerCase() && 
          t.image === track.image && 
          t.colors
        );
        
        if (trackMatch?.colors) {
          console.log('🎵 [Color Load] Using track-specific colors for:', track.title, {
            dominant: trackMatch.colors.dominant,
            isDark: trackMatch.colors.isDark,
          });
          colors = trackMatch.colors;
        } else {
          console.log('🎵 [Color Load] No matching track-specific colors found');
        }
      }

      // If track has its own image but no track-specific colors, extract from track image immediately
      // Don't fall back to album colors if track has unique artwork
      if (!colors && track.image && !track.image.toLowerCase().endsWith('.gif')) {
        console.log('🎨 [Color Load] Track has unique image, extracting colors from track artwork:', {
          trackTitle: track.title,
          trackImage: track.image,
        });
        try {
          const extracted = await extractColorsFromImage(track.image);
          
          console.log('🎨 [Color Load] Extraction result from track image:', {
            dominant: extracted.dominant,
            isDark: extracted.isDark,
            palette: extracted.palette,
          });
          
          // Cache the extracted colors
          const mobileOpts = getMobileOptimizations();
          if (colorCache.current.size >= mobileOpts.maxCacheSize) {
            const firstKey = colorCache.current.keys().next().value;
            if (firstKey) {
              console.log('🎨 [Color Load] Cache full, evicting:', firstKey);
              colorCache.current.delete(firstKey);
            }
          }
          
          colorCache.current.set(cacheKey, extracted);
          setExtractedColors(extracted);
          performanceMonitor.recordCacheMiss();
          console.log('✅ [Color Load] Successfully extracted and cached colors from track artwork');
          return; // Exit early since we got track-specific colors
        } catch (extractError) {
          console.warn('⚠️ [Color Load] Failed to extract from track image, will try fallbacks:', extractError);
          // Continue to fallbacks below
        }
      }
      
      // Fallback to album colors (only if track doesn't have its own image or extraction failed)
      if (!colors && album?.colors) {
        console.log('🎨 [Color Load] Using album colors for:', albumTitle, {
          dominant: album.colors.dominant,
          isDark: album.colors.isDark,
        });
        colors = album.colors;
      }
      
      // Final fallback: check preloaded cache (only if no track image)
      if (!colors && !track.image) {
        const preloadedColors = getCachedColors(albumTitle);
        if (preloadedColors) {
          console.log('🎨 [Color Load] Using preloaded cache as final fallback for:', albumTitle, {
            dominant: preloadedColors.dominant,
            isDark: preloadedColors.isDark,
          });
          colors = preloadedColors;
        }
      }

      if (colors) {
        // Cache with size limit for mobile performance
        const mobileOpts = getMobileOptimizations();
        if (colorCache.current.size >= mobileOpts.maxCacheSize) {
          const firstKey = colorCache.current.keys().next().value;
          if (firstKey) {
            console.log('🎨 [Color Load] Cache full, evicting:', firstKey);
            colorCache.current.delete(firstKey);
          }
        }
        
        colorCache.current.set(cacheKey, colors);
        setExtractedColors(colors);
        performanceMonitor.recordCacheMiss();
        console.log('✅ [Color Load] Colors loaded and cached successfully');
      } else {
        // Final fallback: Extract colors from album cover art (only if track has no image)
        console.log('🎨 [Color Load] No colors found, extracting from album cover art:', {
          albumTitle,
          trackTitle: track.title,
          trackImage: track.image,
          albumCoverArt: albumDataRef.current?.coverArt,
        });
        try {
          const imageUrl = albumDataRef.current?.coverArt;
          
          if (imageUrl) {
            console.log('🖼️ [Color Load] Extracting colors from album cover art:', imageUrl);
            const extracted = await extractColorsFromImage(imageUrl);
            
            console.log('🎨 [Color Load] Extraction result:', {
              dominant: extracted.dominant,
              isDark: extracted.isDark,
              palette: extracted.palette,
            });
            
            // Cache the extracted colors
            const mobileOpts = getMobileOptimizations();
            if (colorCache.current.size >= mobileOpts.maxCacheSize) {
              const firstKey = colorCache.current.keys().next().value;
              if (firstKey) {
                console.log('🎨 [Color Load] Cache full, evicting:', firstKey);
                colorCache.current.delete(firstKey);
              }
            }
            
            colorCache.current.set(cacheKey, extracted);
            setExtractedColors(extracted);
            console.log('✅ [Color Load] Successfully extracted and cached colors from album cover art');
          } else {
            console.warn('🎨 [Color Load] No image URL available for color extraction:', {
              hasTrackImage: !!track.image,
              hasAlbumCoverArt: !!albumDataRef.current?.coverArt,
            });
            setExtractedColors(null);
          }
        } catch (extractError) {
          console.error('❌ [Color Load] Failed to extract colors from artwork:', extractError, {
            trackImage: track.image,
            albumCoverArt: albumDataRef.current?.coverArt,
          });
          setExtractedColors(null);
        }
      }
      
    } catch (error) {
      console.error('❌ [Color Load] Failed to load colors:', error, {
        albumTitle,
        trackTitle: track.title,
        cacheKey,
      });
      setExtractedColors(null);
    } finally {
      setIsLoadingColors(false);
      timer();
    }
  }, getMobileOptimizations().colorLoadDelay)).current;

  useEffect(() => {
    if (!isOpen || !currentTrack) {
      setExtractedColors(null);
      return;
    }

    const albumTitle = currentAlbum;
    if (!albumTitle) {
      console.log('🎨 No album title provided');
      setExtractedColors(null);
      return;
    }

    loadColors(albumTitle, currentTrack);
  }, [isOpen, currentAlbum, currentTrack, loadColors]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // Load album data when album changes
  useEffect(() => {
    if (currentAlbum && isOpen) {
      fetchAlbumData(currentAlbum);
    } else {
      setAlbumData(null);
    }
  }, [currentAlbum, isOpen]);

  // Load saved boost preferences on component mount
  useEffect(() => {
    if (isOpen) {
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
    }
  }, [isOpen]);

  // Save sender name to localStorage when it changes
  useEffect(() => {
    if (senderName.trim()) {
      localStorage.setItem('boost-sender-name', senderName.trim());
    }
  }, [senderName]);

  if (!isOpen || !currentTrack) return null;

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    seekTo(newTime);
  };

  const handleViewAlbum = () => {
    if (currentAlbum) {
      const albumSlug = generateSlug(currentAlbum);
      
      router.push(`/album/${albumSlug}`);
      onClose(); // Close the now playing screen
    }
  };

  const handleBoostSuccess = (response: any) => {
    setShowBoostModal(false);
    setBoostMessage(''); // Clear the message input after successful boost
    
    // Trigger multiple confetti bursts for dramatic effect
    const count = 200;
    const defaults = {
      origin: { y: 0.7 },
      colors: ['#FFD700', '#FFA500', '#FF8C00', '#FFE55C', '#FFFF00']
    };

    function fire(particleRatio: number, opts: any) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
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
    console.error('Boost failed:', error);
  };

  // Fetch album data to get podcast:value splits (fallback only)
  const fetchAlbumData = async (albumTitle: string) => {
    try {
      console.log('🔍 Fetching album data for fallback value data:', albumTitle);
      
      // Convert album title to URL-friendly format (same as album page)
      const albumId = generateSlug(albumTitle);
      
      const response = await fetch(`/api/album/${encodeURIComponent(albumId)}`);
      const data = await response.json();
      
      if (data.success && data.album) {
        console.log('✅ Found fallback album data:', data.album.title, {
          hasValue: !!data.album.value,
          recipients: data.album.value?.recipients?.length || 0
        });
        setAlbumData(data.album);
      } else {
        console.log('❌ No fallback album found for:', albumTitle);
        setAlbumData(null);
      }
    } catch (error) {
      console.error('Failed to fetch fallback album data:', error);
      setAlbumData(null);
    }
  };

  // Get Lightning payment recipients from RSS value data
  const getPaymentRecipients = (): Array<{ address: string; split: number; name?: string; fee?: boolean; type?: string }> | null => {
    if (currentTrack && albumData) {
      return extractPaymentRecipients(albumData as Album, currentTrack);
    }
    if (albumData) {
      return extractPaymentRecipients(albumData as Album);
    }
    return null;
  };

  // Get fallback recipient for payments (same as AlbumCard)
  const getFallbackRecipient = (): { address: string; amount: number } => {
    return {
      address: '03740ea02585ed87b83b2f76317a4562b616bd7b8ec3f925be6596932b2003fc9e',
      amount: 50
    };
  };

  // Generate mobile-optimized background styles
  const mobileOpts = getMobileOptimizations();
  const backgroundStyle = extractedColors 
    ? { 
        background: createAlbumBackground(extractedColors),
        willChange: mobileOpts.willChange,
        contain: mobileOpts.cssContainment
      }
    : { 
        background: 'linear-gradient(135deg, #1e3a8a 0%, #3730a3 25%, #581c87 75%, #000000 100%)',
        willChange: mobileOpts.willChange,
        contain: mobileOpts.cssContainment
      };

  const overlayStyle = extractedColors 
    ? { background: createTextOverlay(extractedColors) }
    : { background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.3) 100%)' };

  // Generate dynamic button styles that match the background
  const buttonStyles = extractedColors 
    ? createButtonStyles(extractedColors)
    : {
        background: 'rgba(255, 255, 255, 0.1)',
        border: 'rgba(255, 255, 255, 0.2)',
        hoverBackground: 'rgba(255, 255, 255, 0.2)',
        hoverBorder: 'rgba(255, 255, 255, 0.3)',
      };

  return (
    <div 
      ref={swipeRef}
      className="fixed inset-0 z-[100] flex flex-col transition-colors duration-500 ease-in-out"
      style={backgroundStyle}
    >
      {/* Color overlay for better text readability */}
      <div className="absolute inset-0 pointer-events-none" style={overlayStyle} />
      {/* Header */}
      <div className="flex items-center justify-between p-4 sm:p-6 pt-safe-max">
        <button
          onClick={onClose}
          className="p-2 text-white/60 hover:text-white transition-colors"
          title="Close"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        <div className="text-center">
          <p className="text-xs text-white/60 uppercase tracking-wider">Playing from</p>
          <p className="text-sm text-white font-medium">{currentAlbum || 'Queue'}</p>
        </div>

        <button
          onClick={handleViewAlbum}
          className="p-2 text-white/60 hover:text-white transition-colors"
          title="View album"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 pb-4 sm:pb-8 pb-safe-max-2">
        {/* Album Art / Video - Responsive to window size */}
        <div className={`w-full max-w-xs sm:max-w-sm md:max-w-md relative mb-6 sm:mb-8 ${isVideo ? 'aspect-video' : 'aspect-square'}`}>
          {isVideo ? (
            <video
              ref={videoRef}
              className="w-full h-full object-contain rounded-lg shadow-2xl bg-black"
              playsInline
              controls={false}
              onClick={() => isPlaying ? pause() : resume()}
            />
          ) : (currentChapter?.img || currentTrack.image) ? (
            <Image
              src={currentChapter?.img || currentTrack.image!}
              alt={currentChapter?.title || currentTrack.title}
              fill
              className="object-cover rounded-lg shadow-2xl"
              sizes="(max-width: 768px) 90vw, 400px"
              priority
              key={currentChapter?.img || currentTrack.image}
            />
          ) : (
            <div className="w-full h-full bg-gray-800 rounded-lg flex items-center justify-center">
              <svg className="w-24 h-24 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
              </svg>
            </div>
          )}
        </div>

        {/* Track Info */}
        <div className="w-full max-w-md text-center mb-8 bg-black/40 backdrop-blur-sm rounded-xl px-5 py-3">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1 truncate">
            {currentTrack.title}
          </h1>
          <p className="text-lg sm:text-xl text-white/80 truncate">
            {currentTrack.artist || 'Unknown Artist'}
          </p>
          {currentChapter && (
            <p className="text-sm text-white/60 truncate mt-1">
              Ch. {currentChapterIndex + 1}/{chapters.length}: {currentChapter.title}
            </p>
          )}
        </div>

        {/* Progress Bar */}
        <div className="w-full max-w-md mb-8">
          <div className="relative">
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer slider-large relative z-10"
              style={{
                background: `linear-gradient(to right, #ffffff 0%, #ffffff ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.2) ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.2) 100%)`
              }}
            />
            {/* Chapter tick marks */}
            {duration > 0 && chapters.length > 0 && (
              <div className="absolute inset-0 pointer-events-none">
                {chapters.map((chapter, i) => (
                  <div
                    key={i}
                    className="absolute w-0.5 h-2.5 bg-white/60 rounded-full"
                    style={{ left: `${(chapter.startTime / duration) * 100}%`, top: '50%', transform: 'translateY(-50%)' }}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-xs text-white">{formatTime(currentTime)}</span>
            <span className="text-xs text-white">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Main Controls */}
        <div className="flex flex-col items-center gap-4 mb-8">
          {/* Media Controls Row */}
          <div className="flex items-center justify-center gap-4 sm:gap-6">
            <button
              onClick={toggleShuffle}
              className={`p-2 transition-colors ${
                isShuffling ? 'text-white' : 'text-white/70 hover:text-white'
              }`}
              title="Toggle shuffle"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
              </svg>
            </button>

            <button
              onClick={previousTrack}
              className="p-3 text-white hover:scale-110 transition-transform"
              title="Previous track"
            >
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
              </svg>
            </button>

            <button
              onClick={isPlaying ? pause : resume}
              className="p-4 bg-white text-black rounded-full hover:scale-110 transition-transform"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>
              ) : (
                <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </button>

            <button
              onClick={nextTrack}
              className="p-3 text-white hover:scale-110 transition-transform"
              title="Next track"
            >
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
              </svg>
            </button>

            <button
              onClick={toggleRepeat}
              className={`p-2 transition-colors ${
                isRepeating ? 'text-white' : 'text-white/70 hover:text-white'
              }`}
              title="Toggle repeat"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
              </svg>
            </button>
          </div>

          {/* Audio/Video Toggle - show when alternate enclosures have a different media type */}
          {currentTrack?.alternateEnclosures && currentTrack.alternateEnclosures.length > 0 && (() => {
            // Check if there's a video alternate when playing audio, or vice versa
            const hasVideoAlt = currentTrack.alternateEnclosures!.some(e => getMediaType(e.type) === 'video');
            if (!hasVideoAlt) return null;

            return (
              <div className="flex items-center justify-center">
                <div className="flex items-center bg-black/40 backdrop-blur-md rounded-full p-1 border border-black/20 shadow-lg">
                  <button
                    onClick={() => {
                      if (isVideo && currentTrack.originalUrl) {
                        switchSource(currentTrack.originalUrl, currentTrack.originalMimeType, currentTrack.originalMediaType || 'audio');
                      }
                    }}
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                      !isVideo
                        ? 'bg-white text-black shadow-sm'
                        : 'text-white/70 hover:text-white'
                    }`}
                    title="Audio"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                    </svg>
                    Audio
                  </button>
                  <button
                    onClick={() => {
                      if (!isVideo) {
                        // Switch to video - find the first video alternate enclosure
                        const videoEnclosure = currentTrack.alternateEnclosures!.find(e => getMediaType(e.type) === 'video');
                        if (videoEnclosure) {
                          const sourceUrl = selectBestSource(videoEnclosure);
                          if (sourceUrl) {
                            switchSource(sourceUrl, videoEnclosure.type, 'video');
                          }
                        }
                      }
                    }}
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                      isVideo
                        ? 'bg-white text-black shadow-sm'
                        : 'text-white/70 hover:text-white'
                    }`}
                    title="Video"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Video
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Boost Button Row - only show when Lightning is enabled */}
          {isLightningEnabled && (
            <div className="flex items-center justify-center w-full relative">
              <button
                onClick={() => {
                  checkConnection();
                  setShowBoostModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 backdrop-blur-sm rounded-full text-white hover:text-yellow-300 transform hover:scale-105 transition-all duration-150 text-sm"
                style={{
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
                background: buttonStyles.background,
                border: `1px solid ${buttonStyles.border}`
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = buttonStyles.hoverBackground;
                e.currentTarget.style.border = `1px solid ${buttonStyles.hoverBorder}`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = buttonStyles.background;
                e.currentTarget.style.border = `1px solid ${buttonStyles.border}`;
              }}
              title="Boost this song"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7 2v11h3v9l7-12h-4l4-8z"/>
              </svg>
              <span className="font-medium">Boost Song</span>
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Boost Modal - only show when Lightning is enabled */}
      {isLightningEnabled && showBoostModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative bg-black/40 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl max-w-sm w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7 2v11h3v9l7-12h-4l4-8z"/>
                  </svg>
                  Boost Song
                </h3>
                <button
                  onClick={() => setShowBoostModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                  title="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Payment Splits Display */}
              {boostAmount > 0 && (
                <div className="p-3 mb-4 bg-black/40 border border-white/10 rounded-xl">
                  <p className="text-gray-400 text-xs mb-2">Splitting to</p>
                  <PaymentSplitsDisplay
                    recipients={getPaymentRecipients()}
                    totalAmount={boostAmount}
                    fallbackRecipient={{
                      address: getFallbackRecipient().address,
                      name: 'Recipient'
                    }}
                  />
                </div>
              )}

              {/* Amount Selection */}
              <div className="mb-6">
                <p className="text-gray-300 text-xs mb-3 uppercase tracking-wide">Amount (sats)</p>
                <input
                  type="number"
                  value={boostAmount}
                  onChange={(e) => {
                    const newAmount = Math.max(1, parseInt(e.target.value) || 1);
                    setBoostAmount(newAmount);
                    localStorage.setItem('boost-amount', newAmount.toString());
                  }}
                  className="w-full px-3 py-2 bg-black/60 backdrop-blur-md border border-white/20 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-white/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="Enter amount"
                  min="1"
                />
              </div>
              
              {/* Sender Name */}
              <div className="mb-6">
                <p className="text-gray-300 text-xs mb-3 uppercase tracking-wide">Your Name (Optional)</p>
                <input
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  className="w-full px-3 py-2 bg-black/60 backdrop-blur-md border border-white/20 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-white/30"
                  placeholder="Enter your name to be credited in the boost"
                  maxLength={50}
                />
                <p className="text-gray-500 text-xs mt-1">This will be included with your boost payment</p>
              </div>

              {/* Boostagram Message */}
              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  Message (Optional)
                </label>
                <textarea
                  value={boostMessage}
                  onChange={(e) => setBoostMessage(e.target.value)}
                  className="w-full px-3 py-2 bg-black/60 backdrop-blur-md border border-white/20 text-white rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-white/30"
                  placeholder="Enter your boostagram message (up to 250 characters)"
                  maxLength={250}
                  rows={3}
                />
                <div className="flex justify-between items-center mt-1">
                  <p className="text-gray-500 text-xs">Custom message for your boost</p>
                  <p className="text-gray-400 text-xs">{boostMessage.length}/250</p>
                </div>
              </div>
              
              <BitcoinConnectPayment
                amount={boostAmount}
                description={`Boost for ${currentTrack?.title || 'Unknown Song'} by ${currentTrack?.artist || currentAlbum || 'Unknown Artist'}`}
                onSuccess={handleBoostSuccess}
                onError={handleBoostError}
                className="w-full"
                recipients={getPaymentRecipients() || undefined}
                recipient={getFallbackRecipient().address}
                enableBoosts={true}
                boostMetadata={createBoostMetadata({
                  album: albumData || currentAlbum || undefined,
                  track: currentTrack,
                  senderName,
                  message: boostMessage,
                  timestamp: Math.floor(currentTime),
                  episode: currentTrack?.title,
                  url: currentAlbum ? `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/album/${encodeURIComponent(currentAlbum)}#${encodeURIComponent(currentTrack?.title || '')}` : (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000')
                })}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default NowPlayingScreen;