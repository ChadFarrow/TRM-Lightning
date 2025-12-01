'use client';

import { Zap } from 'lucide-react';
import { useLightning } from '@/contexts/LightningContext';

interface BoostButtonProps {
  onClick: (e: React.MouseEvent) => void;
  ariaLabel: string;
  className?: string;
}

/**
 * Shared Lightning boost button for card components.
 * Only renders when Lightning is enabled.
 */
export default function BoostButton({ onClick, ariaLabel, className = '' }: BoostButtonProps) {
  const { isLightningEnabled } = useLightning();

  if (!isLightningEnabled) {
    return null;
  }

  return (
    <div className={`absolute top-1 left-1 sm:top-2 sm:left-2 ${className}`}>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClick(e);
        }}
        className="w-6 h-6 sm:w-7 sm:h-7 bg-yellow-500/90 hover:bg-yellow-600/90 backdrop-blur-sm rounded-full flex items-center justify-center transition-colors z-10"
        aria-label={ariaLabel}
      >
        <Zap className="w-3 h-3 sm:w-4 sm:h-4 text-black" />
      </button>
    </div>
  );
}
