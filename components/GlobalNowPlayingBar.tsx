'use client';

import React from 'react';
import Image from 'next/image';
import { useAudio } from '@/contexts/AudioContext';
import { useSwipeGestures } from '@/hooks/useSwipeGestures';
import NowPlayingScreen from './NowPlayingScreen';

const GlobalNowPlayingBar: React.FC = () => {
  const {
    currentTrack,
    currentAlbum,
    isPlaying,
    currentTime,
    duration,
    volume,
    isShuffling,
    isRepeating,
    isVideo,
    isNowPlayingOpen,
    openNowPlaying,
    closeNowPlaying,
    isExternalPlayerFullscreen,
    pause,
    resume,
    nextTrack,
    previousTrack,
    seekTo,
    setVolume,
    toggleShuffle,
    toggleRepeat,
  } = useAudio();

  // Add swipe gestures for mobile
  const swipeRef = useSwipeGestures({
    onSwipeLeft: nextTrack,
    onSwipeRight: previousTrack,
    onSwipeUp: () => {
      // Swipe up to toggle shuffle
      toggleShuffle();
    },
    onSwipeDown: () => {
      // Swipe down to toggle repeat
      toggleRepeat();
    },
    threshold: 30,
    velocityThreshold: 0.2
  });

  // Don't render if no track or if external fullscreen player is open
  if (!currentTrack || isExternalPlayerFullscreen) return null;

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    seekTo(newTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
  };

  return (
    <>
      <NowPlayingScreen 
        isOpen={isNowPlayingOpen} 
        onClose={closeNowPlaying} 
      />
      
      <div 
        ref={swipeRef}
        className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-sm border-t border-white/10 p-4 z-50 touch-pan-y"
      >
      <div className="max-w-7xl mx-auto">
        {/* Mobile Layout */}
        <div className="block sm:hidden">
          {/* Main controls row */}
          <div className="flex items-center gap-3 mb-3">
            {/* Track Info - Clickable to open full screen */}
            <div 
              className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
              onClick={openNowPlaying}
            >
              {currentTrack.image ? (
                <div className="w-10 h-10 relative overflow-hidden rounded border border-white/20">
                  <Image
                    src={currentTrack.image}
                    alt={currentTrack.title}
                    fill
                    className="object-cover"
                    sizes="40px"
                  />
                  {isVideo && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                      </svg>
                    </div>
                  )}
                </div>
              ) : isVideo ? (
                <div className="w-10 h-10 relative overflow-hidden rounded border border-white/20 bg-gray-800 flex items-center justify-center">
                  <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                  </svg>
                </div>
              ) : null}
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-semibold text-white truncate flex items-center gap-1">
                  {isVideo && (
                    <svg className="w-3 h-3 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                    </svg>
                  )}
                  <span className="truncate">{currentTrack.title}</span>
                </h4>
                <p className="text-xs text-gray-400 truncate">
                  {currentTrack.artist || 'Unknown Artist'}
                </p>
              </div>
            </div>

            {/* Main controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={previousTrack}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                title="Previous track"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
                </svg>
              </button>

              <button
                onClick={isPlaying ? pause : resume}
                className="p-2 bg-white text-black rounded-full hover:bg-gray-200 transition-colors"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                  </svg>
                ) : (
                  <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                )}
              </button>

              <button
                onClick={nextTrack}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                title="Next track"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-400 w-8 text-right">
              {formatTime(currentTime)}
            </span>
            <div className="flex-1">
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(currentTime / (duration || 1)) * 100}%, #374151 ${(currentTime / (duration || 1)) * 100}%, #374151 100%)`
                }}
              />
            </div>
            <span className="text-xs text-gray-400 w-8">
              {formatTime(duration)}
            </span>
          </div>

          {/* Secondary controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={toggleShuffle}
                className={`p-1 transition-colors ${
                  isShuffling ? 'text-blue-400' : 'text-gray-400'
                }`}
                title="Toggle shuffle"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
                </svg>
              </button>

              <button
                onClick={toggleRepeat}
                className={`p-1 transition-colors ${
                  isRepeating ? 'text-blue-400' : 'text-gray-400'
                }`}
                title="Toggle repeat"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
                </svg>
              </button>
            </div>

            {/* Volume control */}
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
              </svg>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={handleVolumeChange}
                className="w-16 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${volume * 100}%, #374151 ${volume * 100}%, #374151 100%)`
                }}
              />
            </div>
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden sm:flex items-center gap-4">
          {/* Track Info - Clickable to open full screen */}
          <div
            className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
            onClick={openNowPlaying}
          >
            {currentTrack.image ? (
              <div className="w-12 h-12 relative overflow-hidden rounded border border-white/20">
                <Image
                  src={currentTrack.image}
                  alt={currentTrack.title}
                  fill
                  className="object-cover"
                  sizes="48px"
                />
                {isVideo && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                    </svg>
                  </div>
                )}
              </div>
            ) : isVideo ? (
              <div className="w-12 h-12 relative overflow-hidden rounded border border-white/20 bg-gray-800 flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                </svg>
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-semibold text-white truncate flex items-center gap-1">
                {isVideo && (
                  <svg className="w-3 h-3 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                  </svg>
                )}
                <span className="truncate">{currentTrack.title}</span>
              </h4>
              <p className="text-xs text-gray-400 truncate">
                {currentTrack.artist || 'Unknown Artist'}
                {currentAlbum && ` • ${currentAlbum}`}
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleShuffle}
              className={`p-2 transition-colors ${
                isShuffling ? 'text-blue-400' : 'text-gray-400 hover:text-white'
              }`}
              title="Toggle shuffle"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
              </svg>
            </button>

            <button
              onClick={previousTrack}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              title="Previous track"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
              </svg>
            </button>

            <button
              onClick={isPlaying ? pause : resume}
              className="p-3 bg-white text-black rounded-full hover:bg-gray-200 transition-colors"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>
              ) : (
                <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </button>

            <button
              onClick={nextTrack}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              title="Next track"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
              </svg>
            </button>

            <button
              onClick={toggleRepeat}
              className={`p-2 transition-colors ${
                isRepeating ? 'text-blue-400' : 'text-gray-400 hover:text-white'
              }`}
              title="Toggle repeat"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
              </svg>
            </button>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-xs text-gray-400 w-10 text-right">
              {formatTime(currentTime)}
            </span>
            <div className="flex-1 min-w-0">
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(currentTime / (duration || 1)) * 100}%, #374151 ${(currentTime / (duration || 1)) * 100}%, #374151 100%)`
                }}
              />
            </div>
            <span className="text-xs text-gray-400 w-10">
              {formatTime(duration)}
            </span>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            </svg>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
              className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
              style={{
                background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${volume * 100}%, #374151 ${volume * 100}%, #374151 100%)`
              }}
            />
          </div>
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 12px;
          width: 12px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 0 0 1px rgba(0,0,0,0.1);
        }
        .slider::-moz-range-thumb {
          height: 12px;
          width: 12px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 0 0 1px rgba(0,0,0,0.1);
        }
      `}</style>
      </div>
    </>
  );
};

export default GlobalNowPlayingBar;