/**
 * System One AI Controller & Normal Computer AI for Retro Battleship
 * Integrates with TypeSafe AI System One API (POST /v1/systemone)
 */

const COLS = ['A','B','C','D','E','F','G','H','I','J'];
const ROWS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const GRID_SIZE = 10;

function coordToKey(colIdx, rowIdx) {
  return `${COLS[colIdx]}${rowIdx + 1}`;
}

function keyToCoord(key) {
  const colChar = key[0].toUpperCase();
  const colIdx = COLS.indexOf(colChar);
  const rowIdx = parseInt(key.slice(1), 10) - 1;
  return { colIdx, rowIdx };
}

/**
 * System One Naval Controller
 */
class SystemOneBattleshipController {
  constructor() {
    this.endpoint = window.sharedSystemOne ? window.sharedSystemOne.getEndpoint() : "http://127.0.0.1:8000/v1/systemone";
    this.isRequestInProgress = false;
    this.lastDecision = null;
    this.lastLatency = null;
    this.modelName = "strands-decider-2B-qwen3.5-v1-2610";
    this.safeGuardEnabled = true;

    window.addEventListener('systemone:endpoint-changed', (e) => {
      this.endpoint = e.detail.endpoint;
    });
  }

  setEndpoint(url) {
    this.endpoint = url.trim();
    if (window.sharedSystemOne) {
      window.sharedSystemOne.setEndpoint(url);
    }
  }

  /**
   * Builds an ASCII radar representation of the targeting grid
   * Grid legend:
   * . = Unexplored Fog of War
   * O = Confirmed Miss
   * * = Active Hit (ship damaged, still floating)
   * X = Sunk Ship Section
   */
  buildAsciiRadar(targetGrid) {
    let header = "   " + COLS.join(" ");
    let lines = [header];

    for (let r = 0; r < GRID_SIZE; r++) {
      const rowLabel = (r + 1).toString().padStart(2, ' ');
      let rowChars = [];
      for (let c = 0; c < GRID_SIZE; c++) {
        const cell = targetGrid[r][c];
        if (cell.state === 'sunk') {
          rowChars.push('X');
        } else if (cell.state === 'hit') {
          rowChars.push('*');
        } else if (cell.state === 'miss') {
          rowChars.push('O');
        } else {
          rowChars.push('.');
        }
      }
      lines.push(`${rowLabel} ${rowChars.join(' ')}`);
    }

    return lines.join("\n");
  }

  /**
   * Computes a tactical probability heat map for unexplored cells
   * based on surviving enemy ships fitting horizontally and vertically.
   */
  computeDensityMap(targetGrid, survivingShips) {
    const density = Array.from({ length: GRID_SIZE }, () => new Array(GRID_SIZE).fill(0));
    const shipLengths = survivingShips.map(s => s.length);

    for (const len of shipLengths) {
      // Horizontal placements
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c <= GRID_SIZE - len; c++) {
          let canFit = true;
          for (let k = 0; k < len; k++) {
            const state = targetGrid[r][c + k].state;
            if (state === 'miss' || state === 'sunk') {
              canFit = false;
              break;
            }
          }
          if (canFit) {
            for (let k = 0; k < len; k++) {
              if (targetGrid[r][c + k].state === 'empty') {
                density[r][c + k] += 1;
              }
            }
          }
        }
      }

      // Vertical placements
      for (let c = 0; c < GRID_SIZE; c++) {
        for (let r = 0; r <= GRID_SIZE - len; r++) {
          let canFit = true;
          for (let k = 0; k < len; k++) {
            const state = targetGrid[r + k][c].state;
            if (state === 'miss' || state === 'sunk') {
              canFit = false;
              break;
            }
          }
          if (canFit) {
            for (let k = 0; k < len; k++) {
              if (targetGrid[r + k][c].state === 'empty') {
                density[r + k][c] += 1;
              }
            }
          }
        }
      }
    }

    return density;
  }

  /**
   * Generates strategic candidate cells and descriptions for System One
   */
  generateCandidates(targetGrid, survivingShips, recentShotHistory = []) {
    const activeHits = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (targetGrid[r][c].state === 'hit') {
          activeHits.push({ colIdx: c, rowIdx: r });
        }
      }
    }

    const criteria = {};
    const candidateMeta = {};
    const density = this.computeDensityMap(targetGrid, survivingShips);
    const minShipLen = Math.min(...survivingShips.map(s => s.length), 2);

    // MODE 1: TARGET MODE (Active hits exist on board)
    if (activeHits.length > 0) {
      const neighbors = [];
      const deltas = [
        { dc: 0, dr: -1, dir: 'NORTH' },
        { dc: 0, dr: 1, dir: 'SOUTH' },
        { dc: -1, dr: 0, dir: 'WEST' },
        { dc: 1, dr: 0, dir: 'EAST' }
      ];

      // Check if multiple hits form an axis
      let axisFound = null; // 'H' or 'V'
      if (activeHits.length >= 2) {
        const sameRow = activeHits.every(h => h.rowIdx === activeHits[0].rowIdx);
        const sameCol = activeHits.every(h => h.colIdx === activeHits[0].colIdx);
        if (sameRow) axisFound = 'H';
        else if (sameCol) axisFound = 'V';
      }

      // Check the most recent hit in shot history
      const lastHitShot = [...recentShotHistory].reverse().find(s => s.result === 'HIT');

      for (const hit of activeHits) {
        for (const { dc, dr, dir } of deltas) {
          const nc = hit.colIdx + dc;
          const nr = hit.rowIdx + dr;

          if (nc >= 0 && nc < GRID_SIZE && nr >= 0 && nr < GRID_SIZE) {
            if (targetGrid[nr][nc].state === 'empty') {
              const key = coordToKey(nc, nr);
              if (!neighbors.some(n => n.key === key)) {
                let priorityScore = 15;
                let reason = `Flanks confirmed hit at ${coordToKey(hit.colIdx, hit.rowIdx)} to the ${dir}.`;

                if (axisFound === 'H') {
                  if (dr === 0) {
                    priorityScore += 40; // Direct collinear hit extension
                    reason = `HIGH PRIORITY: Continues established horizontal firing line along row ${hit.rowIdx + 1} towards ${dir}.`;
                  } else {
                    priorityScore -= 10;
                  }
                } else if (axisFound === 'V') {
                  if (dc === 0) {
                    priorityScore += 40; // Direct collinear hit extension
                    reason = `HIGH PRIORITY: Continues established vertical firing line along column ${COLS[hit.colIdx]} towards ${dir}.`;
                  } else {
                    priorityScore -= 10;
                  }
                }

                if (lastHitShot && lastHitShot.coord === coordToKey(hit.colIdx, hit.rowIdx)) {
                  priorityScore += 15; // Adjacent to the most recent hit
                }

                priorityScore += density[nr][nc];
                neighbors.push({ key, colIdx: nc, rowIdx: nr, dir, priorityScore, reason });
              }
            }
          }
        }
      }

      // Sort neighbors by priority score descending
      neighbors.sort((a, b) => b.priorityScore - a.priorityScore);

      // Take top 4-6 neighbors
      const selected = neighbors.slice(0, 6);
      for (const n of selected) {
        criteria[n.key] = `[TARGET] Sector ${n.key}: ${n.reason} (Density heat: ${density[n.rowIdx][n.colIdx]})`;
        candidateMeta[n.key] = {
          colIdx: n.colIdx,
          rowIdx: n.rowIdx,
          mode: 'TARGET',
          density: density[n.rowIdx][n.colIdx]
        };
      }

      if (Object.keys(criteria).length >= 2) {
        return { criteria, candidateMeta, mode: 'TARGET' };
      }
    }

    // MODE 2: HUNT MODE (Search across open water)
    // Score all empty cells using parity and density
    const huntCandidates = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (targetGrid[r][c].state === 'empty') {
          const key = coordToKey(c, r);
          let score = density[r][c];

          // Checkerboard parity bonus
          const isParity = (r + c) % minShipLen === 0;
          if (isParity) score += 15;

          // Center-board bonus (battleships frequently cross the central 6x6)
          const distToCenter = Math.abs(r - 4.5) + Math.abs(c - 4.5);
          score += Math.max(0, 10 - distToCenter);

          huntCandidates.push({
            key,
            colIdx: c,
            rowIdx: r,
            score,
            isParity,
            densityVal: density[r][c]
          });
        }
      }
    }

    huntCandidates.sort((a, b) => b.score - a.score);

    // Pick a diverse set of top 5-6 candidates across different sectors
    const picked = [];
    const usedSectors = new Set();

    for (const cand of huntCandidates) {
      const sector = `${Math.floor(cand.rowIdx / 3)}_${Math.floor(cand.colIdx / 3)}`;
      if (!usedSectors.has(sector) || picked.length >= 3) {
        picked.push(cand);
        usedSectors.add(sector);
      }
      if (picked.length >= 5) break;
    }

    if (picked.length < 2) {
      for (const cand of huntCandidates) {
        if (!picked.some(p => p.key === cand.key)) {
          picked.push(cand);
        }
        if (picked.length >= 4) break;
      }
    }

    for (const p of picked) {
      const parityNote = p.isParity ? `Aligned with ${minShipLen}-tile checkerboard parity grid.` : `Open sector reconnaissance.`;
      criteria[p.key] = `[HUNT] Sector ${p.key}: Strategic density heat ${p.densityVal}. ${parityNote}`;
      candidateMeta[p.key] = {
        colIdx: p.colIdx,
        rowIdx: p.rowIdx,
        mode: 'HUNT',
        density: p.densityVal
      };
    }

    return { criteria, candidateMeta, mode: 'HUNT' };
  }

  /**
   * Request next artillery coordinate from System One
   */
  async getNextShot(targetGrid, survivingShips, recentShotHistory = []) {
    if (this.isRequestInProgress) {
      return null;
    }

    this.isRequestInProgress = true;
    const startTime = performance.now();

    const { criteria, candidateMeta, mode } = this.generateCandidates(targetGrid, survivingShips, recentShotHistory);
    const asciiRadar = this.buildAsciiRadar(targetGrid);
    const candidateKeys = Object.keys(criteria);

    // Forced move if only 1 valid candidate exists
    if (candidateKeys.length === 1) {
      const onlyKey = candidateKeys[0];
      const meta = candidateMeta[onlyKey];
      this.lastDecision = {
        key: onlyKey,
        rawChoice: onlyKey,
        colIdx: meta.colIdx,
        rowIdx: meta.rowIdx,
        mode,
        probabilities: { [onlyKey]: 1.0 },
        confidence: 1.0,
        latency: 0,
        candidateMeta,
        criteria,
        asciiRadar,
        endpointUsed: "Local (Forced Coordinate)",
        isForcedMove: true
      };
      this.isRequestInProgress = false;
      return this.lastDecision;
    }

    // Format fleet status
    const fleetDesc = survivingShips.map(s => `${s.name} (${s.length} tiles)`).join(', ');

    // Format Chronological Recent Salvo History
    let historyText = "No previous shots fired yet (Opening reconnaissance salvo).";
    if (recentShotHistory && recentShotHistory.length > 0) {
      const lastN = recentShotHistory.slice(-6);
      historyText = lastN.map((s, idx) => {
        const num = recentShotHistory.length - lastN.length + idx + 1;
        const outcome = s.result === 'HIT' ? 'DIRECT HIT (Hostile vessel damaged!)' :
                        s.result === 'SUNK' ? `CONFIRMED SUNK (Enemy ${s.shipName || 'vessel'} neutralized)` :
                        'MISS (Water splash, open sea)';
        return `- Salvo #${num}: Sector ${s.coord} -> ${outcome}`;
      }).join('\n');
    }

    // Active Tactical Situation
    let tacticalNotes = '';
    if (mode === 'TARGET') {
      const activeHitCoords = [];
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (targetGrid[r][c].state === 'hit') activeHitCoords.push(coordToKey(c, r));
        }
      }
      tacticalNotes = `Confirmed active damaged ship coordinates: [${activeHitCoords.join(', ')}]. Priority: Follow collinear axis to finish sinking this vessel!`;
    } else {
      tacticalNotes = `No active damaged vessels floating. Priority: Search open sectors using checkerboard parity pattern to locate surviving enemy fleet.`;
    }

    // Pure semantic naval tactical state incorporating temporal history
    const stateText = [
      `Game: Classic 10x10 Battleship Naval Warfare.`,
      `Enemy Fleet afloat: ${fleetDesc}.`,
      `Tactical Mode: ${mode === 'TARGET' ? 'TARGET TRACKING (Active hit locked on enemy vessel - destroy ship)' : 'RECON HUNT (Scanning open sectors for enemy fleet)'}.`,
      `Recent Artillery Salvo History (Chronological):`,
      historyText,
      `Tactical Situation: ${tacticalNotes}`,
      `ASCII Radar Map (. = Fog of war, O = Miss, * = Active Hit, X = Sunk vessel):`,
      asciiRadar,
      `Select the single best coordinate to fire the next artillery missile.`
    ].join('\n');

    const instructions = mode === 'TARGET' 
      ? "Select the single best adjacent coordinate to continue destroying the damaged enemy ship."
      : "Select the optimal strategic grid coordinate to maximize likelihood of detecting hidden enemy ships.";

    let choiceResult = null;
    try {
      if (window.sharedSystemOne) {
        choiceResult = await window.sharedSystemOne.queryChoice({
          state: stateText,
          questionKey: 'artillery_target',
          instructions,
          criteria
        });
      } else {
        throw new Error("SystemOneClient not initialized");
      }
    } catch (err) {
      console.warn("System One request encountered error, falling back to heuristic safe-guard:", err);
      const topKey = candidateKeys[0];
      const meta = candidateMeta[topKey];
      const elapsed = Math.round(performance.now() - startTime);
      this.lastDecision = {
        key: topKey,
        rawChoice: topKey,
        colIdx: meta.colIdx,
        rowIdx: meta.rowIdx,
        mode,
        probabilities: { [topKey]: 0.95 },
        confidence: 0.95,
        latency: elapsed,
        candidateMeta,
        criteria,
        asciiRadar,
        endpointUsed: "Safe-Guard Heuristic (API Offline)",
        isFallback: true
      };
      this.isRequestInProgress = false;
      return this.lastDecision;
    }

    this.lastLatency = choiceResult.latency;
    this.modelName = choiceResult.model;

    let rawChoice = (choiceResult.choice || "").trim().toUpperCase();
    const probabilities = choiceResult.probabilities || {};
    const confidence = choiceResult.confidence || 0;

    // Safe-guard validation: ensure coordinate exists in candidates
    let chosenKey = rawChoice;
    if (!candidateMeta[chosenKey]) {
      const found = candidateKeys.find(k => k === rawChoice || rawChoice.includes(k));
      chosenKey = found || candidateKeys[0];
    }

    const meta = candidateMeta[chosenKey];

    this.lastDecision = {
      key: chosenKey,
      rawChoice,
      colIdx: meta.colIdx,
      rowIdx: meta.rowIdx,
      mode,
      probabilities,
      confidence,
      latency: this.lastLatency,
      candidateMeta,
      criteria,
      asciiRadar,
      endpointUsed: choiceResult.endpointUsed
    };

    this.isRequestInProgress = false;
    return this.lastDecision;
  }
}

/**
 * Normal Computer AI
 * Standard algorithmic Battleship opponent using classic Hunt & Target with parity.
 */
class NormalComputerAI {
  constructor() {
    this.name = "Standard Naval CPU (Hunt-and-Target)";
  }

  getNextShot(targetGrid, survivingShips) {
    const activeHits = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (targetGrid[r][c].state === 'hit') {
          activeHits.push({ colIdx: c, rowIdx: r });
        }
      }
    }

    // TARGET MODE
    if (activeHits.length > 0) {
      // Determine if there is an aligned axis
      let axis = null;
      if (activeHits.length >= 2) {
        if (activeHits.every(h => h.rowIdx === activeHits[0].rowIdx)) axis = 'H';
        else if (activeHits.every(h => h.colIdx === activeHits[0].colIdx)) axis = 'V';
      }

      const candidates = [];
      const deltas = [
        { dc: 0, dr: -1 },
        { dc: 0, dr: 1 },
        { dc: -1, dr: 0 },
        { dc: 1, dr: 0 }
      ];

      for (const hit of activeHits) {
        for (const { dc, dr } of deltas) {
          const nc = hit.colIdx + dc;
          const nr = hit.rowIdx + dr;
          if (nc >= 0 && nc < GRID_SIZE && nr >= 0 && nr < GRID_SIZE) {
            if (targetGrid[nr][nc].state === 'empty') {
              let score = 10;
              if (axis === 'H' && dr === 0) score += 20;
              if (axis === 'V' && dc === 0) score += 20;
              candidates.push({ colIdx: nc, rowIdx: nr, score });
            }
          }
        }
      }

      if (candidates.length > 0) {
        candidates.sort((a, b) => b.score - a.score);
        const topScore = candidates[0].score;
        const bestGroup = candidates.filter(c => c.score === topScore);
        const choice = bestGroup[Math.floor(Math.random() * bestGroup.length)];
        return {
          colIdx: choice.colIdx,
          rowIdx: choice.rowIdx,
          key: coordToKey(choice.colIdx, choice.rowIdx),
          mode: 'TARGET'
        };
      }
    }

    // HUNT MODE with Parity
    const minShipLen = Math.min(...survivingShips.map(s => s.length), 2);
    const parityCells = [];
    const otherEmptyCells = [];

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (targetGrid[r][c].state === 'empty') {
          if ((r + c) % minShipLen === 0) {
            parityCells.push({ colIdx: c, rowIdx: r });
          } else {
            otherEmptyCells.push({ colIdx: c, rowIdx: r });
          }
        }
      }
    }

    const pool = parityCells.length > 0 ? parityCells : otherEmptyCells;
    const choice = pool[Math.floor(Math.random() * pool.length)];

    return {
      colIdx: choice.colIdx,
      rowIdx: choice.rowIdx,
      key: coordToKey(choice.colIdx, choice.rowIdx),
      mode: 'HUNT'
    };
  }
}

window.systemOneAI = new SystemOneBattleshipController();
window.normalComputerAI = new NormalComputerAI();
