import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { generateCrosswordLayouts } from './src/generator.js';
import { renderSVG } from './src/svg-renderer.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Helper to load all wood textures and font files dynamically from disk as Base64 data URIs
function getLoadedTextures() {
  const textures = {};
  const activeBase = path.join(__dirname, 'public');
  
  // 1. Load board textures
  const boardDir = path.join(activeBase, 'textures', 'board');
  if (fs.existsSync(boardDir)) {
    try {
      fs.readdirSync(boardDir).filter(f => f.endsWith('.png')).forEach(file => {
        const key = `board_${file.replace('.png', '')}`;
        const buffer = fs.readFileSync(path.join(boardDir, file));
        textures[key] = `data:image/png;base64,${buffer.toString('base64')}`;
      });
    } catch (e) {
      console.error("Error reading board textures:", e);
    }
  }

  // 2. Load tile textures
  const tilesDir = path.join(activeBase, 'textures', 'tiles');
  if (fs.existsSync(tilesDir)) {
    try {
      fs.readdirSync(tilesDir).filter(f => f.endsWith('.png')).forEach(file => {
        const key = `tile_${file.replace('.png', '')}`;
        const buffer = fs.readFileSync(path.join(tilesDir, file));
        textures[key] = `data:image/png;base64,${buffer.toString('base64')}`;
      });
    } catch (e) {
      console.error("Error reading tile textures:", e);
    }
  }

  // 3. Load title textures
  const titleDir = path.join(activeBase, 'textures', 'title');
  if (fs.existsSync(titleDir)) {
    try {
      fs.readdirSync(titleDir).filter(f => f.endsWith('.png')).forEach(file => {
        const key = `title_${file.replace('.png', '')}`;
        const buffer = fs.readFileSync(path.join(titleDir, file));
        textures[key] = `data:image/png;base64,${buffer.toString('base64')}`;
      });
    } catch (e) {
      console.error("Error reading title textures:", e);
    }
  }

  // 4. Load custom Scrabble TTF/OTF font files
  const fontDir = path.join(activeBase, 'font_tiles');
  if (fs.existsSync(fontDir)) {
    try {
      fs.readdirSync(fontDir).filter(f => f.endsWith('.ttf') || f.endsWith('.otf')).forEach(file => {
        const key = file.replace(/\.(ttf|otf)$/, '');
        const buffer = fs.readFileSync(path.join(fontDir, file));
        textures[key] = buffer.toString('base64');
      });
    } catch (e) {
      console.error("Error reading custom font files:", e);
    }
  }

  // 5. Load custom title font files from dist/fonts_titles
  const fontsTitlesDir = path.join(__dirname, 'dist', 'fonts_titles');
  if (fs.existsSync(fontsTitlesDir)) {
    try {
      fs.readdirSync(fontsTitlesDir).filter(f => f.endsWith('.ttf') || f.endsWith('.otf')).forEach(file => {
        const key = `titlefont_${file.replace(/\.(ttf|otf)$/, '')}`;
        const buffer = fs.readFileSync(path.join(fontsTitlesDir, file));
        textures[key] = buffer.toString('base64');
      });
    } catch (e) {
      console.error("Error reading custom title font files:", e);
    }
  }

  return textures;
}

// Decode Base64url token into JSON object (handles UTF-8 accented characters)
function decodeCode(code) {
  try {
    let base64 = code.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const binary = Buffer.from(base64, 'base64').toString('binary');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const jsonStr = new TextDecoder().decode(bytes);
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Error decoding base64 code:", error);
    return null;
  }
}

// core SVG generation logic from config object
function generateSVGFromConfig(config) {
  const {
    names = [],
    title = "Title",
    titleFont = "Alex Brush",
    titleSize = 40,
    titleX = 0,
    titleY = 0,
    size = "medium_portrait",
    background = "brown",
    tileStyle = "maple",
    tileFont = "system",
    titleStyle = "white_blanc_default",
    layoutIndex = 0,
    dividerType = "hearts",
    dividerSize = 1.0
  } = config;

  if (!names || names.length === 0) {
    throw new Error("No names provided for layout generation.");
  }

  // 1. Generate layouts
  const layouts = generateCrosswordLayouts(names);
  if (layouts.length === 0) {
    throw new Error("Could not connect the provided names into a valid Scrabble layout.");
  }

  // 2. Select layout
  const selectedIndex = Math.min(Math.max(0, layoutIndex), layouts.length - 1);
  const layoutData = layouts[selectedIndex];

  // 3. Load wood textures
  const woodTextures = getLoadedTextures();

  // 4. Render SVG
  return renderSVG({
    layout: layoutData.layout,
    width: layoutData.width,
    height: layoutData.height,
    title,
    titleFont,
    titleSize,
    titleX,
    titleY,
    size,
    background,
    tileStyle,
    tileFont,
    titleStyle,
    woodTextures,
    dividerType,
    dividerSize
  });
}

// GET /api/options - Retrieve list of dynamic options from disk
app.get('/api/options', (req, res) => {
  const activeBase = path.join(__dirname, 'public');

  const scanFolder = (subpath, ext) => {
    const dir = path.join(activeBase, subpath);
    if (!fs.existsSync(dir)) return [];
    try {
      return fs.readdirSync(dir)
        .filter(file => file.endsWith(ext))
        .map(file => file.slice(0, -ext.length));
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  const scanFolderAbsolute = (dir, ext) => {
    if (!fs.existsSync(dir)) return [];
    try {
      return fs.readdirSync(dir)
        .filter(file => file.endsWith(ext))
        .map(file => file.slice(0, -ext.length));
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  const boardOptions = scanFolder('textures/board', '.png');
  const tilesOptions = scanFolder('textures/tiles', '.png');
  const titleOptions = scanFolder('textures/title', '.png');
  
  // Custom font options (names like Scrabble_english -> english)
  const fontOptions = scanFolder('font_tiles', '.ttf')
    .concat(scanFolder('font_tiles', '.otf'))
    .map(name => name.replace('Scrabble_', ''));

  // Custom title font options from dist/fonts_titles
  const fontsTitlesDir = path.join(__dirname, 'dist', 'fonts_titles');
  const fontsTitlesOptions = scanFolderAbsolute(fontsTitlesDir, '.ttf')
    .concat(scanFolderAbsolute(fontsTitlesDir, '.otf'));

  return res.json({
    board: boardOptions,
    tiles: tilesOptions,
    title: titleOptions,
    fonts: fontOptions,
    fonts_titles: fontsTitlesOptions
  });
});

// GET /api/svg - Stateless SVG generation via Base64 code
app.get('/api/svg', (req, res) => {
  const { code, download } = req.query;

  if (!code) {
    return res.status(400).json({ error: "Missing required 'code' parameter." });
  }

  const config = decodeCode(code);
  if (!config) {
    return res.status(400).json({ error: "Invalid production code format." });
  }

  try {
    const svgContent = generateSVGFromConfig(config);

    res.setHeader('Content-Type', 'image/svg+xml');
    
    if (download === 'true') {
      const sanitizedTitle = (config.title || 'scrabble-crossword').toLowerCase().replace(/[^a-z0-9]/g, '-');
      res.setHeader('Content-Disposition', `attachment; filename="${sanitizedTitle}.svg"`);
    }

    return res.send(svgContent);
  } catch (error) {
    return res.status(422).json({ error: error.message });
  }
});

// POST /api/svg - Generate SVG directly from JSON request body
app.post('/api/svg', (req, res) => {
  try {
    const svgContent = generateSVGFromConfig(req.body);
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.send(svgContent);
  } catch (error) {
    return res.status(422).json({ error: error.message });
  }
});

// Serve textures and font_tiles directly from the public directory so uploaded files are instantly available
app.use('/textures', express.static(path.join(__dirname, 'public', 'textures')));
app.use('/font_tiles', express.static(path.join(__dirname, 'public', 'font_tiles')));
app.use('/fonts_titles', express.static(path.join(__dirname, 'dist', 'fonts_titles')));

// Serve frontend build output
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback to SPA router for client routing
app.use((req, res) => {
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send("Frontend assets not built. Please run 'npm run build' first.");
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
