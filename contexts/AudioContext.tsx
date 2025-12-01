'use client';

import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { toast } from '@/components/Toast';
import { getSiteName } from '@/lib/site-config';

interface Track {
  title: string;
  duration: string;
  url: string;
  trackNumber: number;
  image?: string;
  artist?: string;
  album?: string;
  mediaType?: 'audio' | 'video'; // Type of media (default: audio)
  mimeType?: string; // MIME type from RSS enclosure
  value?: {
    type: string;
    method: string;
    suggested?: string;
    recipients: Array<{
      type: string;
      address: string;
      split: number;
      name?: string;
      fee?: boolean;
      customKey?: string;
      customValue?: string;
    }>;
  };
  // Podcast GUIDs for Nostr boost tagging
  guid?: string;
  podcastGuid?: string; // podcast:guid at item level
  feedGuid?: string;
  feedUrl?: string;
  publisherGuid?: string;
  publisherUrl?: string;
  imageUrl?: string;
}

interface AudioContextType {
  // Current track info
  currentTrack: Track | null;
  currentAlbum: string | null;

  // Playback state
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isVideo: boolean; // Whether current track is video

  // Video ref for rendering
  videoRef: React.RefObject<HTMLVideoElement>;

  // Playlist
  playlist: Track[];
  currentTrackIndex: number;
  isShuffling: boolean;
  isRepeating: boolean;

  // Now Playing Screen
  isNowPlayingOpen: boolean;
  openNowPlaying: () => void;
  closeNowPlaying: () => void;

  // Actions
  playTrack: (track: Track, album?: string) => void;
  playAlbum: (tracks: Track[], startIndex?: number, album?: string) => void;
  playAlbumAndOpenNowPlaying: (tracks: Track[], startIndex?: number, album?: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  nextTrack: () => void;
  previousTrack: () => void;
  seekTo: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  // Video time sync (called from NowPlayingScreen)
  setVideoTime: (time: number) => void;
  setVideoDuration: (duration: number) => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null!);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [currentAlbum, setCurrentAlbum] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isShuffling, setIsShuffling] = useState(false);
  const [isRepeating, setIsRepeating] = useState(false);
  const [isNowPlayingOpen, setIsNowPlayingOpen] = useState(false);

  // Determine if current track is video
  const isVideo = currentTrack?.mediaType === 'video';

  // Get the active media element (audio or video)
  const getActiveMedia = useCallback((): HTMLAudioElement | HTMLVideoElement | null => {
    return isVideo ? videoRef.current : audioRef.current;
  }, [isVideo]);

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio();
    const audio = audioRef.current;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration);
    const handleLoadStart = () => setCurrentTime(0);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('loadstart', handleLoadStart);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('loadstart', handleLoadStart);
    };
  }, []);

  const playTrack = (track: Track, album?: string) => {
    const trackIsVideo = track.mediaType === 'video';

    setCurrentTrack(track);
    setCurrentAlbum(album || null);
    setPlaylist([track]);
    setCurrentTrackIndex(0);

    if (trackIsVideo) {
      // For video, pause audio and let the video element handle playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      // Video playback is handled by the video element in NowPlayingScreen
      // It will start playing when src is set via useEffect
      setIsPlaying(true);
    } else {
      // For audio, use the audio element
      if (!audioRef.current) return;

      // Pause any video that might be playing
      if (videoRef.current) {
        videoRef.current.pause();
      }

      audioRef.current.src = track.url;
      audioRef.current.load();
      audioRef.current.play().catch(error => {
        if (error.name === 'AbortError' || error.message.includes('aborted')) {
          console.log('Audio loading was cancelled (expected behavior)');
        } else {
          console.warn('Audio playback error:', error);
        }
      });
      setIsPlaying(true);
    }

    // Update Media Session API
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist || 'Unknown Artist',
        album: album || undefined,
        artwork: track.image ? [
          { src: track.image, sizes: '512x512', type: 'image/png' }
        ] : []
      });
    }
  };

  const playAlbum = (tracks: Track[], startIndex = 0, album?: string) => {
    if (tracks.length === 0) return;

    const track = tracks[startIndex];
    const trackIsVideo = track.mediaType === 'video';

    setCurrentTrack(track);
    setCurrentAlbum(album || null);
    setPlaylist(tracks);
    setCurrentTrackIndex(startIndex);

    if (trackIsVideo) {
      // For video, pause audio and let the video element handle playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      setIsPlaying(true);
    } else {
      // For audio
      if (!audioRef.current) return;

      if (videoRef.current) {
        videoRef.current.pause();
      }

      audioRef.current.src = track.url;
      audioRef.current.load();
      audioRef.current.play().catch(error => {
        if (error.name === 'AbortError' || error.message.includes('aborted')) {
          console.log('Audio loading was cancelled (expected behavior)');
        } else {
          console.warn('Audio playback error:', error);
        }
      });
      setIsPlaying(true);
    }

    // Update Media Session API
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist || 'Unknown Artist',
        album: album || undefined,
        artwork: track.image ? [
          { src: track.image, sizes: '512x512', type: 'image/png' }
        ] : []
      });
    }
  };

  const playAlbumAndOpenNowPlaying = (tracks: Track[], startIndex = 0, album?: string) => {
    playAlbum(tracks, startIndex, album);
    setIsNowPlayingOpen(true);
  };

  const openNowPlaying = () => {
    setIsNowPlayingOpen(true);
  };

  const closeNowPlaying = () => {
    setIsNowPlayingOpen(false);
  };

  const pause = useCallback(() => {
    const media = getActiveMedia();
    if (media) {
      media.pause();
      setIsPlaying(false);
    }
  }, [getActiveMedia]);

  const resume = useCallback(() => {
    const media = getActiveMedia();
    if (media) {
      media.play().catch(error => {
        if (error.name === 'AbortError' || error.message.includes('aborted')) {
          console.log('Media loading was cancelled (expected behavior)');
        } else {
          console.warn('Media playback error:', error);
        }
      });
      setIsPlaying(true);
    }
  }, [getActiveMedia]);

  const stop = useCallback(() => {
    const media = getActiveMedia();
    if (media) {
      media.pause();
      media.currentTime = 0;
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, [getActiveMedia]);

  const nextTrack = useCallback(() => {
    if (playlist.length === 0) return;

    let nextIndex: number;

    if (isShuffling && playlist.length > 1) {
      // Get random track that's not the current one
      do {
        nextIndex = Math.floor(Math.random() * playlist.length);
      } while (nextIndex === currentTrackIndex);
    } else {
      nextIndex = currentTrackIndex + 1;
      if (nextIndex >= playlist.length) {
        nextIndex = 0; // Loop back to start
      }
    }

    const track = playlist[nextIndex];
    const trackIsVideo = track.mediaType === 'video';

    setCurrentTrack(track);
    setCurrentTrackIndex(nextIndex);

    if (trackIsVideo) {
      // Stop audio, video element will handle playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      // Video src is set by NowPlayingScreen when currentTrack changes
    } else {
      // Stop video if playing
      if (videoRef.current) {
        videoRef.current.pause();
      }

      if (audioRef.current) {
        audioRef.current.src = track.url;
        audioRef.current.load();
        if (isPlaying) {
          audioRef.current.play().catch(error => {
            if (error.name === 'AbortError' || error.message.includes('aborted')) {
              console.log('Audio loading was cancelled (expected behavior)');
            } else {
              console.warn('Audio playback error:', error);
            }
          });
        }
      }
    }

    // Update Media Session API
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist || 'Unknown Artist',
        album: track.album || currentAlbum || undefined,
        artwork: track.image ? [
          { src: track.image, sizes: '512x512', type: 'image/png' }
        ] : []
      });
    }
  }, [playlist, currentTrackIndex, isShuffling, isPlaying, currentAlbum]);

  const previousTrack = useCallback(() => {
    if (playlist.length === 0) return;

    let prevIndex = currentTrackIndex - 1;
    if (prevIndex < 0) {
      prevIndex = playlist.length - 1; // Loop to end
    }

    const track = playlist[prevIndex];
    const trackIsVideo = track.mediaType === 'video';

    setCurrentTrack(track);
    setCurrentTrackIndex(prevIndex);

    if (trackIsVideo) {
      // Stop audio, video element will handle playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    } else {
      // Stop video if playing
      if (videoRef.current) {
        videoRef.current.pause();
      }

      if (audioRef.current) {
        audioRef.current.src = track.url;
        audioRef.current.load();
        if (isPlaying) {
          audioRef.current.play().catch(error => {
            if (error.name === 'AbortError' || error.message.includes('aborted')) {
              console.log('Audio loading was cancelled (expected behavior)');
            } else {
              console.warn('Audio playback error:', error);
            }
          });
        }
      }
    }

    // Update Media Session API
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist || 'Unknown Artist',
        album: track.album || currentAlbum || undefined,
        artwork: track.image ? [
          { src: track.image, sizes: '512x512', type: 'image/png' }
        ] : []
      });
    }
  }, [playlist, currentTrackIndex, isPlaying, currentAlbum]);
  // Handle track ended event - needs to be after nextTrack is declared
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      if (isRepeating) {
        audio.currentTime = 0;
        audio.play();
      } else {
        nextTrack();
      }
    };

    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('ended', handleEnded);
    };
  }, [isRepeating, nextTrack]);

  // Handle video element events for time sync and track end
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => setDuration(video.duration);
    const handleLoadStart = () => setCurrentTime(0);
    const handleEnded = () => {
      if (isRepeating) {
        video.currentTime = 0;
        video.play();
      } else {
        nextTrack();
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('ended', handleEnded);
    };
  }, [isRepeating, nextTrack]);

  const seekTo = useCallback((time: number) => {
    const media = getActiveMedia();
    if (media) {
      media.currentTime = time;
      setCurrentTime(time);
    }
  }, [getActiveMedia]);

  const setVolume = useCallback((newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolumeState(clampedVolume);
    const media = getActiveMedia();
    if (media) {
      media.volume = clampedVolume;
    }
  }, [getActiveMedia]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const newMuted = !prev;
      const media = getActiveMedia();
      if (media) {
        media.muted = newMuted;
      }
      return newMuted;
    });
  }, [getActiveMedia]);

  const toggleShuffle = () => {
    setIsShuffling(!isShuffling);
  };

  const toggleRepeat = () => {
    setIsRepeating(!isRepeating);
  };

  // Video time sync functions (called from NowPlayingScreen where video element exists)
  const setVideoTime = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const setVideoDuration = useCallback((newDuration: number) => {
    if (!isNaN(newDuration) && isFinite(newDuration)) {
      setDuration(newDuration);
    }
  }, []);

  // Media Session API handlers - after all functions are declared
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => resume());
      navigator.mediaSession.setActionHandler('pause', () => pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => previousTrack());
      navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
          seekTo(details.seekTime);
        }
      });
    }
  }, [resume, pause, previousTrack, nextTrack, seekTo]);

  const value: AudioContextType = {
    currentTrack,
    currentAlbum,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isVideo,
    videoRef,
    playlist,
    currentTrackIndex,
    isShuffling,
    isRepeating,
    isNowPlayingOpen,
    openNowPlaying,
    closeNowPlaying,
    playTrack,
    playAlbum,
    playAlbumAndOpenNowPlaying,
    pause,
    resume,
    stop,
    nextTrack,
    previousTrack,
    seekTo,
    setVolume,
    toggleMute,
    toggleShuffle,
    toggleRepeat,
    setVideoTime,
    setVideoDuration,
  };

  return (
    <AudioContext.Provider value={value}>
      {children}
    </AudioContext.Provider>
  );
};