/**
 * Detailed 16-Bit Military Naval Ship Asset Generator (SVGs)
 * Generates high-quality vector pixel-art warships:
 * - Aircraft Carrier (5 cells)
 * - Battleship (4 cells)
 * - Missile Cruiser (3 cells)
 * - Attack Submarine (3 cells)
 * - Patrol Destroyer (2 cells)
 */

const SHIP_PALETTE = {
  hullBase: '#2a3b53',
  hullDark: '#1c2838',
  hullHighlight: '#435c82',
  hullBorder: '#5b7aa8',
  deck: '#33445e',
  deckMarkings: '#ffcc00',
  runway: '#222f42',
  runwayLines: '#d4e4fc',
  bridgeTower: '#5b7aa8',
  bridgeWindow: '#00f0ff',
  turretGun: '#6e8db8',
  turretBase: '#1d2737',
  submarineHull: '#162232',
  subTower: '#26384e',
  subGlow: '#00ffaa'
};

/**
 * Returns an inline SVG string for a given ship type and dimensions
 * Width and height are based on cell units (each cell is 32px + 2px gap = ~34px)
 */
function generateShipSVG(shipId, length, isVertical = false) {
  const cellSize = 32;
  const gap = 2;
  const totalLength = length * cellSize + (length - 1) * gap;
  const width = cellSize;
  const height = totalLength;

  // We draw horizontally first (width = totalLength, height = cellSize), then rotate if vertical
  const w = totalLength;
  const h = cellSize;

  let interiorContent = '';

  switch (shipId) {
    case 'carrier':
      interiorContent = `
        <!-- Carrier Hull -->
        <defs>
          <linearGradient id="carrierHullGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#465e80" />
            <stop offset="50%" stop-color="#2a3b53" />
            <stop offset="100%" stop-color="#192433" />
          </linearGradient>
          <pattern id="runwayStripes" width="16" height="6" patternUnits="userSpaceOnUse">
            <rect x="0" y="2" width="10" height="2" fill="#ffcc00" />
          </pattern>
        </defs>

        <!-- Angular Flight Deck Bow & Stern -->
        <polygon points="0,${h * 0.4} 14,2 ${w - 6},2 ${w},${h * 0.25} ${w},${h * 0.75} ${w - 6},${h - 2} 14,${h - 2} 0,${h * 0.6}"
                 fill="url(#carrierHullGrad)" stroke="#688cb8" stroke-width="1.5" />

        <!-- Angled Runway Strip -->
        <rect x="18" y="5" width="${w - 36}" height="${h - 10}" rx="2" fill="#1b2536" stroke="#374d6b" stroke-width="1" />
        
        <!-- Runway Center Dash Lines -->
        <line x1="22" y1="${h / 2}" x2="${w - 22}" y2="${h / 2}" stroke="#ffffff" stroke-width="2" stroke-dasharray="8,6" opacity="0.85" />
        
        <!-- Touchdown threshold stripes -->
        <rect x="22" y="8" width="6" height="3" fill="#ffcc00" />
        <rect x="22" y="${h - 11}" width="6" height="3" fill="#ffcc00" />
        <line x1="${w - 28}" y1="8" x2="${w - 28}" y2="${h - 8}" stroke="#ffcc00" stroke-width="1.5" />

        <!-- Island / Control Bridge Tower on Starboard (Top) -->
        <rect x="${w * 0.52}" y="3" width="22" height="6" rx="1" fill="#58769e" stroke="#89a9d4" stroke-width="1" />
        <rect x="${w * 0.54}" y="4" width="8" height="2" fill="#00f0ff" />
        <circle cx="${w * 0.62}" cy="6" r="2" fill="#ffcc00" />
        <!-- Radar Mast -->
        <line x1="${w * 0.57}" y1="3" x2="${w * 0.57}" y2="0" stroke="#00f0ff" stroke-width="1.5" />
        <line x1="${w * 0.54}" y1="1" x2="${w * 0.60}" y2="1" stroke="#00f0ff" stroke-width="1" />

        <!-- Parked Aircraft Silhouettes -->
        <polygon points="${w * 0.25},7 ${w * 0.28},11 ${w * 0.22},11" fill="#7896be" />
        <polygon points="${w * 0.35},7 ${w * 0.38},11 ${w * 0.32},11" fill="#7896be" />
        <polygon points="${w * 0.76},${h - 11} ${w * 0.79},${h - 7} ${w * 0.73},${h - 7}" fill="#7896be" />
      `;
      break;

    case 'battleship':
      interiorContent = `
        <defs>
          <linearGradient id="bbGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#4e6587" />
            <stop offset="50%" stop-color="#314259" />
            <stop offset="100%" stop-color="#1e2938" />
          </linearGradient>
        </defs>

        <!-- Heavy Armored Steel Bow to Stern -->
        <polygon points="0,${h / 2} 18,3 ${w - 12},3 ${w},8 ${w},${h - 8} ${w - 12},${h - 3} 18,${h - 3}"
                 fill="url(#bbGrad)" stroke="#7496c2" stroke-width="1.5" />

        <!-- Deck Plating Lines -->
        <line x1="20" y1="${h / 2}" x2="${w - 14}" y2="${h / 2}" stroke="#223042" stroke-width="1" />

        <!-- Forward Main Heavy Turret A (Twin Barrels) -->
        <line x1="12" y1="${h / 2 - 2}" x2="26" y2="${h / 2 - 2}" stroke="#00f0ff" stroke-width="2" />
        <line x1="12" y1="${h / 2 + 2}" x2="26" y2="${h / 2 + 2}" stroke="#00f0ff" stroke-width="2" />
        <circle cx="26" cy="${h / 2}" r="6.5" fill="#1b2536" stroke="#89a9d4" stroke-width="1.5" />

        <!-- Forward Main Turret B -->
        <line x1="32" y1="${h / 2 - 2}" x2="44" y2="${h / 2 - 2}" stroke="#00f0ff" stroke-width="2" />
        <line x1="32" y1="${h / 2 + 2}" x2="44" y2="${h / 2 + 2}" stroke="#00f0ff" stroke-width="2" />
        <circle cx="44" cy="${h / 2}" r="6" fill="#24334a" stroke="#89a9d4" stroke-width="1.5" />

        <!-- Armored Bridge & Fire Control Tower -->
        <polygon points="${w * 0.44},7 ${w * 0.58},7 ${w * 0.55},${h - 7} ${w * 0.46},${h - 7}"
                 fill="#5a779e" stroke="#9bbde8" stroke-width="1.2" />
        <rect x="${w * 0.48}" y="${h / 2 - 3}" width="8" height="6" fill="#00f0ff" rx="1" />
        <!-- Radar mast -->
        <line x1="${w * 0.52}" y1="7" x2="${w * 0.52}" y2="1" stroke="#ffcc00" stroke-width="1.5" />

        <!-- Aft Heavy Main Turret C -->
        <line x1="${w - 20}" y1="${h / 2 - 2}" x2="${w - 7}" y2="${h / 2 - 2}" stroke="#00f0ff" stroke-width="2" />
        <line x1="${w - 20}" y1="${h / 2 + 2}" x2="${w - 7}" y2="${h / 2 + 2}" stroke="#00f0ff" stroke-width="2" />
        <circle cx="${w - 22}" cy="${h / 2}" r="6.5" fill="#1b2536" stroke="#89a9d4" stroke-width="1.5" />
      `;
      break;

    case 'cruiser':
      interiorContent = `
        <defs>
          <linearGradient id="crGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#466085" />
            <stop offset="50%" stop-color="#2c3e57" />
            <stop offset="100%" stop-color="#1a2536" />
          </linearGradient>
        </defs>

        <!-- Sleek High-Speed Hull -->
        <polygon points="0,${h / 2} 16,4 ${w - 10},4 ${w},9 ${w},${h - 9} ${w - 10},${h - 4} 16,${h - 4}"
                 fill="url(#crGrad)" stroke="#678cb8" stroke-width="1.5" />

        <!-- Bow Cannon Turret -->
        <line x1="8" y1="${h / 2}" x2="22" y2="${h / 2}" stroke="#00f0ff" stroke-width="2.5" />
        <circle cx="21" cy="${h / 2}" r="5" fill="#1c2838" stroke="#84a6cf" stroke-width="1.5" />

        <!-- Vertical Launch System (VLS) Missile Cells -->
        <g fill="#111a26" stroke="#00ffaa" stroke-width="0.8">
          <rect x="30" y="${h / 2 - 5}" width="4" height="4" />
          <rect x="36" y="${h / 2 - 5}" width="4" height="4" />
          <rect x="30" y="${h / 2 + 1}" width="4" height="4" />
          <rect x="36" y="${h / 2 + 1}" width="4" height="4" />
        </g>

        <!-- Stealth Bridge & Sensor Mast -->
        <polygon points="${w * 0.48},6 ${w * 0.62},6 ${w * 0.58},${h - 6} ${w * 0.50},${h - 6}"
                 fill="#4f6e99" stroke="#94b7e3" stroke-width="1" />
        <line x1="${w * 0.55}" y1="6" x2="${w * 0.55}" y2="2" stroke="#00f0ff" stroke-width="1.5" />

        <!-- Aft Phalanx CIWS Dome -->
        <circle cx="${w - 18}" cy="${h / 2}" r="4" fill="#ffffff" stroke="#ff3344" stroke-width="1" />
        <line x1="${w - 24}" y1="${h / 2}" x2="${w - 14}" y2="${h / 2}" stroke="#33445e" stroke-width="2" />
      `;
      break;

    case 'submarine':
      interiorContent = `
        <defs>
          <linearGradient id="subGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#2e425c" />
            <stop offset="50%" stop-color="#141e2b" />
            <stop offset="100%" stop-color="#0a1017" />
          </linearGradient>
        </defs>

        <!-- Teardrop Acoustic Coated Stealth Hull -->
        <polygon points="2,${h / 2} 14,5 ${w - 16},5 ${w - 4},11 ${w},${h / 2} ${w - 4},${h - 11} ${w - 16},${h - 5} 14,${h - 5}"
                 fill="url(#subGrad)" stroke="#45658a" stroke-width="1.5" />

        <!-- Forward Sonar Dome -->
        <ellipse cx="7" cy="${h / 2}" rx="4" ry="7" fill="#0d1824" stroke="#00ffaa" stroke-width="1" />

        <!-- Conning Tower (Sail) -->
        <rect x="${w * 0.40}" y="${h / 2 - 4}" width="22" height="8" rx="3" fill="#324966" stroke="#779cc7" stroke-width="1.2" />
        <!-- Periscope & Snorkel Masts -->
        <line x1="${w * 0.44}" y1="${h / 2}" x2="${w * 0.44}" y2="2" stroke="#00f0ff" stroke-width="1.5" />
        <line x1="${w * 0.52}" y1="${h / 2}" x2="${w * 0.52}" y2="1" stroke="#ffcc00" stroke-width="1.5" />

        <!-- Ballast vent grids -->
        <line x1="22" y1="${h / 2 - 6}" x2="32" y2="${h / 2 - 6}" stroke="#00ffaa" stroke-width="1" stroke-dasharray="2,2" opacity="0.6" />
        <line x1="22" y1="${h / 2 + 6}" x2="32" y2="${h / 2 + 6}" stroke="#00ffaa" stroke-width="1" stroke-dasharray="2,2" opacity="0.6" />

        <!-- Stern Propeller Screw -->
        <polygon points="${w - 2},${h / 2 - 7} ${w + 3},${h / 2} ${w - 2},${h / 2 + 7}" fill="#ffd700" opacity="0.85" />
      `;
      break;

    case 'destroyer':
      interiorContent = `
        <defs>
          <linearGradient id="desGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#466287" />
            <stop offset="50%" stop-color="#2a3c54" />
            <stop offset="100%" stop-color="#182333" />
          </linearGradient>
        </defs>

        <!-- Fast Attack Stealth Bow -->
        <polygon points="0,${h / 2} 14,4 ${w - 8},4 ${w},9 ${w},${h - 9} ${w - 8},${h - 4} 14,${h - 4}"
                 fill="url(#desGrad)" stroke="#6d92bf" stroke-width="1.5" />

        <!-- Bow Rapid Cannon -->
        <line x1="6" y1="${h / 2}" x2="18" y2="${h / 2}" stroke="#00f0ff" stroke-width="2.5" />
        <circle cx="17" cy="${h / 2}" r="4.5" fill="#1b2636" stroke="#8cb0db" stroke-width="1.2" />

        <!-- Bridge & Radar -->
        <rect x="26" y="${h / 2 - 5}" width="16" height="10" rx="2" fill="#4d6f99" stroke="#9bbde6" stroke-width="1" />
        <line x1="34" y1="${h / 2 - 5}" x2="34" y2="2" stroke="#ffcc00" stroke-width="1.5" />

        <!-- Torpedo Tubes & Depth Charge Racks -->
        <line x1="${w - 14}" y1="${h / 2 - 3}" x2="${w - 5}" y2="${h / 2 - 3}" stroke="#00f0ff" stroke-width="1.8" />
        <line x1="${w - 14}" y1="${h / 2 + 3}" x2="${w - 5}" y2="${h / 2 + 3}" stroke="#00f0ff" stroke-width="1.8" />
      `;
      break;
  }

  // If vertical, we rotate 90 degrees around center
  const finalSvgWidth = isVertical ? h : w;
  const finalSvgHeight = isVertical ? w : h;

  let transformAttr = '';
  if (isVertical) {
    // Rotate 90 degrees clockwise
    transformAttr = `transform="translate(${finalSvgWidth}, 0) rotate(90)"`;
  }

  return `
    <svg class="naval-ship-svg naval-ship-${shipId} ${isVertical ? 'vertical' : 'horizontal'}"
         width="${finalSvgWidth}" height="${finalSvgHeight}"
         viewBox="0 0 ${finalSvgWidth} ${finalSvgHeight}"
         xmlns="http://www.w3.org/2000/svg">
      <g ${transformAttr}>
        ${interiorContent}
      </g>
    </svg>
  `;
}

window.generateShipSVG = generateShipSVG;
