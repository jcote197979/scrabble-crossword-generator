// Scrabble crossword layout generator
export function cleanName(name) {
  return name.trim().toUpperCase().replace(/[^A-Z]/g, '');
}

/**
 * Generates a list of valid crossword layouts for a list of names.
 * @param {string[]} namesList - List of family name strings
 * @returns {Array} List of layout configurations, sorted by score
 */
export function generateCrosswordLayouts(namesList) {
  // Filter out empty names
  const cleanNames = namesList
    .map(cleanName)
    .filter(n => n.length > 0);

  if (cleanNames.length === 0) return [];

  // Sort names by length descending (improves placement efficiency)
  const sortedNames = [...cleanNames].sort((a, b) => b.length - a.length);

  const results = [];
  const maxResults = 120; // Cap search space to ensure fast response times

  // Backtracking search function
  function search(placed, unplaced, grid) {
    if (unplaced.length === 0) {
      results.push(JSON.parse(JSON.stringify(placed)));
      return;
    }

    if (results.length >= maxResults) return;

    const nextWord = unplaced[0];
    const remaining = unplaced.slice(1);

    // Try to intersect with any placed word
    for (let pIdx = 0; pIdx < placed.length; pIdx++) {
      const p = placed[pIdx];

      for (let i = 0; i < p.word.length; i++) {
        const pChar = p.word[i];
        const pRow = p.dir === 'H' ? p.row : p.row + i;
        const pCol = p.dir === 'H' ? p.col + i : p.col;

        for (let j = 0; j < nextWord.length; j++) {
          if (nextWord[j] === pChar) {
            const nextDir = p.dir === 'H' ? 'V' : 'H';
            const nextRow = nextDir === 'H' ? pRow : pRow - j;
            const nextCol = nextDir === 'H' ? pCol - j : pCol;

            if (isValidPlacement(nextWord, nextRow, nextCol, nextDir, grid)) {
              // Place word
              const nextPlaced = [...placed, { word: nextWord, row: nextRow, col: nextCol, dir: nextDir }];
              const nextGrid = { ...grid };
              for (let k = 0; k < nextWord.length; k++) {
                nextGrid[`${nextDir === 'H' ? nextRow : nextRow + k},${nextDir === 'H' ? nextCol + k : nextCol}`] = {
                  char: nextWord[k],
                  wordIdx: placed.length
                };
              }

              search(nextPlaced, remaining, nextGrid);
            }
          }
        }
      }
    }
  }

  // Check if placement is valid
  function isValidPlacement(word, row, col, dir, grid) {
    // Helper to check if a cell is part of the word being placed
    function isCurrentWordCell(r, c) {
      for (let k = 0; k < word.length; k++) {
        const wr = dir === 'H' ? row : row + k;
        const wc = dir === 'H' ? col + k : col;
        if (wr === r && wc === c) return true;
      }
      return false;
    }

    for (let k = 0; k < word.length; k++) {
      const r = dir === 'H' ? row : row + k;
      const c = dir === 'H' ? col + k : col;

      const existing = grid[`${r},${c}`];
      if (existing) {
        if (existing.char !== word[k]) {
          return false; // Character clash
        }
      } else {
        // Empty cell: check adjacent cell constraints (Scrabble rule)
        const adjacents = [
          { r: r - 1, c: c }, // Up
          { r: r + 1, c: c }, // Down
          { r: r, c: c - 1 }, // Left
          { r: r, c: c + 1 }  // Right
        ];

        for (const adj of adjacents) {
          if (isCurrentWordCell(adj.r, adj.c)) continue;
          if (grid[`${adj.r},${adj.c}`]) {
            return false; // Touching another word illegally (creates invalid 2-letter word)
          }
        }
      }
    }

    // Check end-caps (1 empty cell pad at the ends of the word)
    const beforeR = dir === 'H' ? row : row - 1;
    const beforeC = dir === 'H' ? col - 1 : col;
    const afterR = dir === 'H' ? row : row + word.length;
    const afterC = dir === 'H' ? col + word.length : col;

    if (grid[`${beforeR},${beforeC}`] || grid[`${afterR},${afterC}`]) {
      return false; // End-cap collision
    }

    return true;
  }

  // Start with the first (longest) word placed at (0, 0) Horizontally
  const firstWord = sortedNames[0];
  const initialPlacedH = [{ word: firstWord, row: 0, col: 0, dir: 'H' }];
  const initialGridH = {};
  for (let k = 0; k < firstWord.length; k++) {
    initialGridH[`0,${k}`] = { char: firstWord[k], wordIdx: 0 };
  }

  search(initialPlacedH, sortedNames.slice(1), initialGridH);

  // If no layouts generated H, or to ensure complete coverage, try placing the first word Vertically
  const initialPlacedV = [{ word: firstWord, row: 0, col: 0, dir: 'V' }];
  const initialGridV = {};
  for (let k = 0; k < firstWord.length; k++) {
    initialGridV[`${k},0`] = { char: firstWord[k], wordIdx: 0 };
  }
  search(initialPlacedV, sortedNames.slice(1), initialGridV);

  // Process and score layouts
  const processedLayouts = results.map(layout => {
    // Calculate bounding box
    let minRow = Infinity, maxRow = -Infinity;
    let minCol = Infinity, maxCol = -Infinity;

    layout.forEach(p => {
      for (let k = 0; k < p.word.length; k++) {
        const r = p.dir === 'H' ? p.row : p.row + k;
        const c = p.dir === 'H' ? p.col + k : p.col;
        if (r < minRow) minRow = r;
        if (r > maxRow) maxRow = r;
        if (c < minCol) minCol = c;
        if (c > maxCol) maxCol = c;
      }
    });

    const height = maxRow - minRow + 1;
    const width = maxCol - minCol + 1;
    
    // Normalize coordinates so the bounding box starts at (0, 0)
    const normalized = layout.map(p => ({
      word: p.word,
      row: p.row - minRow,
      col: p.col - minCol,
      dir: p.dir
    }));

    // Calculate quality score
    // 1. Compactness (smaller area is better)
    const area = width * height;
    const compactnessScore = 150 / (area || 1);

    // 2. Aspect Ratio Balance
    const currentRatio = width / height;
    let ratioPenalty = 0;
    // We target a balanced 3:4 portrait (0.75) or square (1.0) shape
    if (currentRatio > 1.8 || currentRatio < 0.4) {
      ratioPenalty = -100; // Penalize highly stretched layouts
    } else {
      ratioPenalty = -Math.abs(currentRatio - 0.85) * 40;
    }

    // 3. Intersections (more connections look better)
    const totalLetters = layout.reduce((sum, p) => sum + p.word.length, 0);
    const uniqueCells = new Set();
    layout.forEach(p => {
      for (let k = 0; k < p.word.length; k++) {
        const r = p.dir === 'H' ? p.row : p.row + k;
        const c = p.dir === 'H' ? p.col + k : p.col;
        uniqueCells.add(`${r},${c}`);
      }
    });
    const intersections = totalLetters - uniqueCells.size;
    const intersectionScore = intersections * 25;

    // 4. Centering / Squareness weight
    const borderDiff = Math.abs(width - height);
    const squarenessScore = (borderDiff === 0) ? 20 : (10 / borderDiff);

    const totalScore = compactnessScore + ratioPenalty + intersectionScore + squarenessScore;

    return {
      layout: normalized,
      width,
      height,
      score: totalScore
    };
  });

  // Sort layouts by score descending
  processedLayouts.sort((a, b) => b.score - a.score);

  // De-duplicate layouts (some layouts might be identical after translation or starting variations)
  const seenLayouts = new Set();
  const uniqueProcessed = [];
  
  for (const l of processedLayouts) {
    // Generate a unique key for this layout
    const sortedWords = [...l.layout].sort((a, b) => a.word.localeCompare(b.word));
    const key = sortedWords.map(w => `${w.word}:${w.row},${w.col},${w.dir}`).join('|');
    if (!seenLayouts.has(key)) {
      seenLayouts.add(key);
      uniqueProcessed.push(l);
    }
  }

  return uniqueProcessed;
}
