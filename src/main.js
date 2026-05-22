import { generateCrosswordLayouts } from './generator.js';
import { renderSVG, BOARD_SIZES } from './svg-renderer.js';

// App State
let appState = {
  layouts: [],
  currentIndex: 0,
  gridOffsetX: 0,
  gridOffsetY: 0,
  customTileSize: 0,
  fonts_titles: [],
  textures: {
    wood_brown: "",
    wood_dark: "",
    wood_light: "",
    wood_tile: "",
    wood_tile_maple: "",
    wood_tile_walnut: "",
    wood_tile_cherry: "",
    wood_tile_white: "",
    Scrabble_english: "",
    Scrabble_french: ""
  }
};

// Accented-character-safe Base64url Encoder (UTF-8 safe)
function encodeConfig(config) {
  const jsonStr = JSON.stringify(config);
  const utf8Bytes = new TextEncoder().encode(jsonStr);
  let binary = "";
  for (let i = 0; i < utf8Bytes.byteLength; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Saves active configuration and UI offsets to LocalStorage
function saveStateToLocalStorage() {
  const config = getCurrentConfig();
  const stateToSave = {
    namesText: document.getElementById('names-input').value,
    title: config.title,
    titleFont: config.titleFont,
    titleSize: config.titleSize,
    titleX: config.titleX,
    titleY: config.titleY,
    size: config.size,
    background: config.background,
    tileStyle: config.tileStyle,
    titleStyle: config.titleStyle,
    tileFont: config.tileFont,
    dividerType: config.dividerType,
    dividerSize: config.dividerSize,
    currentIndex: appState.currentIndex,
    gridOffsetX: appState.gridOffsetX,
    gridOffsetY: appState.gridOffsetY,
    customTileSize: appState.customTileSize
  };
  try {
    localStorage.setItem('scrabble_session_state', JSON.stringify(stateToSave));
  } catch (err) {
    console.warn("Could not save state to localStorage:", err);
  }
}

// Restores active configuration and offsets from LocalStorage or URL parameters
async function loadStateFromLocalStorageOrUrl() {
  let loadedState = null;

  // 1. Try to load from URL first
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (code) {
    try {
      let base64 = code.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) {
        base64 += '=';
      }
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const jsonStr = new TextDecoder().decode(bytes);
      const config = JSON.parse(jsonStr);

      if (config) {
        loadedState = {
          namesText: Array.isArray(config.names) ? config.names.join(', ') : "",
          title: config.title || "Our Family",
          titleFont: config.titleFont || "Alex Brush",
          titleSize: config.titleSize || 40,
          titleX: config.titleX || 0,
          titleY: config.titleY || 0,
          size: config.size || "square",
          background: config.background || "brown",
          tileStyle: config.tileStyle || "maple",
          titleStyle: config.titleStyle || "white_blanc_default",
          tileFont: config.tileFont || "english",
          dividerType: config.dividerType || "hearts",
          dividerSize: config.dividerSize || 1.0,
          currentIndex: config.layoutIndex || 0,
          gridOffsetX: 0,
          gridOffsetY: 0,
          customTileSize: 0
        };
        // Clean URL to avoid infinite reloading or confusion
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (e) {
      console.warn("Failed to decode URL config:", e);
    }
  }

  // 2. If not loaded from URL, try LocalStorage
  if (!loadedState) {
    try {
      const saved = localStorage.getItem('scrabble_session_state');
      if (saved) {
        loadedState = JSON.parse(saved);
      }
    } catch (e) {
      console.warn("Failed to load state from localStorage:", e);
    }
  }

  // 3. Apply loaded state to UI elements
  if (loadedState) {
    if (loadedState.namesText !== undefined) {
      document.getElementById('names-input').value = loadedState.namesText;
    }
    if (loadedState.title !== undefined) {
      document.getElementById('board-title-input').value = loadedState.title;
    }
    if (loadedState.titleSize !== undefined) {
      document.getElementById('title-size').value = loadedState.titleSize;
    }
    if (loadedState.titleX !== undefined) {
      document.getElementById('title-x-offset').value = loadedState.titleX;
    }
    if (loadedState.titleY !== undefined) {
      document.getElementById('title-y-offset').value = loadedState.titleY;
    }

    const setSelect = (id, val) => {
      const select = document.getElementById(id);
      if (select) {
        select.value = val;
      }
    };

    if (loadedState.size !== undefined) setSelect('board-size', loadedState.size);
    if (loadedState.background !== undefined) setSelect('board-background', loadedState.background);
    if (loadedState.tileStyle !== undefined) setSelect('tile-texture', loadedState.tileStyle);
    if (loadedState.titleStyle !== undefined) setSelect('title-texture', loadedState.titleStyle);
    if (loadedState.tileFont !== undefined) setSelect('tile-font-style', loadedState.tileFont);
    if (loadedState.dividerType !== undefined) setSelect('divider-type', loadedState.dividerType);
    if (loadedState.dividerSize !== undefined) {
      const divSizeInput = document.getElementById('divider-size');
      if (divSizeInput) divSizeInput.value = loadedState.dividerSize;
    }
    if (loadedState.titleFont !== undefined) setSelect('title-font', loadedState.titleFont);

    appState.currentIndex = loadedState.currentIndex || 0;
    appState.gridOffsetX = loadedState.gridOffsetX || 0;
    appState.gridOffsetY = loadedState.gridOffsetY || 0;
    appState.customTileSize = loadedState.customTileSize || 0;

    if (loadedState.titleFont) {
      await ensureTitleFontLoaded(loadedState.titleFont);
    }

    return true;
  }

  return false;
}

// Pre-fetch wood textures and convert to Base64 data URIs dynamically
async function preloadTextures() {
  let options = { board: [], tiles: [], title: [], fonts: [], fonts_titles: [] };
  try {
    const res = await fetch('/api/options');
    if (res.ok) {
      options = await res.json();
    }
  } catch (err) {
    console.error("Failed to load options from backend:", err);
    // fallback defaults
    options = {
      board: ['brown', 'dark', 'light'],
      tiles: ['maple', 'walnut', 'cherry', 'white'],
      title: [],
      fonts: ['english', 'french'],
      fonts_titles: []
    };
  }

  // Store title fonts in appState
  appState.fonts_titles = options.fonts_titles || [];

  // Populate Dropdown Boxes
  const boardSelect = document.getElementById('board-background');
  if (boardSelect) {
    boardSelect.innerHTML = '';
    options.board.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      const displayName = name.split('_')[0];
      opt.textContent = displayName.charAt(0).toUpperCase() + displayName.slice(1);
      if (name.toLowerCase().includes('default') || name === 'brown') {
        opt.selected = true;
      }
      boardSelect.appendChild(opt);
    });
    ['plain_white', 'plain_black'].forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name === 'plain_white' ? 'Clean Matte White' : 'Clean Matte Black';
      boardSelect.appendChild(opt);
    });
  }

  const tileSelect = document.getElementById('tile-texture');
  if (tileSelect) {
    tileSelect.innerHTML = '';
    options.tiles.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      const displayName = name.split('_')[0];
      opt.textContent = displayName.charAt(0).toUpperCase() + displayName.slice(1);
      if (name.toLowerCase().includes('default') || name === 'maple') {
        opt.selected = true;
      }
      tileSelect.appendChild(opt);
    });
  }

  const titleSelect = document.getElementById('title-texture');
  if (titleSelect) {
    titleSelect.innerHTML = '';
    const noneOpt = document.createElement('option');
    noneOpt.value = 'none';
    noneOpt.textContent = 'Solid Color (No Texture)';
    titleSelect.appendChild(noneOpt);
    
    let hasDefaultTitle = false;
    options.title.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      const displayName = name.split('_')[0];
      opt.textContent = displayName.charAt(0).toUpperCase() + displayName.slice(1);
      if (name.toLowerCase().includes('default')) {
        opt.selected = true;
        hasDefaultTitle = true;
      }
      titleSelect.appendChild(opt);
    });
    
    if (!hasDefaultTitle) {
      noneOpt.selected = true;
    }
  }

  const fontSelect = document.getElementById('tile-font-style');
  if (fontSelect) {
    fontSelect.innerHTML = '';
    options.fonts.forEach((name, idx) => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = `Scrabble ${name.charAt(0).toUpperCase() + name.slice(1)} Font (Built-in Points)`;
      if (idx === 0) {
        opt.selected = true;
      }
      fontSelect.appendChild(opt);
    });
  }

  // Populate title font select dynamically
  const titleFontSelect = document.getElementById('title-font');
  if (titleFontSelect) {
    const defaultGoogleFonts = [
      "Alex Brush",
      "Dancing Script",
      "Great Vibes",
      "Parisienne",
      "Sacramento",
      "Satisfy",
      "Playfair Display",
      "Cinzel",
      "Cormorant Garamond"
    ];
    
    titleFontSelect.innerHTML = '';
    
    // Standard Google Fonts Group
    const googleGroup = document.createElement('optgroup');
    googleGroup.label = "Standard Google Fonts";
    defaultGoogleFonts.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      if (name === 'Alex Brush') {
        opt.selected = true;
      }
      googleGroup.appendChild(opt);
    });
    titleFontSelect.appendChild(googleGroup);
    
    // Custom Uploaded Fonts Group
    if (options.fonts_titles && options.fonts_titles.length > 0) {
      const customGroup = document.createElement('optgroup');
      customGroup.label = "Custom Uploaded Fonts";
      options.fonts_titles.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        customGroup.appendChild(opt);
      });
      titleFontSelect.appendChild(customGroup);
    }
  }

  // Clear existing textures cache on load
  appState.textures = {};

  const promises = [];

  // Load board textures
  options.board.forEach(name => {
    promises.push((async () => {
      try {
        const res = await fetch(`/textures/board/${name}.png`);
        if (!res.ok) throw new Error();
        const blob = await res.blob();
        appState.textures[`board_${name}`] = await blobToBase64(blob);
      } catch (err) {
        console.warn(`Failed to preload board texture: ${name}`);
      }
    })());
  });

  // Load tile textures
  options.tiles.forEach(name => {
    promises.push((async () => {
      try {
        const res = await fetch(`/textures/tiles/${name}.png`);
        if (!res.ok) throw new Error();
        const blob = await res.blob();
        appState.textures[`tile_${name}`] = await blobToBase64(blob);
      } catch (err) {
        console.warn(`Failed to preload tile texture: ${name}`);
      }
    })());
  });

  // Load title textures
  options.title.forEach(name => {
    promises.push((async () => {
      try {
        const res = await fetch(`/textures/title/${name}.png`);
        if (!res.ok) throw new Error();
        const blob = await res.blob();
        appState.textures[`title_${name}`] = await blobToBase64(blob);
      } catch (err) {
        console.warn(`Failed to preload title texture: ${name}`);
      }
    })());
  });

  // Load custom fonts
  options.fonts.forEach(name => {
    promises.push((async () => {
      try {
        let res = await fetch(`/font_tiles/Scrabble_${name}.ttf`);
        if (!res.ok) {
          res = await fetch(`/font_tiles/Scrabble_${name}.otf`);
        }
        if (!res.ok) throw new Error();
        const blob = await res.blob();
        const dataUrl = await blobToBase64(blob);
        const base64Str = dataUrl.split(',')[1];
        appState.textures[`Scrabble_${name}`] = base64Str;
      } catch (err) {
        console.warn(`Failed to preload font: ${name}`);
      }
    })());
  });

  await Promise.all(promises);
  
  // Preload default title font if set
  if (titleFontSelect && titleFontSelect.value) {
    await ensureTitleFontLoaded(titleFontSelect.value);
  }
  
  console.log("All dynamic options pre-loaded.");
}

// Helper to convert blob to base64
function blobToBase64(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

// Helper to inject font-face rule to browser dynamically
function injectFontFaceToBrowser(fontName, dataUrl) {
  const styleId = `font-face-${fontName.replace(/\s+/g, '-')}`;
  if (document.getElementById(styleId)) return;
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    @font-face {
      font-family: '${fontName}';
      src: url('${dataUrl}') format('truetype');
      font-weight: normal;
      font-style: normal;
    }
  `;
  document.head.appendChild(style);
}

// Ensure dynamic title font is loaded as base64 in textures and register it in browser
async function ensureTitleFontLoaded(fontName) {
  if (!fontName || fontName === 'system') return;
  if (!appState.fonts_titles.includes(fontName)) return; // not a dynamic title font
  
  const key = `titlefont_${fontName}`;
  if (appState.textures[key]) return; // already loaded

  try {
    let res = await fetch(`/fonts_titles/${fontName}.ttf`);
    if (!res.ok) {
      res = await fetch(`/fonts_titles/${fontName}.otf`);
    }
    if (!res.ok) throw new Error();
    const blob = await res.blob();
    const dataUrl = await blobToBase64(blob);
    const base64Str = dataUrl.split(',')[1];
    appState.textures[key] = base64Str;
    
    // Inject into browser for preview rendering
    injectFontFaceToBrowser(fontName, dataUrl);
  } catch (err) {
    console.warn(`Failed to dynamically load title font: ${fontName}`, err);
  }
}

// Grab current config values from UI
function getCurrentConfig() {
  const namesText = document.getElementById('names-input').value;
  const names = namesText
    .split(/[\n,\s]+/) // split by newlines, commas, or spaces
    .map(n => n.trim())
    .filter(n => n.length > 0);

  return {
    names,
    title: document.getElementById('board-title-input').value || "Our Family",
    titleFont: document.getElementById('title-font').value,
    titleSize: parseFloat(document.getElementById('title-size').value) || 40,
    titleX: parseFloat(document.getElementById('title-x-offset').value) || 0,
    titleY: parseFloat(document.getElementById('title-y-offset').value) || 0,
    size: document.getElementById('board-size').value,
    background: document.getElementById('board-background').value,
    tileStyle: document.getElementById('tile-texture').value,
    titleStyle: document.getElementById('title-texture').value,
    tileFont: document.getElementById('tile-font-style').value,
    dividerType: document.getElementById('divider-type').value,
    dividerSize: parseFloat(document.getElementById('divider-size').value) || 1.0,
    layoutIndex: appState.currentIndex
  };
}

// Generate layouts and render result
function handleGenerate(keepIndex = false) {
  const config = getCurrentConfig();
  
  if (config.names.length === 0) {
    showPlaceholder("Please enter at least one name to generate a board.");
    return;
  }

  // Generate crossword layouts
  const generated = generateCrosswordLayouts(config.names);
  
  if (generated.length === 0) {
    showPlaceholder("No valid layout found. Make sure all names share at least one intersecting letter with the other names.");
    appState.layouts = [];
    appState.currentIndex = 0;
    updateNavigationUI();
    return;
  }

  appState.layouts = generated;
  
  if (!keepIndex) {
    appState.currentIndex = 0;
    appState.gridOffsetX = 0;
    appState.gridOffsetY = 0;
    appState.customTileSize = 0;
  } else {
    // bound check in case layout list size changed
    if (appState.currentIndex >= generated.length) {
      appState.currentIndex = 0;
    }
  }
  
  renderCurrentLayout();
  updateNavigationUI();
}

// Render currently selected layout to screen SVG
async function renderCurrentLayout() {
  if (appState.layouts.length === 0) return;

  const config = getCurrentConfig();
  
  // Ensure the selected title font is loaded
  await ensureTitleFontLoaded(config.titleFont);

  const activeLayout = appState.layouts[appState.currentIndex];
  
  // 1. Update aspect-ratio and width based on size
  const boardFrame = document.getElementById('board-canvas');
  const sizeKey = config.size;
  const sizeObj = BOARD_SIZES[sizeKey];

  if (sizeObj) {
    boardFrame.style.aspectRatio = `${sizeObj.width} / ${sizeObj.height}`;
    if (sizeKey === 'landscape') {
      boardFrame.style.width = '480px';
    } else if (sizeKey === 'square') {
      boardFrame.style.width = '420px';
    } else {
      boardFrame.style.width = '350px';
    }
  }

  // 2. Render SVG string
  const svgString = renderSVG({
    layout: activeLayout.tiles || activeLayout.layout,
    width: activeLayout.width,
    height: activeLayout.height,
    title: config.title,
    titleFont: config.titleFont,
    titleSize: config.titleSize,
    titleX: config.titleX,
    titleY: config.titleY,
    size: config.size,
    background: config.background,
    tileStyle: config.tileStyle,
    titleStyle: config.titleStyle,
    tileFont: config.tileFont,
    gridOffsetX: appState.gridOffsetX,
    gridOffsetY: appState.gridOffsetY,
    customTileSize: appState.customTileSize,
    isInteractive: true,
    woodTextures: appState.textures,
    dividerType: config.dividerType,
    dividerSize: config.dividerSize
  });

  // 3. Inject into Canvas container
  boardFrame.innerHTML = svgString;

  // 4. Update stats badges
  document.getElementById('board-grid-size').textContent = `Grid: ${activeLayout.width}x${activeLayout.height}`;
  document.getElementById('board-dimension-label').textContent = `Size: ${sizeObj.label.split(' - ')[0]}`;
}

// Show message placeholder in the canvas
function showPlaceholder(message) {
  const boardFrame = document.getElementById('board-canvas');
  boardFrame.style.aspectRatio = '1 / 1';
  boardFrame.style.width = '420px';
  boardFrame.innerHTML = `
    <div class="canvas-placeholder">
      <svg class="placeholder-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <p>${message}</p>
    </div>
  `;
  document.getElementById('board-grid-size').textContent = `Grid: 0x0`;
  document.getElementById('board-dimension-label').textContent = `Size: Square`;
}

// Update previous/next layout buttons and counts
function updateNavigationUI() {
  const total = appState.layouts.length;
  const prevBtn = document.getElementById('btn-prev');
  const nextBtn = document.getElementById('btn-next');
  const indicator = document.getElementById('layout-indicator');

  if (total === 0) {
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    indicator.textContent = "Layout 0 of 0";
    return;
  }

  indicator.textContent = `Layout ${appState.currentIndex + 1} of ${total}`;
  prevBtn.disabled = appState.currentIndex === 0;
  nextBtn.disabled = appState.currentIndex === total - 1;
}

// Copies Base64 production code to clipboard
function handleCopyCode() {
  if (appState.layouts.length === 0) {
    showToast("Please generate a layout first!", true);
    return;
  }

  const config = getCurrentConfig();
  
  // Generate code token
  const code = encodeConfig(config);
  
  navigator.clipboard.writeText(code).then(() => {
    showToast("Production Code copied to clipboard!");
  }).catch(err => {
    console.error("Clipboard copy failed:", err);
    showToast("Failed to copy code.", true);
  });
}

// Download SVG file directly
async function handleDownloadSVG() {
  const svgElement = document.querySelector('#board-canvas svg');
  if (!svgElement) {
    showToast("Please generate a board first!", true);
    return;
  }

  const config = getCurrentConfig();
  await ensureTitleFontLoaded(config.titleFont);
  const activeLayout = appState.layouts[appState.currentIndex];

  const svgString = renderSVG({
    layout: activeLayout.tiles || activeLayout.layout,
    width: activeLayout.width,
    height: activeLayout.height,
    title: config.title,
    titleFont: config.titleFont,
    titleSize: config.titleSize,
    titleX: config.titleX,
    titleY: config.titleY,
    size: config.size,
    background: config.background,
    tileStyle: config.tileStyle,
    titleStyle: config.titleStyle,
    tileFont: config.tileFont,
    gridOffsetX: appState.gridOffsetX,
    gridOffsetY: appState.gridOffsetY,
    customTileSize: appState.customTileSize,
    isInteractive: false,
    woodTextures: appState.textures,
    dividerType: config.dividerType,
    dividerSize: config.dividerSize
  });

  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const blobURL = URL.createObjectURL(blob);
  
  const filename = `${config.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.svg`;
  const link = document.createElement('a');
  link.href = blobURL;
  link.download = filename;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(blobURL);
  
  showToast("SVG download started.");
}

// Render SVG onto high-resolution Canvas to download as PNG
async function handleDownloadPNG() {
  const svgElement = document.querySelector('#board-canvas svg');
  if (!svgElement) {
    showToast("Please generate a board first!", true);
    return;
  }

  const config = getCurrentConfig();
  await ensureTitleFontLoaded(config.titleFont);
  const activeLayout = appState.layouts[appState.currentIndex];

  // Re-render SVG to standard string
  const svgString = renderSVG({
    layout: activeLayout.tiles || activeLayout.layout,
    width: activeLayout.width,
    height: activeLayout.height,
    title: config.title,
    titleFont: config.titleFont,
    titleSize: config.titleSize,
    titleX: config.titleX,
    titleY: config.titleY,
    size: config.size,
    background: config.background,
    tileStyle: config.tileStyle,
    titleStyle: config.titleStyle,
    tileFont: config.tileFont,
    gridOffsetX: appState.gridOffsetX,
    gridOffsetY: appState.gridOffsetY,
    customTileSize: appState.customTileSize,
    isInteractive: false,
    woodTextures: appState.textures,
    dividerType: config.dividerType,
    dividerSize: config.dividerSize
  });

  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const URLObj = window.URL || window.webkitURL || window;
  const blobURL = URLObj.createObjectURL(svgBlob);

  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement('canvas');
    // Render at ultra high-res (2400px height for prints)
    const targetHeight = 2400;
    const scale = targetHeight / svgElement.viewBox.baseVal.height;
    
    canvas.width = svgElement.viewBox.baseVal.width * scale;
    canvas.height = targetHeight;

    const context = canvas.getContext('2d');
    
    // Draw wood grain image onto the canvas context
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const pngURL = canvas.toDataURL('image/png');
    const filename = `${config.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.png`;
    
    const link = document.createElement('a');
    link.href = pngURL;
    link.download = filename;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URLObj.revokeObjectURL(blobURL);
    
    showToast("PNG download started.");
  };
  
  image.onerror = (err) => {
    console.error("Failed to load SVG into image for canvas drawing:", err);
    showToast("Failed to render PNG.", true);
    URLObj.revokeObjectURL(blobURL);
  };
  
  image.src = blobURL;
}

// Show temporary toast message
function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.style.background = isError ? '#ef4444' : '#10b981';
  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 2500);
}

// Bind all UI change event listeners for live updates
function setupEventListeners() {
  // Input fields changes live-update the SVG canvas
  const liveInputs = [
    'board-size',
    'board-title-input',
    'title-font',
    'title-size',
    'title-x-offset',
    'title-y-offset',
    'divider-type',
    'divider-size',
    'board-background',
    'tile-texture',
    'tile-font-style',
    'drag-mode-select'
  ];

  liveInputs.forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
      renderCurrentLayout();
      saveStateToLocalStorage();
    });
    // Use input event for sliders or text fields to update instantly as typing
    if (id === 'board-title-input' || id.includes('offset') || id === 'title-size' || id === 'divider-size') {
      document.getElementById(id).addEventListener('input', () => {
        renderCurrentLayout();
        saveStateToLocalStorage();
      });
    }
  });

  // Buttons
  document.getElementById('btn-generate').addEventListener('click', () => {
    handleGenerate();
    saveStateToLocalStorage();
  });
  document.getElementById('btn-copy-code').addEventListener('click', handleCopyCode);
  document.getElementById('btn-download-svg').addEventListener('click', handleDownloadSVG);
  document.getElementById('btn-download-png').addEventListener('click', handleDownloadPNG);
  document.getElementById('btn-reset-layout').addEventListener('click', handleResetLocation);

  // Pagination navigation
  document.getElementById('btn-prev').addEventListener('click', () => {
    if (appState.currentIndex > 0) {
      appState.currentIndex--;
      appState.gridOffsetX = 0;
      appState.gridOffsetY = 0;
      renderCurrentLayout();
      updateNavigationUI();
      saveStateToLocalStorage();
    }
  });

  document.getElementById('btn-next').addEventListener('click', () => {
    if (appState.currentIndex < appState.layouts.length - 1) {
      appState.currentIndex++;
      appState.gridOffsetX = 0;
      appState.gridOffsetY = 0;
      renderCurrentLayout();
      updateNavigationUI();
      saveStateToLocalStorage();
    }
  });

  // Keydown shortcuts
  document.addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowLeft') {
      document.getElementById('btn-prev').click();
    } else if (e.key === 'ArrowRight') {
      document.getElementById('btn-next').click();
    }
  });

  // Pointer Drag-and-Drop Variables
  let isDragging = false;
  let isDraggingTitle = false;
  let isResizingTiles = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let initialGridOffsetX = 0;
  let initialGridOffsetY = 0;
  let initialTitleX = 0;
  let initialTitleY = 0;
  let initialTileSize = 20;
  let dragOffsetTitleX = 0;
  let dragOffsetTitleY = 0;
  let draggedTileElement = null;
  let draggedTileData = null;
  let dragOffsetMouseX = 0;
  let dragOffsetMouseY = 0;

  const boardFrame = document.getElementById('board-canvas');

  boardFrame.addEventListener('pointerdown', (e) => {
    const resizeHandle = e.target.closest('.tile-resize-handle');
    const titleGroup = e.target.closest('.title-group');
    const tileGroup = e.target.closest('.tile-group');
    const modeSelect = document.getElementById('drag-mode-select');
    const mode = modeSelect ? modeSelect.value : "grid";
    
    if (resizeHandle) {
      isDragging = true;
      isResizingTiles = true;
      isDraggingTitle = false;
      draggedTileElement = null;
      
      const svgElement = boardFrame.querySelector('svg');
      initialTileSize = parseFloat(svgElement.getAttribute('data-tile-size')) || 20;
      
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragOffsetMouseX = 0;
      dragOffsetMouseY = 0;
      
      e.preventDefault();
      e.stopPropagation();
    } else if (titleGroup) {
      isDragging = true;
      isDraggingTitle = true;
      isResizingTiles = false;
      draggedTileElement = null;
      
      initialTitleX = parseFloat(document.getElementById('title-x-offset').value) || 0;
      initialTitleY = parseFloat(document.getElementById('title-y-offset').value) || 0;
      titleGroup.style.cursor = 'grabbing';
      
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragOffsetTitleX = 0;
      dragOffsetTitleY = 0;
      
      e.preventDefault();
    } else if (mode === "tile" && tileGroup) {
      isDragging = true;
      isDraggingTitle = false;
      isResizingTiles = false;
      draggedTileElement = tileGroup;
      
      const r = parseInt(tileGroup.getAttribute('data-row'));
      const c = parseInt(tileGroup.getAttribute('data-col'));
      const char = tileGroup.getAttribute('data-char');
      const score = parseInt(tileGroup.getAttribute('data-score'));
      
      draggedTileData = { row: r, col: c, char, score };
      tileGroup.style.cursor = 'grabbing';
      
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragOffsetMouseX = 0;
      dragOffsetMouseY = 0;
      
      e.preventDefault();
    } else {
      isDragging = true;
      isDraggingTitle = false;
      isResizingTiles = false;
      draggedTileElement = null;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      initialGridOffsetX = appState.gridOffsetX || 0;
      initialGridOffsetY = appState.gridOffsetY || 0;
      
      boardFrame.style.cursor = 'grabbing';
      e.preventDefault();
    }
  });

  document.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    
    if (isResizingTiles) {
      const svgElement = boardFrame.querySelector('svg');
      if (svgElement) {
        const rect = svgElement.getBoundingClientRect();
        const viewBoxW = svgElement.viewBox.baseVal.width;
        const scaleX = viewBoxW / rect.width;
        
        const deltaX = dx * scaleX;
        appState.customTileSize = Math.max(8, Math.min(60, initialTileSize + deltaX));
        
        renderCurrentLayout();
      }
    } else if (isDraggingTitle) {
      const svgElement = boardFrame.querySelector('svg');
      if (svgElement) {
        const rect = svgElement.getBoundingClientRect();
        const viewBoxW = svgElement.viewBox.baseVal.width;
        const viewBoxH = svgElement.viewBox.baseVal.height;
        const scaleX = viewBoxW / rect.width;
        const scaleY = viewBoxH / rect.height;
        
        dragOffsetTitleX = dx * scaleX;
        dragOffsetTitleY = dy * scaleY;
        
        const titleGroup = boardFrame.querySelector('#board-title-group');
        if (titleGroup) {
          titleGroup.setAttribute('transform', `translate(${dragOffsetTitleX}, ${dragOffsetTitleY})`);
        }
      }
    } else if (draggedTileElement) {
      const svgElement = boardFrame.querySelector('svg');
      if (svgElement) {
        const rect = svgElement.getBoundingClientRect();
        const viewBoxW = svgElement.viewBox.baseVal.width;
        const viewBoxH = svgElement.viewBox.baseVal.height;
        const scaleX = viewBoxW / rect.width;
        const scaleY = viewBoxH / rect.height;
        
        dragOffsetMouseX = dx * scaleX;
        dragOffsetMouseY = dy * scaleY;
        
        const baseTransform = draggedTileElement.getAttribute('transform') || "";
        let initialTransform = draggedTileElement.getAttribute('data-initial-transform');
        if (!initialTransform) {
          initialTransform = baseTransform;
          draggedTileElement.setAttribute('data-initial-transform', initialTransform);
        }
        
        draggedTileElement.setAttribute('transform', `${initialTransform} translate(${dragOffsetMouseX}, ${dragOffsetMouseY})`);
      }
    } else {
      const svgElement = boardFrame.querySelector('svg');
      if (svgElement) {
        const rect = svgElement.getBoundingClientRect();
        const viewBoxW = svgElement.viewBox.baseVal.width;
        const viewBoxH = svgElement.viewBox.baseVal.height;
        const scaleX = viewBoxW / rect.width;
        const scaleY = viewBoxH / rect.height;
        
        appState.gridOffsetX = initialGridOffsetX + dx * scaleX;
        appState.gridOffsetY = initialGridOffsetY + dy * scaleY;
        
        renderCurrentLayout();
      }
    }
  });

  document.addEventListener('pointerup', (e) => {
    if (!isDragging) return;
    isDragging = false;
    
    if (isResizingTiles) {
      isResizingTiles = false;
      renderCurrentLayout();
    } else if (isDraggingTitle) {
      isDraggingTitle = false;
      const titleGroup = boardFrame.querySelector('#board-title-group');
      if (titleGroup) {
        titleGroup.style.cursor = 'grab';
      }
      
      const newX = Math.round(initialTitleX + dragOffsetTitleX);
      const newY = Math.round(initialTitleY + dragOffsetTitleY);
      
      document.getElementById('title-x-offset').value = newX;
      document.getElementById('title-y-offset').value = newY;
      
      renderCurrentLayout();
    } else if (draggedTileElement) {
      draggedTileElement.style.cursor = 'grab';
      draggedTileElement.removeAttribute('data-initial-transform');
      
      const SCRABBLE_SCORES = {
        A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3,
        N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10
      };
      
      const activeLayout = appState.layouts[appState.currentIndex];
      if (activeLayout) {
        if (!activeLayout.tiles) {
          activeLayout.tiles = [];
          activeLayout.layout.forEach(p => {
            for (let k = 0; k < p.word.length; k++) {
              const r = p.dir === 'H' ? p.row : p.row + k;
              const c = p.dir === 'H' ? p.col + k : p.col;
              if (!activeLayout.tiles.some(t => t.row === r && t.col === c)) {
                activeLayout.tiles.push({
                  char: p.word[k],
                  row: r,
                  col: c,
                  score: SCRABBLE_SCORES[p.word[k]] || 1
                });
              }
            }
          });
        }
        
        const board = BOARD_SIZES[getCurrentConfig().size] || BOARD_SIZES.medium_portrait;
        const boardW = board.width;
        const boardH = board.height;
        const marginX = 25;
        const marginTop = 75;
        const marginBottom = 25;
        const availableW = boardW - 2 * marginX;
        const availableH = boardH - marginTop - marginBottom;
        const maxTileW = Math.floor(availableW / activeLayout.width);
        const maxTileH = Math.floor(availableH / activeLayout.height);
        let tileSize = appState.customTileSize || Math.min(maxTileW, maxTileH);
        if (!appState.customTileSize) {
          tileSize = Math.max(12, Math.min(26, tileSize));
        }
        
        const deltaCol = Math.round(dragOffsetMouseX / tileSize);
        const deltaRow = Math.round(dragOffsetMouseY / tileSize);
        
        if (deltaCol !== 0 || deltaRow !== 0) {
          const tIndex = activeLayout.tiles.findIndex(t => t.row === draggedTileData.row && t.col === draggedTileData.col);
          if (tIndex !== -1) {
            const targetRow = draggedTileData.row + deltaRow;
            const targetCol = draggedTileData.col + deltaCol;
            
            const isOccupied = activeLayout.tiles.some((t, idx) => idx !== tIndex && t.row === targetRow && t.col === targetCol);
            
            if (!isOccupied) {
              activeLayout.tiles[tIndex].row = targetRow;
              activeLayout.tiles[tIndex].col = targetCol;
            } else {
              showToast("Cell already occupied!", true);
            }
          }
        }
      }
      
      draggedTileElement = null;
      draggedTileData = null;
      renderCurrentLayout();
    } else {
      boardFrame.style.cursor = 'grab';
    }
    
    saveStateToLocalStorage();
  });
}

// Reset all user panning offsets and manually dragged positions
function handleResetLocation() {
  appState.gridOffsetX = 0;
  appState.gridOffsetY = 0;
  appState.customTileSize = 0;
  
  const titleX = document.getElementById('title-x-offset');
  const titleY = document.getElementById('title-y-offset');
  if (titleX) titleX.value = 0;
  if (titleY) titleY.value = 0;
  
  if (appState.layouts && appState.layouts[appState.currentIndex]) {
    const activeLayout = appState.layouts[appState.currentIndex];
    delete activeLayout.tiles;
  }
  
  renderCurrentLayout();
  saveStateToLocalStorage();
  showToast("Layout positions and offsets reset successfully!");
}

// App Startup
async function init() {
  console.log("Initializing Scrabble Crossword Generator...");
  setupEventListeners();
  
  // Set default names in textarea (fallback)
  document.getElementById('names-input').value = "Jonathan, Julie, Steve, Samuel";
  
  // Load textures and dynamic options
  await preloadTextures();
  
  // Load session state from LocalStorage or URL (returns true if loaded from session)
  const hasSavedState = await loadStateFromLocalStorageOrUrl();
  
  // Auto-generate initial board on load (keeps index/offset state if loaded from session)
  handleGenerate(hasSavedState);
}

// Run app
window.addEventListener('DOMContentLoaded', init);
