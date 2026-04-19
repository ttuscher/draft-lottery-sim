import React from 'react';
import Image from 'next/image';

/**
 * Per-team scale overrides for logos whose shape doesn't crop well at 1.45x.
 * Keyed by a substring found in the logo filename.
 */
const LOGO_SCALE_OVERRIDES: Record<string, number> = {
  '_COL_': 1.2,
};

/**
 * Wraps an NHL team logo in a fixed-size container with overflow-hidden,
 * then scales the image up to crop transparent padding around the logo.
 */
interface CroppedLogoProps {
 src: string;
 alt?: string;
 /** Tailwind size classes for the outer container, e.g. "w-6 h-6 md:w-8 md:h-8" */
 sizeClass: string;
 /** Extra classes on the outer wrapper (e.g. shrink-0, opacity-60) */
 wrapperClass?: string;
 /** Scale factor for cropping. Default 1.45 */
 scale?: number;
 /** Whether to apply retro filter effects */
 retro?: boolean;
 onError?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
}

export default function CroppedLogo({
 src,
 alt = '',
  sizeClass,
  wrapperClass = '',
  scale = 1.45,
  retro = true,
  onError,
}: CroppedLogoProps) {
  const resolvedScale = (() => {
    for (const [key, s] of Object.entries(LOGO_SCALE_OVERRIDES)) {
      if (src.includes(key)) return s;
    }
    return scale;
  })();

  return (
    <div className={`${sizeClass} overflow-hidden rounded-sm ${wrapperClass} relative`}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes="48px"
        className={`object-contain ${
          retro ? 'saturate-[2.2] contrast-[1.4] brightness-110 drop-shadow-[1px_1px_0_rgba(0,0,0,1)]' : ''
        }`}
        style={{
          imageRendering: 'pixelated',
          transform: `scale(${resolvedScale})`,
        }}
        onError={onError || ((e) => { e.currentTarget.style.visibility = 'hidden'; })}
      />
    </div>
  );
}
