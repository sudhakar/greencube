import React from 'react';

export const CyanLights: React.FC = () => {
  const width = 1200
  const height = 1200
  const halfSize = width / 2;

  return (
    <div className="fixed -z-1 inset-0 pointer-events-none overflow-hidden" style={{ background: '#0d1117' }}>
      <svg className="absolute top-1/2 left-1/2"
        style={{
          width: `${width}px`,
          height: `${height}px`,
          transform: 'translate(-50%, -50%)',
        }}

        xmlns="http://www.w3.org/2000/svg">
        <defs>

          <filter id="darkGasFilter" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="5" result="noise" />
            <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1.8 -0.4" in="noise" result="highContrastNoise" />
            <feComponentTransfer in="highContrastNoise" result="darkGas">
              <feFuncR type="linear" slope="0.08" />
              <feFuncG type="linear" slope="0.08" />
              <feFuncB type="linear" slope="0.09" />
              <feFuncA type="linear" slope="1.0" />
            </feComponentTransfer>
          </filter>

          {/* Radial gradient for circular fade from top center */}
          <radialGradient
            id="circleFade"
            cx="50%"
            cy="50%"
            r="50%"
            fx="50%"
            fy="0%"
          >
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="40%" stopColor="white" stopOpacity="0.8" />
            <stop offset="60%" stopColor="white" stopOpacity="0.2" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>

          {/* Mask for circular fade */}
          <mask id="circleFadeMask">
            <circle cx={halfSize} cy={halfSize / 2} r={halfSize * 0.83} fill="url(#circleFade)" />
          </mask>

          {/* 1. THE PRIMITIVE SHAPE */}
          <rect id="square" width="8" height="8" rx="1.5" />

          {/* 2. THE REPEATABLE TILE (44x44px grid block that lines up seamlessly) */}
          <pattern id="cyan-grid" width="44" height="44" patternUnits="userSpaceOnUse">
            {/* Row 0 */}
            <use href="#square" x="0" y="0" fill="#002d44" />
            <use href="#square" x="11" y="0" fill="#1e293b" />
            <use href="#square" x="22" y="0" fill="#025b6a" />
            <use href="#square" x="33" y="0" fill="#131921" />

            {/* Row 1 */}
            <use href="#square" x="0" y="11" fill="#053238" />
            <use href="#square" x="11" y="11" fill="#131921" />
            <use href="#square" x="22" y="11" fill="#003048" />
            <use href="#square" x="33" y="11" fill="#1e293b" />

            {/* Row 2 */}
            <use href="#square" x="0" y="22" fill="#1e293b" />
            <use href="#square" x="11" y="22" fill="#363a3c" />
            <use href="#square" x="22" y="22" fill="#131921" />
            <use href="#square" x="33" y="22" fill="#025b6a" />

            {/* Row 3 */}
            <use href="#square" x="0" y="33" fill="#01344e" />
            <use href="#square" x="11" y="33" fill="#01252c" />
            <use href="#square" x="22" y="33" fill="#1e293b" />
            <use href="#square" x="33" y="33" fill="#07383f" />
          </pattern>
        </defs>

        {/* 3. CANVAS (Fills any screen size with the repeating pattern seamlessly) */}
        <rect
          width="100%"
          height="100%"
          scale={6}
          fill="url(#cyan-grid)"
          mask="url(#circleFadeMask)" />

      </svg>
    </div>
  );
};

export default CyanLights;