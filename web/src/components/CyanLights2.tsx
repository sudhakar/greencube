import React, { useMemo } from 'react';

// Sizing Constants
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 1200;
const HALF_SIZE = CANVAS_WIDTH / 2;
const STEP = 22; // Distance between grid centers
const LIGHT_SIZE = 20; // 22 step - 20 size = exactly 2px gap
const RADIUS = 5; // Adjusted corner radius slightly for the larger size

// 3 Core background-ready colors
const COLOR_DIM = '#03375a';
const COLOR_CYAN = '#023a44';
const COLOR_BRIGHT = '#03375a';

export const CyanLights2: React.FC = () => {
  // Generate the coordinates and variations cleanly via useMemo
  const gridItems = useMemo(() => {
    const items = [];
    const cols = Math.ceil(CANVAS_WIDTH / STEP);
    const rows = Math.ceil(CANVAS_HEIGHT / STEP);

    // Seeded helper to ensure randomness is stable and doesn't flicker on re-render
    let seed = 1337;
    const random = () => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const rand = random();

        // Skip some slots entirely to keep the background airy and clean
        if (rand < 0.2) continue;

        const x = c * STEP;
        const y = r * STEP;

        let hrefId = '#cube-full';
        let fill = COLOR_DIM;
        let opacity = 0.3;

        // Distribute rare bright shapes and size variations across X & Y
        if (rand > 0.96) {
          hrefId = '#cube-micro';
          fill = COLOR_BRIGHT;
          opacity = 0.95; // Rare white hotspot
        } else if (rand > 0.88) {
          hrefId = '#cube-small';
          fill = COLOR_CYAN;
          opacity = 0.85; // Sparse crisp cyan accent
        } else if (rand > 0.65) {
          fill = COLOR_DIM;
          opacity = 0.6;  // Mid-tone background structural elements
        }

        items.push({ id: `${r}-${c}`, hrefId, x, y, fill, opacity });
      }
    }
    return items;
  }, []);

  return (
    <div className="fixed -z-1 inset-0 pointer-events-none overflow-hidden" style={{ background: '' }}>
      <svg
        className="absolute top-1/2 left-1/2"
        style={{
          width: `${CANVAS_WIDTH}px`,
          height: `${CANVAS_HEIGHT}px`,
          transform: 'translate(-50%, -50%)',
        }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* --- SHAPE PRIMITIVES (Centered offsets updated for 20px base) --- */}
          <rect id="cube-full" width={LIGHT_SIZE} height={LIGHT_SIZE} rx={RADIUS} ry={RADIUS} />

          <rect id="cube-small" width={LIGHT_SIZE * 0.6} height={LIGHT_SIZE * 0.6} rx={RADIUS * 0.6} ry={RADIUS * 0.6}
            transform={`translate(${LIGHT_SIZE * 0.2}, ${LIGHT_SIZE * 0.2})`} />

          <rect id="cube-micro" width={LIGHT_SIZE * 0.35} height={LIGHT_SIZE * 0.35} rx={RADIUS * 0.35} ry={RADIUS * 0.35}
            transform={`translate(${LIGHT_SIZE * 0.325}, ${LIGHT_SIZE * 0.325})`} />

          {/* --- RADIAL VIGNETTE MASK --- */}
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

          <mask id="circleFadeMask">
            <circle cx={HALF_SIZE} cy={HALF_SIZE / 2} r={CANVAS_WIDTH * .83} fill="url(#circleFade)" />
          </mask>
        </defs>

        {/* --- PROGRAMMATIC VECTOR RENDERING WITH MASK --- */}
        <g mask="url(#circleFadeMask)" opacity={0.4}        >
          {gridItems.map((item) => (
            <use
              key={item.id}
              href={item.hrefId}
              x={item.x}
              y={item.y}
              fill={item.fill}
              opacity={item.opacity}

            />
          ))}
        </g>
      </svg>
    </div>
  );
};

export default CyanLights2;