/**
 * System One AI Controller for Retro Snake
 * Integrates with TypeSafe AI System One API (POST /v1/systemone)
 * Supports Multi-Grid Direction + Distance Navigation
 */
class SystemOneController {
  constructor() {
    this.endpoint = window.sharedSystemOne ? window.sharedSystemOne.getEndpoint() : 'http://127.0.0.1:8000/v1/systemone';
    this.isRequestInProgress = false;
    this.lastDecision = null;
    this.lastLatency = null;
    this.modelName = 'strands-decider-2B-qwen3.5-v1-2610';
    this.safeGuardEnabled = true;
    this.navigationMode = 'multi'; // 'multi' (direction+distance) or 'single'

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

  setNavigationMode(mode) {
    this.navigationMode = mode;
  }

  /**
   * Raycast along a direction and return safe distance, food reach, and alignment
   */
  traceRay(head, dir, delta, gridCols, gridRows, snake, foods) {
    let maxSafeDist = 0;
    let foodDist = null;
    let hitFruit = null;
    let alignDist = null;

    for (let d = 1; d < Math.max(gridCols, gridRows); d++) {
      const nx = head.x + delta.dx * d;
      const ny = head.y + delta.dy * d;

      // Check wall collision
      if (nx < 0 || nx >= gridCols || ny < 0 || ny >= gridRows) {
        break;
      }

      // Check body collision (ignoring tail if tail moves)
      const hitsBody = snake.slice(0, -1).some(seg => seg.x === nx && seg.y === ny);
      if (hitsBody) {
        break;
      }

      maxSafeDist = d;

      // Check if any fruit is in direct line of sight
      const fruitAtTile = foods.find(f => f.x === nx && f.y === ny);
      if (fruitAtTile) {
        foodDist = d;
        hitFruit = fruitAtTile;
        break; // Stop ray at fruit since eating fruit changes state
      }

      // Check perpendicular alignment with any fruit
      if (alignDist === null) {
        const aligned = foods.find(f => (delta.dx !== 0 && nx === f.x) || (delta.dy !== 0 && ny === f.y));
        if (aligned) {
          alignDist = d;
        }
      }
    }

    return { maxSafeDist, foodDist, hitFruit, alignDist };
  }

  /**
   * Auto-generate candidate Direction + Distance options based on available grid
   */
  generateCandidates(gameState) {
    const { gridCols, gridRows, snake, currentDir } = gameState;
    const foods = gameState.foods && gameState.foods.length > 0 ? gameState.foods : [gameState.food];
    const head = snake[0];

    // Minimum distance to any active fruit
    const getMinFoodDist = (pt) => Math.min(...foods.map(f => Math.abs(f.x - pt.x) + Math.abs(f.y - pt.y)));
    const currentMinDist = getMinFoodDist(head);

    const reverseMap = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };
    const deltas = {
      UP: { dx: 0, dy: -1 },
      DOWN: { dx: 0, dy: 1 },
      LEFT: { dx: -1, dy: 0 },
      RIGHT: { dx: 1, dy: 0 }
    };

    const criteria = {};
    const candidateMeta = {};

    for (const [dir, delta] of Object.entries(deltas)) {
      // Avoid immediate 180° reverse
      if (snake.length > 1 && dir === reverseMap[currentDir]) {
        continue;
      }

      const ray = this.traceRay(head, dir, delta, gridCols, gridRows, snake, foods);
      if (ray.maxSafeDist === 0) {
        continue;
      }

      let distances = [];

      if (this.navigationMode === 'single') {
        distances = [1];
      } else {
        if (ray.foodDist !== null) {
          distances.push(ray.foodDist);
          if (ray.foodDist > 1) {
            distances.push(1);
          }
        } else {
          if (ray.maxSafeDist <= 3) {
            for (let d = 1; d <= ray.maxSafeDist; d++) distances.push(d);
          } else {
            distances.push(1);
            if (ray.alignDist && ray.alignDist <= ray.maxSafeDist) {
              distances.push(ray.alignDist);
            }
            if (ray.maxSafeDist > 2 && !distances.includes(Math.round(ray.maxSafeDist / 2))) {
              distances.push(Math.round(ray.maxSafeDist / 2));
            }
            if (!distances.includes(ray.maxSafeDist)) {
              distances.push(ray.maxSafeDist);
            }
          }
        }
      }

      distances = [...new Set(distances)].sort((a, b) => a - b);

      for (const d of distances) {
        const targetX = head.x + delta.dx * d;
        const targetY = head.y + delta.dy * d;
        const newMinDist = getMinFoodDist({ x: targetX, y: targetY });
        const optKey = `${dir}_${d}`;

        const isFoodTile = foods.some(f => f.x === targetX && f.y === targetY);
        let desc = `Move ${dir} ${d} tile(s) to (${targetX}, ${targetY}).`;
        if (isFoodTile) {
          desc += ` REACHES AND EATS FRUIT!`;
        } else if (d === ray.alignDist) {
          desc += ` Aligns with fruit axis! Distance to nearest fruit drops from ${currentMinDist} to ${newMinDist}.`;
        } else if (newMinDist < currentMinDist) {
          desc += ` Approaches fruit (distance: ${newMinDist}).`;
        } else if (d === ray.maxSafeDist) {
          desc += ` Maximum clear runway before obstacle. Distance: ${newMinDist}.`;
        } else {
          desc += ` Distance to closest fruit: ${newMinDist}.`;
        }

        criteria[optKey] = desc;
        candidateMeta[optKey] = {
          direction: dir,
          distance: d,
          targetX,
          targetY,
          newDist: newMinDist,
          isFood: isFoodTile
        };
      }
    }

    if (Object.keys(criteria).length === 0) {
      for (const [dir, delta] of Object.entries(deltas)) {
        if (snake.length > 1 && dir === reverseMap[currentDir]) continue;
        const optKey = `${dir}_1`;
        criteria[optKey] = `Emergency step ${dir} 1 tile.`;
        candidateMeta[optKey] = {
          direction: dir,
          distance: 1,
          targetX: head.x + delta.dx,
          targetY: head.y + delta.dy,
          newDist: 99,
          isFood: false
        };
      }
    }

    return { criteria, candidateMeta, foods };
  }

  /**
   * Build compact ASCII map
   */
  buildAsciiMap(gameState) {
    const { gridCols, gridRows, snake } = gameState;
    const foods = gameState.foods && gameState.foods.length > 0 ? gameState.foods : [gameState.food];
    const grid = [];
    for (let r = 0; r < gridRows; r++) {
      grid.push(new Array(gridCols).fill('.'));
    }
    for (let i = 1; i < snake.length; i++) {
      const seg = snake[i];
      if (seg.y >= 0 && seg.y < gridRows && seg.x >= 0 && seg.x < gridCols) {
        grid[seg.y][seg.x] = '#';
      }
    }
    for (const f of foods) {
      if (f.y >= 0 && f.y < gridRows && f.x >= 0 && f.x < gridCols) {
        grid[f.y][f.x] = '*';
      }
    }
    const head = snake[0];
    if (head.y >= 0 && head.y < gridRows && head.x >= 0 && head.x < gridCols) {
      grid[head.y][head.x] = 'H';
    }
    return grid.map(row => row.join(' ')).join('\n');
  }

  /**
   * Request next multi-step move from System One
   */
  async getNextMove(gameState) {
    if (this.isRequestInProgress) {
      return null;
    }

    this.isRequestInProgress = true;
    const startTime = performance.now();

    const { gridCols, gridRows, snake, currentDir } = gameState;
    const head = snake[0];
    const { criteria, candidateMeta, foods } = this.generateCandidates(gameState);
    const asciiMap = this.buildAsciiMap(gameState);

    // If strictly 1 safe move exists (e.g. forced turn in a corner or corridor),
    // execute immediately: avoids API 422 error ("choice requires >= 2 options") and saves 2s!
    const candidateKeys = Object.keys(criteria);
    if (candidateKeys.length === 1) {
      const onlyKey = candidateKeys[0];
      const meta = candidateMeta[onlyKey];
      this.lastDecision = {
        key: onlyKey,
        rawChoice: onlyKey,
        direction: meta.direction,
        distance: meta.distance,
        targetX: meta.targetX,
        targetY: meta.targetY,
        isFood: meta.isFood,
        probabilities: { [onlyKey]: 1.0 },
        confidence: 1.0,
        latency: 0,
        candidateMeta,
        criteria,
        asciiMap,
        endpointUsed: 'Local (Forced Move)',
        isForcedMove: true
      };
      this.isRequestInProgress = false;
      return this.lastDecision;
    }

    const fruitsDesc = foods.map((f, i) => `Fruit #${i + 1} (${f.type || 'apple'}) at (${f.x}, ${f.y})`).join(', ');

    // Pure semantic world state (lean, fast, and high-signal for System One)
    const stateText = [
      `Game: Classic 2D Snake on a ${gridCols}x${gridRows} grid.`,
      `Head position: (x=${head.x}, y=${head.y}). Current heading: ${currentDir}. Snake length: ${snake.length}.`,
      `Active Fruit(s) on board: ${fruitsDesc}.`
    ].join('\n');

    const payload = {
      state: stateText,
      questions: {
        move_plan: {
          type: "choice",
          instructions: "Select the single best candidate plan (direction + step distance) to safely advance towards the food while avoiding walls and collisions.",
          criteria: criteria
        }
      }
    };

    let choiceResult = null;
    try {
      if (window.sharedSystemOne) {
        choiceResult = await window.sharedSystemOne.queryChoice({
          state: stateText,
          questionKey: 'move_plan',
          instructions: "Select the single best candidate plan (direction + step distance) to safely advance towards the food while avoiding walls and collisions.",
          criteria
        });
      } else {
        throw new Error("SystemOneClient not initialized");
      }
    } catch (err) {
      this.isRequestInProgress = false;
      throw err;
    }

    this.lastLatency = choiceResult.latency;
    this.modelName = choiceResult.model;

    let rawChoice = choiceResult.choice;
    const probabilities = choiceResult.probabilities || {};
    const confidence = choiceResult.confidence || 0;

    // Parse chosen direction & distance
    let chosenKey = rawChoice;
    if (!candidateMeta[chosenKey]) {
      const keys = Object.keys(candidateMeta);
      chosenKey = keys.find(k => k.startsWith(rawChoice)) || keys[0];
    }

    const meta = candidateMeta[chosenKey] || {
      direction: 'RIGHT',
      distance: 1,
      targetX: head.x + 1,
      targetY: head.y,
      isFood: false
    };

    this.lastDecision = {
      key: chosenKey,
      rawChoice,
      direction: meta.direction,
      distance: meta.distance,
      targetX: meta.targetX,
      targetY: meta.targetY,
      isFood: meta.isFood,
      probabilities,
      confidence,
      latency: this.lastLatency,
      candidateMeta,
      criteria,
      asciiMap,
      endpointUsed: choiceResult.endpointUsed
    };

    this.isRequestInProgress = false;
    return this.lastDecision;
  }
}

window.systemOne = new SystemOneController();
