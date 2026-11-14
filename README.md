# 🕹️ System One Games (Retro Arcade Suite)

A unified 16-bit retro arcade game suite powered by the **TypeSafe AI System One** non-autoregressive decision model (`strands-decider-2B-qwen3.5-v1-2610`).

Includes individual routes for games and a central Arcade Hub portal, sharing unified Web Audio, CRT styling, decision client, and navigation.

---

## 🚀 Individual Routes

- **Arcade Hub (Home)**: [http://127.0.0.1:3000/](http://127.0.0.1:3000/)
- **16-Bit Battleship**: [http://127.0.0.1:3000/battleship/](http://127.0.0.1:3000/battleship/)
- **16-Bit Snake**: [http://127.0.0.1:3000/snake/](http://127.0.0.1:3000/snake/)
- **Model Proxy API**: `POST /api/systemone`
- **Config API**: `GET /api/config`

---

## ⚓ 1. 16-Bit Naval Battleship (`/battleship/`)

- **1-Player Mode (Player vs System One AI)**:
  - **Drag-and-Drop Drydock**: Arrange your 5 warships (Carrier, Battleship, Cruiser, Submarine, Destroyer) by dragging directly to the grid. Rotate with the `R` key or `ROTATE (R)` button.
  - **Fog of War**: The opponent AI's battleground is 100% hidden.
  - **Parabolic Artillery Arcs**: Artillery rockets arc across the arena with glowing flame and smoke particle trails.
  - **Naval Damage FX**: Clean, organic flame cores and rising billowing smoke plumes with zero intrusive box overlays or rectangular outlines.
  - **Crew Reaction Speech Bubbles**: Animated dialogue pops up over battlegrounds and warships with reactions from the Captain, Weapons Officer, Sonar Specialist, Damage Control Chief, and Radar Specialist.
- **Spectator Mode (System One AI vs Normal Computer)**:
  - Both fleets are visible on screen simultaneously.
  - Turn-by-turn duel simulation with continuous play (`▶ START DUEL`), step-by-step (`⏩ STEP TURN`), pause, and variable sim speeds.
- **Decision Matrix & Radar**:
  - Live ASCII radar map, latency in ms, confidence %, and candidate coordinate probability meters.

---

## 🐍 2. 16-Bit Retro Snake (`/snake/`)

- **Autonomous AI & Manual Play**:
  - Watch System One guide the snake across the grid, evaluating candidate directions (`UP`, `DOWN`, `LEFT`, `RIGHT`) in real-time.
  - Switch to manual keyboard controls (Arrow Keys / WASD) at any time.
- **Shared Retro Audio & CRT**:
  - Authentic chiptune blips, eating sound effects, game over noise bursts, and CRT toggle.

---

## 🛠️ DRY Shared Architecture (`shared/`)

The suite consolidates shared functionality into reusable modules:
- `shared/systemone.js`: Unified client for querying System One decision models, handling CORS fallback, and synchronizing model endpoint configuration across all games via `localStorage` and custom events.
- `shared/audio-core.js`: Web Audio API context management, synchronized mute state, and retro chiptune sound synthesis primitives.
- `shared/retro.css`: Universal 16-bit arcade styling, CRT scanline effects, retro pixel typography (`Press Start 2P`, `VT323`), neon buttons, cards, and modal dialogs.
- `shared/nav.js`: Global top navigation bar with quick links to all games, CRT toggle, sound toggle, and live model source configuration modal.

---

## ⚡ Quick Start

```bash
# 1. Start the System One decision model backend (default: http://127.0.0.1:8000)
# (Optional - a safe-guard heuristic operates automatically if offline)

# 2. Launch the Arcade server
python3 server.py 3000

# 3. Open your browser:
# Home Hub:   http://127.0.0.1:3000/
# Battleship: http://127.0.0.1:3000/battleship/
# Snake:      http://127.0.0.1:3000/snake/
```
