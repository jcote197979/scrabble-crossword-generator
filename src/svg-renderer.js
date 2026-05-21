// Scrabble SVG Renderer
const SCRABBLE_SCORES = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3,
  N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10
};
// Available tile themes (colors match wood textures for readability)
export const TILE_THEMES = {
  maple: { text: "#000000", score: "#000000", border: "#885533", fillFallback: "#f3d9b1" },
  walnut: { text: "#000000", score: "#000000", border: "#2a150c", fillFallback: "#381f14" },
  cherry: { text: "#000000", score: "#000000", border: "#6c260f", fillFallback: "#a24021" },
  white: { text: "#000000", score: "#000000", border: "#cccccc", fillFallback: "#fdfdfd" }
};

// Available board sizes in mm
export const BOARD_SIZES = {
  medium_portrait: { width: 229, height: 305, label: "Medium Portrait - 229x305mm" },
  large_portrait: { width: 305, height: 406, label: "Large Portrait - 305x406mm" },
  square: { width: 305, height: 305, label: "Square - 305x305mm" },
  landscape: { width: 406, height: 305, label: "Landscape - 406x305mm" }
};

// Available wood background themes
export const BACKGROUND_THEMES = {
  brown: { name: "Warm Mahogany", fill: "#523019" },
  dark: { name: "Dark Oak", fill: "#1e1e1e" },
  light: { name: "Light Birch", fill: "#ecd5bc" },
  plain_white: { name: "Clean White", fill: "#ffffff" },
  plain_black: { name: "Clean Black", fill: "#111111" }
};

/**
 * Renders a Scrabble crossword layout into a self-contained vector SVG string.
 */
export function renderSVG({
  layout,
  width: layoutWidth,
  height: layoutHeight,
  title = "Title",
  titleFont = "Alex Brush",
  titleSize = 40, // in mm
  titleX = 0, // offset in mm
  titleY = 0, // offset in mm
  size = "medium_portrait",
  background = "brown",
  tileStyle = "maple", // maple, walnut, cherry, white
  tileFont = "system", // system, english, french
  gridOffsetX = 0, // in mm
  gridOffsetY = 0, // in mm
  customTileSize = 0, // in mm (user override)
  isInteractive = false, // interactive handles toggle
  titleStyle = "white_blanc_default", // title fill texture style
  woodTextures = {}, // Base64 data URIs of wood patterns
  dividerType = "hearts"
}) {
  const board = BOARD_SIZES[size] || BOARD_SIZES.medium_portrait;
  const boardW = board.width;
  const boardH = board.height;

  // 1. Calculate grid scaling and margins
  const marginX = 25; // Minimum horizontal margin in mm
  const marginTop = 75; // Top margin to leave room for Title
  const marginBottom = 25; // Bottom margin in mm

  const availableW = boardW - 2 * marginX;
  const availableH = boardH - marginTop - marginBottom;

  // Determine tile size (user-override or calculated)
  let tileSize = customTileSize;
  if (!tileSize || tileSize <= 0) {
    const maxTileW = Math.floor(availableW / layoutWidth);
    const maxTileH = Math.floor(availableH / layoutHeight);
    tileSize = Math.min(maxTileW, maxTileH);
    tileSize = Math.max(12, Math.min(26, tileSize)); // Cap between 12mm and 26mm
  }

  // Total dimensions of the Scrabble crossword grid
  const gridW = layoutWidth * tileSize;
  const gridH = layoutHeight * tileSize;

  // Center the grid in the available area
  const gridStartX = marginX + (availableW - gridW) / 2 + gridOffsetX;
  const gridStartY = marginTop + (availableH - gridH) / 2 + gridOffsetY;

  // 2. Base64 background texture matching (supports new path format and old format)
  const bgTexture = woodTextures[`board_${background}`] || woodTextures[`wood_${background}`] || "";
  const tileTexture = woodTextures[`tile_${tileStyle}`] || woodTextures[`wood_tile_${tileStyle}`] || woodTextures["wood_tile"] || "";
  const titleTexture = titleStyle !== "none" ? (woodTextures[`title_${titleStyle}`] || "") : "";
  const tileTheme = TILE_THEMES[tileStyle] || TILE_THEMES.maple;
  
  // Custom font matching
  const customFontBase64 = tileFont !== "system" ? (woodTextures[`Scrabble_${tileFont}`] || woodTextures[tileFont] || "") : "";
  const customTitleFontBase64 = woodTextures[`titlefont_${titleFont}`] || "";

  // 3. Generate SVG elements
  let svg = `<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${boardW} ${boardH}" width="${boardW}mm" height="${boardH}mm" style="background-color: ${BACKGROUND_THEMES[background]?.fill || '#ffffff'};" data-tile-size="${tileSize}">
  <defs>
    <!-- Dynamic Font Import -->
    <style type="text/css">
      ${customTitleFontBase64 ? `
      @font-face {
        font-family: '${titleFont}';
        src: url('data:font/truetype;charset=utf-8;base64,${customTitleFontBase64}') format('truetype');
        font-weight: normal;
        font-style: normal;
      }
      ` : `
      @import url('https://fonts.googleapis.com/css2?family=${titleFont.replace(/\s+/g, '+')}&amp;display=swap');
      `}
      
      ${customFontBase64 ? `
      @font-face {
        font-family: 'ScrabbleTileFont';
        src: url('data:font/truetype;charset=utf-8;base64,${customFontBase64}') format('truetype');
        font-weight: normal;
        font-style: normal;
      }
      ` : ''}

      .title-text {
        font-family: '${titleFont}', cursive, serif;
        fill: ${titleTexture ? 'url(#title-bg-pattern)' : (background === 'dark' || background === 'plain_black' ? '#e5c19d' : '#331d10')};
        font-size: ${titleSize}px;
        text-anchor: middle;
        dominant-baseline: middle;
      }
      .divider-icon {
        fill: ${titleTexture ? 'url(#title-bg-pattern)' : (background === 'dark' || background === 'plain_black' ? '#e5c19d' : '#331d10')};
        opacity: 0.85;
      }
      .divider-line {
        stroke: ${titleTexture ? 'url(#title-bg-pattern)' : (background === 'dark' || background === 'plain_black' ? '#e5c19d' : '#331d10')};
        stroke-width: 0.4;
        opacity: 0.5;
        stroke-linecap: round;
      }
      .tile-letter {
        font-family: ${tileFont !== 'system' ? "'ScrabbleTileFont', " : ''}'Inter', 'Helvetica Neue', 'Arial', sans-serif;
        font-weight: ${tileFont !== 'system' ? 'normal' : '900'};
        fill: ${tileTheme.text};
      }
      .tile-score {
        font-family: 'Inter', 'Helvetica Neue', 'Arial', sans-serif;
        font-weight: 700;
        fill: ${tileTheme.score};
        opacity: 0.85;
        display: ${tileFont !== 'system' ? 'none' : 'block'};
      }
    </style>

    <!-- Realistic drop shadow filter for floating wood tiles -->
    <filter id="tile-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0.6" dy="0.8" stdDeviation="0.7" flood-color="#000000" flood-opacity="0.5" />
    </filter>

    ${bgTexture ? `
    <!-- Board Background Texture Pattern -->
    <pattern id="board-bg-pattern" width="100%" height="100%" patternUnits="userSpaceOnUse">
      <image href="${bgTexture}" x="0" y="0" width="${boardW}" height="${boardH}" preserveAspectRatio="none" />
    </pattern>
    ` : ''}

    ${tileTexture ? `
    <!-- Scrabble Tile Wood Texture Pattern -->
    <pattern id="tile-bg-pattern" width="1" height="1" patternContentUnits="objectBoundingBox">
      <image href="${tileTexture}" x="0" y="0" width="1" height="1" preserveAspectRatio="none" />
    </pattern>
    ` : ''}

    ${titleTexture ? `
    <!-- Title Background Texture Pattern -->
    <pattern id="title-bg-pattern" width="1" height="1" patternContentUnits="objectBoundingBox">
      <image href="${titleTexture}" x="0" y="0" width="1" height="1" preserveAspectRatio="none" />
    </pattern>
    ` : ''}
  </defs>

  <!-- 1. Board Background -->
  ${bgTexture ? `
  <rect x="0" y="0" width="${boardW}" height="${boardH}" fill="url(#board-bg-pattern)" />
  ` : `
  <rect x="0" y="0" width="${boardW}" height="${boardH}" fill="${BACKGROUND_THEMES[background]?.fill || '#ffffff'}" />
  `}

  <!-- Subtle inner border for premium framed look -->
  <rect x="5" y="5" width="${boardW - 10}" height="${boardH - 10}" fill="none" stroke="${background === 'dark' || background === 'plain_black' ? '#333333' : '#e5c19d'}" stroke-width="0.3" opacity="0.3" />

  <!-- 2. Board Title & Divider (Draggable Group) -->
  <g id="board-title-group" class="title-group" style="cursor: grab; pointer-events: auto;">
    <text x="${(boardW / 2) + titleX}" y="${35 + titleY}" class="title-text">${title}</text>
    ${renderDivider(dividerType, boardW / 2 + titleX, 35 + titleY + (titleSize / 2) + 3)}
  </g>

  <!-- 4. Crossword Scrabble Tiles Grid -->
  <g id="scrabble-grid">
  `;

  // Draw the tiles
  // Pre-aggregate grid cell values to render them cleanly
  const gridCells = {};
  if (Array.isArray(layout) && layout.length > 0 && layout[0].word === undefined && layout[0].char !== undefined) {
    // It's a list of tiles!
    layout.forEach(t => {
      gridCells[`${t.row},${t.col}`] = { char: t.char, score: t.score };
    });
  } else if (layout && layout.tiles) {
    // Wrapped list of tiles
    layout.tiles.forEach(t => {
      gridCells[`${t.row},${t.col}`] = { char: t.char, score: t.score };
    });
  } else if (Array.isArray(layout)) {
    // Standard words array
    layout.forEach(p => {
      for (let k = 0; k < p.word.length; k++) {
        const r = p.dir === 'H' ? p.row : p.row + k;
        const c = p.dir === 'H' ? p.col + k : p.col;
        gridCells[`${r},${c}`] = { char: p.word[k], score: SCRABBLE_SCORES[p.word[k]] || 1 };
      }
    });
  }

  // Render each unique tile
  Object.keys(gridCells).forEach(coord => {
    const [r, c] = coord.split(',').map(Number);
    const tileData = gridCells[coord];
    const char = tileData.char;
    const score = tileData.score;

    // Calculate physical tile position (in mm)
    const tileX = gridStartX + c * tileSize;
    const tileY = gridStartY + r * tileSize;

    // Tile spacing padding
    const pad = 0.5; // mm spacing between tiles
    const tileW = tileSize - 2 * pad;
    const rx = tileW * 0.08; // rounded corners proportional to tile size

    svg += `
    <!-- Tile ${char} at ${r},${c} -->
    <g class="tile-group" data-row="${r}" data-col="${c}" data-char="${char}" data-score="${score}" transform="translate(${tileX + pad}, ${tileY + pad})" filter="url(#tile-shadow)" style="cursor: grab; pointer-events: auto;">
      <!-- Wood Tile Block -->
      <rect x="0" y="0" width="${tileW}" height="${tileW}" rx="${rx}" ry="${rx}" 
            fill="${tileTexture ? 'url(#tile-bg-pattern)' : tileTheme.fillFallback}" 
            stroke="${tileTheme.border}" 
            stroke-width="0.35" />
      
      <!-- Subtle internal letter border/inset -->
      <rect x="0.6" y="0.6" width="${tileW - 1.2}" height="${tileW - 1.2}" rx="${rx - 0.2}" ry="${rx - 0.2}" 
            fill="none" stroke="#fff" stroke-width="0.2" opacity="0.3" />

      <!-- Center Letter -->
      <text x="${tileW / 2}" y="${tileFont !== 'system' ? (tileW / 2) : (tileW / 2 + (tileW * 0.08))}" 
            font-size="${tileFont !== 'system' ? (tileW * 0.95) : (tileW * 0.58)}" 
            text-anchor="middle" 
            dominant-baseline="middle" 
            class="tile-letter">${char}</text>

      <!-- Corner Score Point -->
      <text x="${tileW - (tileW * 0.16)}" y="${tileW - (tileW * 0.14)}" 
            font-size="${tileW * 0.16}" 
            text-anchor="end" 
            class="tile-score">${score}</text>

      ${isInteractive ? `
      <!-- Resize Handle in Bottom-Right Corner -->
      <g class="tile-resize-handle" style="cursor: se-resize; pointer-events: auto;">
        <rect x="${tileW - 4}" y="${tileW - 4}" width="4" height="4" fill="transparent" />
        <path d="M ${tileW - 3} ${tileW - 1} L ${tileW - 1} ${tileW - 1} L ${tileW - 1} ${tileW - 3} Z" fill="${tileTheme.border}" opacity="0.6" />
      </g>` : ''}
    </g>`;
  });

  svg += `
  </g>
</svg>
`;

  return svg;
}

/**
 * Helper to render different divider styles under the board title.
 */
function renderDivider(type, cx, cy) {
  if (type === "none") return "";
  
  if (type === "line") {
    return `<line x1="${cx - 25}" y1="${cy}" x2="${cx + 25}" y2="${cy}" class="divider-line" />`;
  }

  if (type === "hearts") {
    return `
      <!-- Line with Heart -->
      <line x1="${cx - 25}" y1="${cy}" x2="${cx - 4}" y2="${cy}" class="divider-line" />
      <path d="M ${cx} ${cy - 1.2} A 0.9 0.9 0 0 0 ${cx - 1.25} ${cy - 2} A 0.9 0.9 0 0 0 ${cx - 2.5} ${cy - 1.2} C ${cx - 2.5} ${cy - 0.4} ${cx - 1.25} ${cy + 0.6} ${cx} ${cy + 1.6} C ${cx + 1.25} ${cy + 0.6} ${cx + 2.5} ${cy - 0.4} ${cx + 2.5} ${cy - 1.2} A 0.9 0.9 0 0 0 ${cx + 1.25} ${cy - 2} A 0.9 0.9 0 0 0 ${cx} ${cy - 1.2} Z" class="divider-icon" />
      <line x1="${cx + 4}" y1="${cy}" x2="${cx + 25}" y2="${cy}" class="divider-line" />
    `;
  }

  if (type === "stars") {
    return `
      <!-- Line with Star -->
      <line x1="${cx - 25}" y1="${cy}" x2="${cx - 4}" y2="${cy}" class="divider-line" />
      <polygon points="${cx},${cy - 2.2} ${cx + 0.6},${cy - 0.7} ${cx + 2.2},${cy - 0.7} ${cx + 0.9},${cy + 0.2} ${cx + 1.4},${cy + 1.7} ${cx},${cy + 0.8} ${cx - 1.4},${cy + 1.7} ${cx - 0.9},${cy + 0.2} ${cx - 2.2},${cy - 0.7} ${cx - 0.6},${cy - 0.7}" class="divider-icon" />
      <line x1="${cx + 4}" y1="${cy}" x2="${cx + 25}" y2="${cy}" class="divider-line" />
    `;
  }

  if (type === "classic") {
    return `
      <!-- Classic Scroll Swirl Divider -->
      <line x1="${cx - 30}" y1="${cy}" x2="${cx - 5}" y2="${cy}" class="divider-line" />
      <circle cx="${cx}" cy="${cy}" r="1.2" class="divider-icon" />
      <circle cx="${cx - 3.5}" cy="${cy}" r="0.7" class="divider-icon" opacity="0.7" />
      <circle cx="${cx + 3.5}" cy="${cy}" r="0.7" class="divider-icon" opacity="0.7" />
      <line x1="${cx + 5}" y1="${cy}" x2="${cx + 30}" y2="${cy}" class="divider-line" />
    `;
  }

  return "";
}
