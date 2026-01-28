'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// Configuration
const EXPLOSION_THRESHOLD = 10; // Number of boosts before explosion
const STORAGE_KEY = 'boost_goat_count';
const MAX_SCALE = 2.5; // Maximum scale before explosion

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
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isJiggling, setIsJiggling] = useState(false);
  const [showGoat, setShowGoat] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);

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

  // Generate explosion particles
  const createExplosionParticles = useCallback(() => {
    const colors = ['#FFD700', '#FFA500', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
    const newParticles: Particle[] = [];

    for (let i = 0; i < 50; i++) {
      const angle = (Math.PI * 2 * i) / 50 + Math.random() * 0.5;
      const speed = 3 + Math.random() * 6;
      newParticles.push({
        id: i,
        x: 0,
        y: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2, // Initial upward bias
        rotation: Math.random() * 360,
        scale: 0.5 + Math.random() * 0.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        type: ['confetti', 'star', 'lightning'][Math.floor(Math.random() * 3)] as 'confetti' | 'star' | 'lightning'
      });
    }

    return newParticles;
  }, []);

  // Animate particles
  const animateParticles = useCallback(() => {
    setParticles(prev => {
      const updated = prev.map(p => ({
        ...p,
        x: p.x + p.vx,
        y: p.y + p.vy,
        vy: p.vy + 0.15, // Gravity
        rotation: p.rotation + 5,
        scale: p.scale * 0.98
      })).filter(p => p.scale > 0.1 && Math.abs(p.y) < 300);

      if (updated.length > 0) {
        animationRef.current = requestAnimationFrame(animateParticles);
      } else {
        // Reset after explosion
        setIsExploding(false);
        setShowGoat(true);
        setBoostCount(0);
      }

      return updated;
    });
  }, []);

  // Handle explosion
  const triggerExplosion = useCallback(() => {
    setIsExploding(true);
    setShowGoat(false);
    setParticles(createExplosionParticles());
    animationRef.current = requestAnimationFrame(animateParticles);
  }, [createExplosionParticles, animateParticles]);

  // Listen for boost events
  useEffect(() => {
    const handleBoost = () => {
      // Jiggle animation
      setIsJiggling(true);
      setTimeout(() => setIsJiggling(false), 300);

      setBoostCount(prev => {
        const newCount = prev + 1;
        if (newCount >= EXPLOSION_THRESHOLD) {
          setTimeout(triggerExplosion, 500); // Delay explosion for dramatic effect
        }
        return newCount;
      });
    };

    window.addEventListener('newBoost', handleBoost);

    return () => {
      window.removeEventListener('newBoost', handleBoost);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [triggerExplosion]);

  // Render particle based on type
  const renderParticle = (particle: Particle) => {
    switch (particle.type) {
      case 'star':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill={particle.color}>
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        );
      case 'lightning':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill={particle.color}>
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        );
      default:
        return (
          <div
            style={{
              width: 12,
              height: 12,
              backgroundColor: particle.color,
              borderRadius: Math.random() > 0.5 ? '50%' : '2px'
            }}
          />
        );
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed bottom-24 right-4 z-40 pointer-events-none"
      style={{ width: 100, height: 100 }}
    >
      {/* Particles */}
      {particles.map(particle => (
        <div
          key={particle.id}
          className="absolute"
          style={{
            left: '50%',
            top: '50%',
            transform: `translate(${particle.x}px, ${particle.y}px) rotate(${particle.rotation}deg) scale(${particle.scale})`,
            opacity: particle.scale
          }}
        >
          {renderParticle(particle)}
        </div>
      ))}

      {/* Goat */}
      {showGoat && (
        <div
          className={`absolute inset-0 flex items-center justify-center transition-transform duration-200 ${
            isJiggling ? 'animate-jiggle' : ''
          }`}
          style={{
            transform: `scale(${goatScale})`,
            transformOrigin: 'bottom center'
          }}
        >
          {/* SVG Goat */}
          <svg
            width="60"
            height="60"
            viewBox="0 0 100 100"
            className="drop-shadow-lg"
          >
            {/* Body - gets wider with more boosts */}
            <ellipse
              cx="50"
              cy="60"
              rx={20 + (boostCount / EXPLOSION_THRESHOLD) * 15}
              ry={18 + (boostCount / EXPLOSION_THRESHOLD) * 8}
              fill="#E8DCC8"
              stroke="#8B7355"
              strokeWidth="2"
            />

            {/* Head */}
            <ellipse cx="75" cy="40" rx="12" ry="10" fill="#E8DCC8" stroke="#8B7355" strokeWidth="2" />

            {/* Face details */}
            <ellipse cx="72" cy="42" rx="8" ry="6" fill="#F5EFE0" />

            {/* Eyes */}
            <ellipse cx="78" cy="38" rx="2" ry="2.5" fill="#333" />
            <circle cx="78.5" cy="37.5" r="0.8" fill="#fff" />

            {/* Nose */}
            <ellipse cx="82" cy="44" rx="1.5" ry="1" fill="#8B7355" />

            {/* Mouth - smile */}
            <path d="M 79 46 Q 81 48 83 46" stroke="#8B7355" strokeWidth="1" fill="none" />

            {/* Ears */}
            <ellipse cx="68" cy="32" rx="4" ry="2" fill="#E8DCC8" stroke="#8B7355" strokeWidth="1" transform="rotate(-30 68 32)" />
            <ellipse cx="80" cy="30" rx="4" ry="2" fill="#E8DCC8" stroke="#8B7355" strokeWidth="1" transform="rotate(30 80 30)" />

            {/* Horns */}
            <path d="M 66 30 Q 60 20 65 15" stroke="#8B7355" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M 80 28 Q 85 18 82 12" stroke="#8B7355" strokeWidth="3" fill="none" strokeLinecap="round" />

            {/* Beard */}
            <path d="M 78 50 Q 80 58 76 62" stroke="#D4C8B8" strokeWidth="3" fill="none" strokeLinecap="round" />

            {/* Legs */}
            <rect x="35" y="72" width="5" height="18" rx="2" fill="#E8DCC8" stroke="#8B7355" strokeWidth="1" />
            <rect x="45" y="72" width="5" height="18" rx="2" fill="#E8DCC8" stroke="#8B7355" strokeWidth="1" />
            <rect x="55" y="72" width="5" height="18" rx="2" fill="#E8DCC8" stroke="#8B7355" strokeWidth="1" />
            <rect x="65" y="72" width="5" height="18" rx="2" fill="#E8DCC8" stroke="#8B7355" strokeWidth="1" />

            {/* Hooves */}
            <rect x="34" y="88" width="7" height="4" rx="1" fill="#5C4033" />
            <rect x="44" y="88" width="7" height="4" rx="1" fill="#5C4033" />
            <rect x="54" y="88" width="7" height="4" rx="1" fill="#5C4033" />
            <rect x="64" y="88" width="7" height="4" rx="1" fill="#5C4033" />

            {/* Tail */}
            <path d="M 28 55 Q 20 50 22 58 Q 18 55 20 62" stroke="#D4C8B8" strokeWidth="3" fill="none" strokeLinecap="round" />

            {/* Belly blush when getting fat */}
            {boostCount > 3 && (
              <ellipse
                cx="50"
                cy="65"
                rx={10 + (boostCount / EXPLOSION_THRESHOLD) * 5}
                ry={8 + (boostCount / EXPLOSION_THRESHOLD) * 3}
                fill="#FFB6C1"
                opacity={0.3 + (boostCount / EXPLOSION_THRESHOLD) * 0.3}
              />
            )}

            {/* Sweat drops when about to explode */}
            {boostCount >= EXPLOSION_THRESHOLD - 2 && (
              <>
                <path d="M 70 35 Q 68 30 70 28" stroke="#87CEEB" strokeWidth="2" fill="none" />
                <ellipse cx="70" cy="35" rx="1.5" ry="2" fill="#87CEEB" />
              </>
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

      {/* Explosion flash */}
      {isExploding && (
        <div className="absolute inset-0 bg-yellow-400 rounded-full animate-ping opacity-50" />
      )}

      {/* Jiggle animation styles */}
      <style jsx global>{`
        @keyframes jiggle {
          0%, 100% { transform: scale(${goatScale}) rotate(0deg); }
          25% { transform: scale(${goatScale * 1.1}) rotate(-5deg); }
          50% { transform: scale(${goatScale * 1.15}) rotate(0deg); }
          75% { transform: scale(${goatScale * 1.1}) rotate(5deg); }
        }

        .animate-jiggle {
          animation: jiggle 0.3s ease-in-out;
        }
      `}</style>
    </div>
  );
}
