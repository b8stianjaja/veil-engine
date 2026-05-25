/**
 * @file src/components/SgAssets.tsx
 * @description Native 2D RPG assets registry with pure hand-drawn styled SVG elements,
 * custom CSS keyframe animations, direction bobs, particle orbits, and layered textures.
 */

import React from 'react';

// Injection of animations for pure 2D assets inside the document header if not present
const ANIM_CSS = `
@keyframes rpg-bob {
  0%, 100% { transform: translateY(0px) scale(1); }
  50% { transform: translateY(-4px) scale(1.02); }
}
@keyframes rpg-shake {
  0%, 100% { transform: rotate(-2deg); }
  50% { transform: rotate(2deg); }
}
@keyframes rpg-walk-left-right {
  0%, 100% { transform: scaleX(1) rotate(-4deg) translateY(0); }
  50% { transform: scaleX(1) rotate(4deg) translateY(-3px); }
}
@keyframes rpg-pulse-glow {
  0%, 100% { filter: drop-shadow(0 0 2px var(--glow-color, #7C3AED)) opacity(0.85); }
  50% { filter: drop-shadow(0 0 10px var(--glow-color, #A855F7)) opacity(1); }
}
@keyframes rpg-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
@keyframes rpg-swing {
  0%, 100% { transform: rotate(-3deg); }
  50% { transform: rotate(3deg); }
}
@keyframes rpg-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}
@keyframes rpg-shimmer {
  0% { opacity: 0.3; }
  50% { opacity: 0.9; }
  100% { opacity: 0.3; }
}
`;

if (typeof document !== 'undefined') {
  const styleId = 'rpg-engine-dynamic-asset-animations';
  if (!document.getElementById(styleId)) {
    const styleNode = document.createElement('style');
    styleNode.id = styleId;
    styleNode.innerHTML = ANIM_CSS;
    document.head.appendChild(styleNode);
  }
}

interface RPGAssetProps {
  className?: string;
  isMoving?: boolean;
  direction?: 'left' | 'right' | 'up' | 'down';
  color?: string;
}

/**
 * 1. HERO KNIGHT (WASD Control)
 * Detailed cute RPG Knight with helmet visor, moving visor plume, hand-drawn colors and moving feet.
 */
export const HeroKnight: React.FC<RPGAssetProps> = ({
  isMoving = false,
  direction = 'right',
  color = '#10B981'
}) => {
  const rotationY = direction === 'left' ? 'scale(-1, 1)' : 'scale(1, 1)';
  const walkAnimClass = isMoving ? 'animate-[rpg-walk-left-right_0.4s_infinite_ease-in-out]' : 'animate-[rpg-bob_2s_infinite_ease-in-out]';

  return (
    <div
      className={`w-full h-full flex items-center justify-center relative ${walkAnimClass}`}
      style={{ transform: rotationY, transformOrigin: 'center' }}
    >
      <svg viewBox="0 0 128 128" className="w-[110%] h-[110%] drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]">
        {/* Shadow */}
        <ellipse cx="64" cy="115" rx="34" ry="10" fill="rgba(0,0,0,0.4)" />

        {/* Back Cape */}
        <path d="M40,70 L20,110 L95,110 L75,70 Z" fill="#EF4444" opacity="0.9" stroke="#7F1D1D" strokeWidth="2" />

        {/* Feet / Boots */}
        <path d="M45,108 L35,115 L48,118 Z" fill="#374151" stroke="#111827" strokeWidth="2.5" />
        <path d="M75,108 L65,115 L78,118 Z" fill="#374151" stroke="#111827" strokeWidth="2.5" />

        {/* Body Armor */}
        <rect x="36" y="60" width="48" height="42" rx="10" fill="#9CA3AF" stroke="#374151" strokeWidth="3" />
        {/* Breastplate crest */}
        <polygon points="60,70 68,70 64,88" fill={color} />
        <circle cx="64" cy="90" r="4" fill="#FBBF24" />

        {/* Shield on Back or Arm */}
        <path d="M24,70 C24,90 34,100 44,102 C34,95 24,80 24,70" fill="#3B82F6" stroke="#1D4ED8" strokeWidth="2" />

        {/* Knight Helmet head */}
        <circle cx="64" cy="46" r="26" fill="#D1D5DB" stroke="#374151" strokeWidth="3" />
        
        {/* Visor shield */}
        <path d="M44,42 C44,30 84,30 84,42 L80,56 C80,56 64,60 48,56 Z" fill="#4B5563" stroke="#1F2937" strokeWidth="2.5" />
        {/* Eyes behind glow */}
        <circle cx="56" cy="46" r="3" fill="#60A5FA" className="animate-pulse" />
        <circle cx="72" cy="46" r="3" fill="#60A5FA" className="animate-pulse" />

        {/* Red Plume on Top of Helmet */}
        <path d="M64,20 C50,10 40,30 64,26 C75,12 85,25 64,20" fill="#EF4444" stroke="#991B1B" strokeWidth="2" />

        {/* Iron Gauntlets/Arms */}
        <circle cx="32" cy="78" r="8" fill="#4B5563" stroke="#1F2937" strokeWidth="2" />
        <circle cx="88" cy="78" r="8" fill="#4B5563" stroke="#1F2937" strokeWidth="2" />

        {/* Golden Sword */}
        <g transform="translate(94, 50) rotate(15)">
          <rect x="-4" y="-2" width="8" height="34" fill="#E5E7EB" stroke="#4B5563" strokeWidth="1.5" />
          <polygon points="0,-12 -5,-2 5,-2" fill="#9CA3AF" />
          {/* Hilt guard */}
          <rect x="-10" y="30" width="20" height="4" fill="#FBBF24" stroke="#D97706" />
          <rect x="-3" y="34" width="6" height="12" fill="#D97706" />
        </g>
      </svg>
    </div>
  );
};

/**
 * 2. ANCIENT RUNIC STONE PILLAR (Obstacle / Solid)
 * Moss weathering overlays, rock textures, and glowing magical runic signets.
 */
export const StonePillar: React.FC<RPGAssetProps> = ({ color = '#EF4444' }) => {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 128 128" className="w-full h-full">
        {/* Ground shadow */}
        <ellipse cx="64" cy="112" rx="45" ry="12" fill="rgba(0,0,0,0.4)" />

        {/* Pillars Base */}
        <rect x="22" y="94" width="84" height="18" rx="4" fill="#374151" stroke="#111827" strokeWidth="3" />
        <rect x="28" y="86" width="72" height="8" rx="2" fill="#4B5563" />

        {/* Weathered Moss Layers */}
        <path d="M22,100 C22,95 44,98 55,94 C70,102 90,96 106,102 L106,112 L22,112 Z" fill="#065F46" opacity="0.8" />

        {/* Main Column block */}
        <path d="M34,22 L94,18 L90,86 L38,86 Z" fill="#6B7280" stroke="#1F2937" strokeWidth="3" />
        
        {/* Left pillar highlight */}
        <path d="M34,22 L50,20 L52,86 L38,86 Z" fill="#9CA3AF" />

        {/* Weathering cracks details */}
        <path d="M42,35 L48,40 L45,46" stroke="#111827" strokeWidth="2.5" fill="none" />
        <path d="M82,70 L75,76 L78,84" stroke="#111827" strokeWidth="2" fill="none" />
        <path d="M38,72 L46,71 L48,78" fill="#10B981" /> {/* Clinging vine */}

        {/* Glowing runic core overlay */}
        <g style={{ '--glow-color': color } as React.CSSProperties} className="animate-[rpg-pulse-glow_1.5s_infinite_ease-in-out]">
          <path d="M64,36 L72,44 L64,52 L56,44 Z" fill="none" stroke={color} strokeWidth="3" />
          <line x1="64" y1="36" x2="64" y2="52" stroke={color} strokeWidth="2" />
          <line x1="56" y1="44" x2="72" y2="44" stroke={color} strokeWidth="2" />
          <circle cx="64" cy="44" r="2.5" fill="#FFFFFF" />
          {/* Second mini rune */}
          <path d="M60,62 L68,62 L64,72 Z" fill="none" stroke={color} strokeWidth="2" />
        </g>
      </svg>
    </div>
  );
};

/**
 * 3. COLLECTIBLE portal STAR / GOLD COIN (Sensor/Item)
 * High dynamic shining gold gradient coin, sparkling highlights, floating animation.
 */
export const GoldStar: React.FC<RPGAssetProps> = () => {
  return (
    <div className="w-full h-full flex items-center justify-center animate-[rpg-float_1.5s_infinite_ease-in-out]">
      <svg viewBox="0 0 128 128" className="w-[110%] h-[110%]">
        {/* Soft shadow */}
        <ellipse cx="64" cy="118" rx="20" ry="6" fill="rgba(0,0,0,0.3)" />

        {/* Gold Outer halo */}
        <circle cx="64" cy="62" r="44" fill="rgba(252,211,77,0.15)" className="animate-[rpg-pulse-glow_2s_infinite]" />
        
        {/* Coin Body */}
        <circle cx="64" cy="62" r="32" fill="url(#goldGradient)" stroke="#D97706" strokeWidth="3.5" />
        <circle cx="64" cy="62" r="24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeDasharray="4 2" />

        {/* Star Motif Center */}
        <g className="animate-[rpg-swing_3s_infinite_ease-in-out]" style={{ transformOrigin: '64px 62px' }}>
          <polygon points="64,36 71,49 86,52 75,63 78,78 64,70 50,78 53,63 42,52 57,49" fill="#FFF" stroke="#FFF" strokeWidth="1" />
          {/* Inner crystal sparkle */}
          <circle cx="64" cy="58" r="4" fill="#FBBF24" />
        </g>

        {/* Gradients */}
        <defs>
          <radialGradient id="goldGradient" cx="50%" cy="30%" r="50%">
            <stop offset="0%" stopColor="#FDE68A" />
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#B45309" />
          </radialGradient>
        </defs>
      </svg>
    </div>
  );
};

/**
 * 4. SPIKE BLOCK HAZARD (Sensor/Obstacle)
 * Hand-drawn spined iron skewers protruding from rusted bases with dynamic blood-neon indicators.
 */
export const SpikeTrap: React.FC<RPGAssetProps> = () => {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 128 128" className="w-full h-full">
        {/* Shadow */}
        <ellipse cx="64" cy="115" rx="44" ry="10" fill="rgba(0,0,0,0.45)" />

        {/* Rusty Iron Frame Base */}
        <rect x="18" y="90" width="92" height="20" rx="3" fill="#4B5563" stroke="#1F2937" strokeWidth="3" />
        <rect x="26" y="94" width="76" height="4" fill="#111827" />

        {/* Warning hazard stripes */}
        <line x1="30" y1="108" x2="40" y2="92" stroke="#FBBF24" strokeWidth="2.5" />
        <line x1="50" y1="108" x2="60" y2="92" stroke="#FBBF24" strokeWidth="2.5" />
        <line x1="70" y1="108" x2="80" y2="92" stroke="#FBBF24" strokeWidth="2.5" />
        <line x1="90" y1="108" x2="100" y2="92" stroke="#FBBF24" strokeWidth="2.5" />

        {/* Piercing spikes */}
        <g className="animate-[rpg-shake_0.6s_infinite_ease-in-out]" style={{ transformOrigin: '64px 90px' }}>
          {/* Spike Left */}
          <polygon points="34,90 40,24 46,90" fill="#9CA3AF" stroke="#1F2937" strokeWidth="2.5" />
          <polygon points="34,90 38,24 40,90" fill="#D1D5DB" />
          {/* Blooded crimson tip */}
          <polygon points="38,45 40,24 42,45" fill="#EF4444" />

          {/* Spike Center */}
          <polygon points="60,90 64,12 68,90" fill="#9CA3AF" stroke="#1F2937" strokeWidth="2.5" />
          <polygon points="60,90 63,12 64,90" fill="#E5E7EB" />
          {/* Blooded crimson tip */}
          <polygon points="62,35 64,12 66,35" fill="#EF4444" />

          {/* Spike Right */}
          <polygon points="82,90 88,24 94,90" fill="#9CA3AF" stroke="#1F2937" strokeWidth="2.5" />
          <polygon points="82,90 86,24 88,90" fill="#D1D5DB" />
          {/* Blooded crimson tip */}
          <polygon points="85,45 88,24 90,45" fill="#EF4444" />
        </g>
      </svg>
    </div>
  );
};

/**
 * 5. NEXUS CRYSTAL ROTATOR (Behavior: Rotator)
 * Beautiful neon crystal rotating crystal floating with layered orbit particles.
 */
export const CrystalRotator: React.FC<RPGAssetProps> = ({ color = '#A855F7' }) => {
  return (
    <div className="w-full h-full flex items-center justify-center relative">
      <svg viewBox="0 0 128 128" className="w-[110%] h-[110%]">
        {/* Soft shadow */}
        <ellipse cx="64" cy="116" rx="26" ry="8" fill="rgba(0,0,0,0.3)" />

        {/* Swirling energy path */}
        <ellipse cx="64" cy="64" rx="42" ry="16" fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="6 4" className="animate-[rpg-spin_6s_infinite_linear]" style={{ transformOrigin: '64px 64px' }} />

        {/* Floating crystal prism */}
        <g className="animate-[rpg-float_2s_infinite_ease-in-out]" style={{ transformOrigin: '64px 64px' }}>
          <g className="animate-[rpg-spin_8s_infinite_linear]" style={{ transformOrigin: '64px 64px' }}>
            <polygon points="64,22 84,64 64,106 44,64" fill={`${color}30`} stroke={color} strokeWidth="3" />
            <polygon points="64,22 64,106 44,64" fill={`${color}60`} />
            {/* Center shiny core beam */}
            <line x1="64" y1="22" x2="64" y2="106" stroke="#FFFFFF" strokeWidth="2" />
          </g>
          
          {/* Floating energy shield stars */}
          <circle cx="38" cy="40" r="3.5" fill="#FFFFFF" className="animate-[rpg-shimmer_1.5s_infinite]" />
          <circle cx="90" cy="80" r="3.5" fill={color} className="animate-[rpg-shimmer_2s_infinite]" />
        </g>
      </svg>
    </div>
  );
};

/**
 * 6. BREEZY FANTASY SCENIC TREE (Scenic/Props)
 * Beautiful cherry-blossom vector foliage bended trunk sways in winds. Perfect for RPG.
 */
export const ScenicTree: React.FC<RPGAssetProps> = () => {
  return (
    <div className="w-full h-full flex items-center justify-center animate-[rpg-swing_5s_infinite_ease-in-out]">
      <svg viewBox="0 0 128 128" className="w-[115%] h-[115%]">
        {/* Big shadow */}
        <ellipse cx="58" cy="118" rx="46" ry="11" fill="rgba(0,0,0,0.4)" />

        {/* Tree Trunk */}
        <path d="M52,118 C52,90 44,70 56,58 C66,48 74,54 74,40 C75,110 82,118 82,118" fill="#5C4033" stroke="#2B1A0A" strokeWidth="3" />
        {/* Shading */}
        <path d="M52,118 C52,90 44,70 56,58" stroke="#3D2B1F" strokeWidth="2" fill="none" />

        {/* Cherry blossom foliage canopy layers */}
        {/* Layer 1: Left */}
        <circle cx="44" cy="46" r="24" fill="#F472B6" stroke="#9D174D" strokeWidth="2.5" />
        <circle cx="38" cy="40" r="14" fill="#F43F5E" />

        {/* Layer 2: Right */}
        <circle cx="82" cy="44" r="26" fill="#EC4899" stroke="#9D174D" strokeWidth="2.5" />
        <circle cx="88" cy="38" r="16" fill="#F472B6" />

        {/* Layer 3: Top/Center */}
        <circle cx="62" cy="28" r="28" fill="#F472B6" stroke="#9D174D" strokeWidth="3" />
        <circle cx="62" cy="22" r="18" fill="#FBCFE8" />

        {/* Tiny branch sticking out */}
        <path d="M48,76 Q36,70 32,74" fill="none" stroke="#2B1A0A" strokeWidth="2" />
        <circle cx="32" cy="74" r="4.5" fill="#EC4899" />
      </svg>
    </div>
  );
};
