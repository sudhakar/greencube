'use client';

interface BgGradientProps {
  width?: number;
  height?: number;
  rotation?: number;
  fill1?: string;
  fill2?: string;
  lineStroke?: string;
}

export function BgGradient({
  width = 1200,
  height = 1200,
  rotation = 45,
  fill1 = '#06b6d4FF',
  fill2 = '#0891b2AA',
  lineStroke = '#06b6d4AA',
}: BgGradientProps = {}) {
  const cellSize = 90; // 1/4th smaller (was 120)
  const rectSize = 45; // 1/4th smaller (was 59)
  const gap = 1;
  const halfSize = width / 2;

  // Generate deterministic random cells based on seed hash
  const getRandomCells = (seed: number) => {
    // Create a seeded pseudo-random function that's deterministic
    const cells = [
      Math.floor((seed * 2654435761) % 8) === 0,
      Math.floor((seed * 2246822519) % 8) === 0,
      Math.floor((seed * 3266489917) % 8) === 0,
      Math.floor((seed * 668265263) % 8) === 0,
    ];
    return cells;
  };

  // Use a fixed seed for consistent random pattern
  const randomCells = getRandomCells(42);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      <svg
        className="absolute top-1/2 left-1/2"
        style={{
          width: `${width}px`,
          height: `${height}px`,
          transform: 'translate(-50%, -50%)',
        }}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid slice"
      >
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

        </defs>

        <defs>
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
            <stop offset="60%" stopColor="white" stopOpacity="0.4" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>

          {/* Mask for circular fade */}
          <mask id="circleFadeMask">
            <circle cx={halfSize} cy={halfSize / 2} r={halfSize * 0.83} fill="url(#circleFade)" />
          </mask>

          {/* Pattern definition - clean grid with solid gaps */}
          <pattern
            id="rectPattern"
            x="0"
            y="0"
            width={cellSize}
            height={cellSize}
            patternUnits="userSpaceOnUse"
            patternTransform={`rotate(${rotation})`}
          >
            {/* Row 1 - Cell 0 */}
            <rect
              x="0"
              y="0"
              width={rectSize}
              height={rectSize}
              fill={randomCells[0] ? fill1 : fill2}
              opacity={randomCells[0] ? '0.8' : '0.5'}
            />
            {/* Row 1 - Cell 1 */}
            <rect
              x={rectSize + gap}
              y="0"
              width={rectSize}
              height={rectSize}
              fill={randomCells[1] ? fill1 : fill2}
              opacity={randomCells[1] ? '0.8' : '0.5'}
            />

            {/* Row 2 - Cell 2 */}
            <rect
              x="0"
              y={rectSize + gap}
              width={rectSize}
              height={rectSize}
              fill={randomCells[2] ? fill1 : fill2}
              opacity={randomCells[2] ? '0.8' : '0.5'}
            />
            {/* Row 2 - Cell 3 */}
            <rect
              x={rectSize + gap}
              y={rectSize + gap}
              width={rectSize}
              height={rectSize}
              fill={randomCells[3] ? fill1 : fill2}
              opacity={randomCells[3] ? '0.8' : '0.5'}
            />

            {/* Gap lines (1px borders) */}
            <line x1={rectSize + gap} y1="0" x2={rectSize + gap} y2={cellSize} stroke={lineStroke} strokeWidth="1" opacity="0.3" />
            <line x1="0" y1={rectSize + gap} x2={cellSize} y2={rectSize + gap} stroke={lineStroke} strokeWidth="1" opacity="0.3" />
          </pattern>
        </defs>


        {/* Patterned circle with mask */}
        <rect
          width={width}
          height={height}
          fill="url(#rectPattern)"
          mask="url(#circleFadeMask)"
        />

        <rect
          width={width}
          height={height}
          filter="url(#darkGasFilter)"
          opacity="0.4"
          mask="url(#circleFadeMask)"
        />

      </svg>
    </div>
  );
}
