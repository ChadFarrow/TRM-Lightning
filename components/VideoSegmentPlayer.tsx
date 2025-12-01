'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Volume2, VolumeX, Maximize, RotateCcw } from 'lucide-react';

interface Chapter {
  startTime: number;
  title: string;
  img?: string;
  url?: string;
  endTime?: number;
}

interface VideoSegmentPlayerProps {
  videoUrl: string;
  chaptersUrl?: string;
  bandName: string;
  title: string;
  coverArt: string;
  onClose?: () => void;
}

/**
 * VideoSegmentPlayer - Plays a segment of an HLS video based on chapter data
 * Fetches chapters from chaptersUrl and finds the chapter matching bandName
 */
export default function VideoSegmentPlayer({
  videoUrl,
  chaptersUrl,
  bandName,
  title,
  coverArt,
  onClose,
}: VideoSegmentPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [bandChapter, setBandChapter] = useState<Chapter | null>(null);
  const [hasStarted, setHasStarted] = useState(false);

  // Fetch chapters from URL
  useEffect(() => {
    if (!chaptersUrl) {
      setError('No chapters URL provided');
      setIsLoading(false);
      return;
    }

    const fetchChapters = async () => {
      try {
        // Use proxy to avoid CORS issues
        const proxyUrl = `/api/proxy-chapters?url=${encodeURIComponent(chaptersUrl)}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch chapters: ${response.status}`);
        }
        const data = await response.json();

        // Parse chapters (Podcasting 2.0 JSON Chapters format)
        const parsedChapters: Chapter[] = data.chapters || [];
        setChapters(parsedChapters);

        // Find chapter matching band name (case-insensitive, partial match)
        const bandLower = bandName.toLowerCase();
        const matchingChapter = parsedChapters.find(ch =>
          ch.title.toLowerCase().includes(bandLower) ||
          bandLower.includes(ch.title.toLowerCase())
        );

        if (matchingChapter) {
          // Calculate end time from next chapter or use duration
          const chapterIndex = parsedChapters.indexOf(matchingChapter);
          const nextChapter = parsedChapters[chapterIndex + 1];
          setBandChapter({
            ...matchingChapter,
            endTime: nextChapter ? nextChapter.startTime : undefined,
          });
        } else {
          setError(`No chapter found for "${bandName}"`);
        }
      } catch (err) {
        console.error('Error fetching chapters:', err);
        setError(err instanceof Error ? err.message : 'Failed to load chapters');
      }
    };

    fetchChapters();
  }, [chaptersUrl, bandName]);

  // Initialize HLS.js
  useEffect(() => {
    if (!bandChapter || !videoRef.current) return;

    const video = videoRef.current;

    const initHls = () => {
      if (Hls.isSupported()) {
        const hls = new Hls({
          startPosition: bandChapter.startTime,
        });
        hlsRef.current = hls;

        hls.loadSource(videoUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLoading(false);
          // Seek to start time
          video.currentTime = bandChapter.startTime;
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            console.error('HLS fatal error:', data);
            setError('Failed to load video');
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        video.src = videoUrl;
        video.addEventListener('loadedmetadata', () => {
          video.currentTime = bandChapter.startTime;
          setIsLoading(false);
        });
      } else {
        setError('HLS not supported');
      }
    };

    initHls();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [bandChapter, videoUrl]);

  // Handle time updates - stop at end time
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !bandChapter) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);

      // Stop at end time if defined
      if (bandChapter.endTime && video.currentTime >= bandChapter.endTime) {
        video.pause();
        setIsPlaying(false);
      }
    };

    const handleDurationChange = () => {
      setDuration(video.duration);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [bandChapter]);

  const togglePlay = useCallback(() => {
    if (!videoRef.current || !bandChapter) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      // If at end, restart from beginning of segment
      if (bandChapter.endTime && videoRef.current.currentTime >= bandChapter.endTime) {
        videoRef.current.currentTime = bandChapter.startTime;
      }
      videoRef.current.play();
      setHasStarted(true);
    }
  }, [isPlaying, bandChapter]);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  const restartSegment = useCallback(() => {
    if (!videoRef.current || !bandChapter) return;
    videoRef.current.currentTime = bandChapter.startTime;
    videoRef.current.play();
    setHasStarted(true);
  }, [bandChapter]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen();
    }
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current || !bandChapter) return;
    const newTime = parseFloat(e.target.value);
    // Clamp to segment bounds
    const clampedTime = Math.max(
      bandChapter.startTime,
      Math.min(newTime, bandChapter.endTime || duration)
    );
    videoRef.current.currentTime = clampedTime;
  }, [bandChapter, duration]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate segment-relative time for progress bar
  const segmentStart = bandChapter?.startTime || 0;
  const segmentEnd = bandChapter?.endTime || duration;
  const segmentDuration = segmentEnd - segmentStart;
  const segmentProgress = currentTime - segmentStart;

  if (error) {
    return (
      <div className="bg-black/40 backdrop-blur-md rounded-xl border border-white/20 p-6 text-center">
        <div className="text-red-400 mb-2">{error}</div>
        <p className="text-gray-400 text-sm">Unable to load video segment for {bandName}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="bg-black/90 backdrop-blur-md rounded-xl border border-white/30 overflow-hidden shadow-2xl"
    >
      {/* Video Container */}
      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          className="w-full h-full"
          playsInline
          onClick={togglePlay}
        />

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        )}

        {/* Play Button Overlay (before first play) */}
        {!hasStarted && !isLoading && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer"
            onClick={togglePlay}
          >
            <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-colors">
              <Play className="w-10 h-10 text-white ml-1" />
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 space-y-3 bg-black/95">
        {/* Title */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg text-white drop-shadow-sm">{bandName}</h3>
            <p className="text-sm text-gray-300">{title}</p>
          </div>
          {bandChapter && (
            <div className="text-sm text-gray-300 bg-white/10 px-3 py-1 rounded-full">
              Chapter: {bandChapter.title}
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-white font-mono w-12 text-right">
            {formatTime(segmentProgress)}
          </span>
          <input
            type="range"
            min={segmentStart}
            max={segmentEnd}
            value={currentTime}
            onChange={handleSeek}
            className="flex-1 h-2 bg-white/30 rounded-full appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-4
              [&::-webkit-slider-thumb]:h-4
              [&::-webkit-slider-thumb]:bg-white
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:cursor-pointer
              [&::-webkit-slider-thumb]:shadow-lg"
          />
          <span className="text-xs text-white font-mono w-12">
            {formatTime(segmentDuration)}
          </span>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={restartSegment}
            className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            title="Restart segment"
          >
            <RotateCcw className="w-5 h-5 text-white" />
          </button>

          <button
            onClick={togglePlay}
            className="p-4 bg-white/30 hover:bg-white/40 rounded-full transition-colors shadow-lg"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-7 h-7 text-white" />
            ) : (
              <Play className="w-7 h-7 text-white ml-0.5" />
            )}
          </button>

          <button
            onClick={toggleMute}
            className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? (
              <VolumeX className="w-5 h-5 text-white" />
            ) : (
              <Volume2 className="w-5 h-5 text-white" />
            )}
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            title="Fullscreen"
          >
            <Maximize className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
