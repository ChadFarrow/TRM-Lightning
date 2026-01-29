'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// Configuration
const EXPLOSION_THRESHOLD = 6; // Number of boosts before explosion
const STORAGE_KEY = 'boost_goat_count';
const MAX_SCALE = 1.8; // Maximum scale before explosion

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  scale: number;
  color: string;
  type: 'confetti' | 'star' | 'lightning';
}

export default function BoostGoat() {
  const [boostCount, setBoostCount] = useState(0);
  const [isExploding, setIsExploding] = useState(false);
  const [showExplosionOverlay, setShowExplosionOverlay] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [frozenParticles, setFrozenParticles] = useState<Particle[]>([]);
  const [isJiggling, setIsJiggling] = useState(false);
  const [showGoat, setShowGoat] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const explosionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load boost count from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const count = parseInt(stored, 10);
      if (!isNaN(count)) {
        setBoostCount(count);
      }
    }
  }, []);

  // Save boost count to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, boostCount.toString());
  }, [boostCount]);

  // Calculate goat scale based on boost count
  const goatScale = Math.min(1 + (boostCount / EXPLOSION_THRESHOLD) * (MAX_SCALE - 1), MAX_SCALE);

  // Generate fullscreen explosion particles - pre-positioned across screen
  const createExplosionParticles = useCallback(() => {
    const colors = ['#ff0000', '#ff4400', '#ff6600', '#ff2200', '#880000', '#ffaa00', '#ff0044', '#ff8800'];
    const newParticles: Particle[] = [];

    // Create particles spread across the entire viewport
    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;

    for (let i = 0; i < 150; i++) {
      // Random position across the entire screen
      newParticles.push({
        id: i,
        x: Math.random() * screenWidth,
        y: Math.random() * screenHeight,
        vx: 0,
        vy: 0,
        rotation: Math.random() * 360,
        scale: 2 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        type: ['confetti', 'star', 'lightning'][Math.floor(Math.random() * 3)] as 'confetti' | 'star' | 'lightning'
      });
    }

    return newParticles;
  }, []);

  // Animate particles - just the initial burst, then freeze
  const frameCountRef = useRef(0);
  const animateParticles = useCallback(() => {
    frameCountRef.current += 1;
    const frame = frameCountRef.current;

    // Only animate for 40 frames (~0.7 seconds) to spread particles
    if (frame >= 40) {
      // Freeze particles in place
      setParticles(prev => {
        setFrozenParticles(prev);
        return [];
      });
      return;
    }

    setParticles(prev => {
      const updated = prev.map(p => ({
        ...p,
        x: p.x + p.vx,
        y: p.y + p.vy,
        vx: p.vx * 0.92,
        vy: p.vy * 0.92,
        rotation: p.rotation + 3,
        scale: p.scale
      }));

      animationRef.current = requestAnimationFrame(animateParticles);
      return updated;
    });
  }, []);

  // Handle explosion
  const triggerExplosion = useCallback(() => {
    // Clear any existing timeout
    if (explosionTimeoutRef.current) {
      clearTimeout(explosionTimeoutRef.current);
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    // Create particles and show them immediately (no animation needed)
    const explosionParticles = createExplosionParticles();
    setFrozenParticles(explosionParticles);
    setShowExplosionOverlay(true);
    setShowGoat(false);
    setIsExploding(true);

    // Keep explosion on screen for 3.33 seconds
    explosionTimeoutRef.current = setTimeout(() => {
      setShowExplosionOverlay(false);
      setFrozenParticles([]);
      setIsExploding(false);
      setShowGoat(true);
      setBoostCount(0);
    }, 3330);
  }, [createExplosionParticles]);

  // Listen for boost events
  useEffect(() => {
    const handleBoost = () => {
      // Ignore boosts while exploding
      if (isExploding || showExplosionOverlay) return;

      setBoostCount(prev => {
        const newCount = prev + 1;
        if (newCount >= EXPLOSION_THRESHOLD) {
          // Trigger explosion immediately - no jiggle, just explode
          triggerExplosion();
          return 0;
        }
        // Only jiggle if not exploding
        setIsJiggling(true);
        setTimeout(() => setIsJiggling(false), 300);
        return newCount;
      });
    };

    window.addEventListener('newBoost', handleBoost);

    return () => {
      window.removeEventListener('newBoost', handleBoost);
    };
  }, [triggerExplosion, isExploding, showExplosionOverlay]);

  // Render hellfire particle based on type - BIGGER particles
  const renderParticle = (particle: Particle) => {
    switch (particle.type) {
      case 'star':
        // Skull - bigger
        return (
          <svg width="40" height="40" viewBox="0 0 24 24" fill={particle.color}>
            <path d="M12 2C6.48 2 2 6.48 2 12c0 3.31 1.61 6.24 4.09 8.06V22h2v-1h2v1h2v-1h2v1h2v-1.94C18.39 18.24 20 15.31 20 12c0-5.52-4.48-10-10-10zm-3 12c-.83 0-1.5-.67-1.5-1.5S8.17 11 9 11s1.5.67 1.5 1.5S9.83 14 9 14zm6 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
          </svg>
        );
      case 'lightning':
        // Flame - bigger
        return (
          <svg width="35" height="35" viewBox="0 0 24 24" fill={particle.color}>
            <path d="M12 2c-4 4-6 7-6 11 0 3.31 2.69 6 6 6s6-2.69 6-6c0-4-2-7-6-11zm0 15c-1.66 0-3-1.34-3-3 0-1.56.75-2.84 2-3.67V7c0-.55.45-1 1-1s1 .45 1 1v3.33c1.25.83 2 2.11 2 3.67 0 1.66-1.34 3-3 3z" />
          </svg>
        );
      default:
        // Ember - bigger
        return (
          <div
            style={{
              width: 30,
              height: 40,
              background: `radial-gradient(ellipse at center, ${particle.color} 0%, ${particle.color}88 50%, transparent 80%)`,
              borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%'
            }}
          />
        );
    }
  };

  // Test boost function for development
  const testBoost = () => {
    window.dispatchEvent(new Event('newBoost'));
  };

  return (
    <>
      {/* Fullscreen explosion overlay - stays for 5 seconds */}
      {showExplosionOverlay && (
        <div className="fixed inset-0 z-[100] pointer-events-none">
          {/* Dark red overlay */}
          <div className="absolute inset-0 bg-red-900/70" />

          {/* Particles spread across screen */}
          {frozenParticles.map(particle => (
            <div
              key={particle.id}
              className="absolute"
              style={{
                left: particle.x,
                top: particle.y,
                transform: `rotate(${particle.rotation}deg) scale(${particle.scale})`,
              }}
            >
              {renderParticle(particle)}
            </div>
          ))}
        </div>
      )}

      <div
        ref={containerRef}
        className="fixed left-8 top-1/2 -translate-y-1/2 z-40"
        style={{ width: 150, height: 150 }}
      >

      {/* Goat */}
      {showGoat && (
        <div
          className={`absolute inset-0 flex items-center justify-center transition-transform duration-200 ${
            isJiggling ? 'animate-jiggle' : ''
          }`}
          style={{
            '--goat-scale': goatScale,
            transform: `scale(${goatScale})`,
            transformOrigin: 'bottom center'
          } as React.CSSProperties}
        >
          {/* SVG Scary Goat */}
          <svg
            width="100"
            height="100"
            viewBox="0 0 100 100"
            className="drop-shadow-lg"
            style={{ filter: 'drop-shadow(0 0 8px rgba(255, 0, 0, 0.5))' }}
          >
            {/* Defs for glow effects */}
            <defs>
              <radialGradient id="eyeGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ff0000" />
                <stop offset="100%" stopColor="#8B0000" />
              </radialGradient>
              <filter id="hellfire">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Body - dark and menacing */}
            <ellipse
              cx="50"
              cy="60"
              rx={20 + (boostCount / EXPLOSION_THRESHOLD) * 15}
              ry={18 + (boostCount / EXPLOSION_THRESHOLD) * 8}
              fill="#1a1a1a"
              stroke="#440000"
              strokeWidth="2"
            />

            {/* Head - dark */}
            <ellipse cx="75" cy="40" rx="12" ry="10" fill="#1a1a1a" stroke="#440000" strokeWidth="2" />

            {/* Face details - shadowy */}
            <ellipse cx="72" cy="42" rx="8" ry="6" fill="#2a2a2a" />

            {/* Glowing red eyes */}
            <ellipse cx="78" cy="38" rx="3" ry="2" fill="url(#eyeGlow)" />
            <ellipse cx="78" cy="38" rx="1.5" ry="1" fill="#ff0000" style={{ filter: 'blur(1px)' }} />
            <circle cx="78" cy="38" r="0.8" fill="#ffff00" />

            {/* Second eye (more visible) */}
            <ellipse cx="70" cy="39" rx="2.5" ry="1.8" fill="url(#eyeGlow)" />
            <circle cx="70" cy="39" r="0.6" fill="#ffff00" />

            {/* Angry eyebrows */}
            <path d="M 66 36 L 72 38" stroke="#440000" strokeWidth="2" strokeLinecap="round" />
            <path d="M 82 36 L 76 38" stroke="#440000" strokeWidth="2" strokeLinecap="round" />

            {/* Snorting nose with smoke */}
            <ellipse cx="82" cy="44" rx="2" ry="1.5" fill="#330000" />
            <path d="M 84 42 Q 88 38 86 34" stroke="#666" strokeWidth="1" fill="none" opacity="0.6" />
            <path d="M 85 43 Q 90 40 87 36" stroke="#666" strokeWidth="1" fill="none" opacity="0.4" />

            {/* Fanged mouth */}
            <path d="M 76 47 Q 80 52 84 47" stroke="#440000" strokeWidth="1.5" fill="none" />
            {/* Fangs */}
            <path d="M 77 47 L 76 51" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M 83 47 L 84 51" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />

            {/* Pointed demon ears */}
            <path d="M 65 32 L 60 22 L 68 30" fill="#1a1a1a" stroke="#440000" strokeWidth="1" />
            <path d="M 82 30 L 88 20 L 83 28" fill="#1a1a1a" stroke="#440000" strokeWidth="1" />

            {/* Twisted demon horns */}
            <path d="M 62 28 Q 52 18 48 8 Q 50 12 55 10" stroke="#2a0000" strokeWidth="4" fill="none" strokeLinecap="round" />
            <path d="M 85 26 Q 92 14 96 4 Q 94 10 90 8" stroke="#2a0000" strokeWidth="4" fill="none" strokeLinecap="round" />
            {/* Horn tips glow */}
            <circle cx="48" cy="8" r="3" fill="#ff4400" opacity="0.6" />
            <circle cx="96" cy="4" r="3" fill="#ff4400" opacity="0.6" />

            {/* Scraggly evil beard */}
            <path d="M 76 50 Q 74 60 70 66" stroke="#333" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 78 50 Q 80 62 78 68" stroke="#333" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 80 50 Q 84 58 86 64" stroke="#333" strokeWidth="2" fill="none" strokeLinecap="round" />

            {/* Dark legs */}
            <rect x="35" y="72" width="5" height="18" rx="2" fill="#1a1a1a" stroke="#440000" strokeWidth="1" />
            <rect x="45" y="72" width="5" height="18" rx="2" fill="#1a1a1a" stroke="#440000" strokeWidth="1" />
            <rect x="55" y="72" width="5" height="18" rx="2" fill="#1a1a1a" stroke="#440000" strokeWidth="1" />
            <rect x="65" y="72" width="5" height="18" rx="2" fill="#1a1a1a" stroke="#440000" strokeWidth="1" />

            {/* Cloven hooves with flames */}
            <path d="M 34 88 L 36 92 L 38 88 L 40 92 L 41 88" fill="#2a0000" />
            <path d="M 44 88 L 46 92 L 48 88 L 50 92 L 51 88" fill="#2a0000" />
            <path d="M 54 88 L 56 92 L 58 88 L 60 92 L 61 88" fill="#2a0000" />
            <path d="M 64 88 L 66 92 L 68 88 L 70 92 L 71 88" fill="#2a0000" />

            {/* Forked tail */}
            <path d="M 28 55 Q 15 50 10 55 L 6 50 M 10 55 L 6 60" stroke="#1a1a1a" strokeWidth="3" fill="none" strokeLinecap="round" />

            {/* Hellfire belly glow when getting fat */}
            {boostCount > 2 && (
              <ellipse
                cx="50"
                cy="65"
                rx={10 + (boostCount / EXPLOSION_THRESHOLD) * 5}
                ry={8 + (boostCount / EXPLOSION_THRESHOLD) * 3}
                fill="#ff2200"
                opacity={0.2 + (boostCount / EXPLOSION_THRESHOLD) * 0.4}
              />
            )}

            {/* Flames coming off when about to explode */}
            {boostCount >= EXPLOSION_THRESHOLD - 2 && (
              <>
                <path d="M 45 50 Q 42 40 48 35 Q 44 42 50 45" fill="#ff4400" opacity="0.8" />
                <path d="M 55 48 Q 58 38 52 32 Q 56 40 50 44" fill="#ff6600" opacity="0.7" />
                <path d="M 60 52 Q 65 44 58 38 Q 62 46 56 50" fill="#ff2200" opacity="0.6" />
              </>
            )}

            {/* Pentagram symbol on forehead when maxed */}
            {boostCount >= EXPLOSION_THRESHOLD - 1 && (
              <path
                d="M 74 34 L 76 38 L 72 36 L 76 36 L 72 38 Z"
                stroke="#ff0000"
                strokeWidth="0.5"
                fill="none"
                opacity="0.8"
              />
            )}
          </svg>

          {/* Boost counter badge */}
          {boostCount > 0 && (
            <div className="absolute -top-1 -right-1 bg-yellow-500 text-black text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-lg">
              {boostCount}
            </div>
          )}
        </div>
      )}

      {/* Hellfire explosion flash */}
      {isExploding && (
        <div className="absolute inset-0 bg-red-600 rounded-full animate-ping opacity-70" style={{ boxShadow: '0 0 40px 20px rgba(255, 0, 0, 0.5)' }} />
      )}

      {/* Test boost button */}
      <button
        onClick={testBoost}
        className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded shadow-lg pointer-events-auto"
      >
        Boost!
      </button>

{/* Jiggle animation - using CSS custom properties */}
      <style>{`
        @keyframes jiggle {
          0%, 100% { transform: scale(var(--goat-scale)) rotate(0deg); }
          25% { transform: scale(calc(var(--goat-scale) * 1.1)) rotate(-5deg); }
          50% { transform: scale(calc(var(--goat-scale) * 1.15)) rotate(0deg); }
          75% { transform: scale(calc(var(--goat-scale) * 1.1)) rotate(5deg); }
        }

        .animate-jiggle {
          animation: jiggle 0.3s ease-in-out;
        }
      `}</style>
    </div>
    </>
  );
}
