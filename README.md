# ⚓ 16-Bit Retro Battleship with TypeSafe System One AI

A classic 2D 16-bit naval combat arcade Battleship game powered by the **TypeSafe AI System One** non-autoregressive decision model hosted at `127.0.0.1:8000/v1/systemone`.

Styled in the exact aesthetic of the **System One Retro Arcade** collection, featuring authentic chiptune sound effects, CRT scanlines, live decision probability meters, and dual battlefield visualization.

---

## 🕹️ Game Modes

### 1. 🎮 One Player Mode (Player vs System One AI)
- **Player Fleet (Left Board)**:
  - You can view and position your fleet (Carrier, Battleship, Cruiser, Submarine, Destroyer).
  - Use **Randomize Fleet** to quickly deploy warships across the 10x10 grid.
  - See incoming artillery strikes from System One (Hits, Misses, and Sunk vessels).
- **System One Radar (Right Board)**:
  - **Fog of War**: The AI's warships are **100% hidden**.
  - Target coordinates by clicking unexplored grid cells (A-J, 1-10) with the retro crosshair.
  - Explosions (`💥`) reveal hits, water splashes (`○`) indicate misses, and sunken ships are marked (`☠`).
- **AI Turn**:
  - System One analyzes the board, determines whether it is in **Target Tracking** or **Recon Hunt** mode, computes the optimal sector, and returns a high-confidence artillery strike.

---

### 2. 👁️ Spectator Mode (System One AI vs Normal Computer)
- **Dual Battlefield Visibility**:
  - **Both battlegrounds are fully visible to the player!**
  - Left Board: System One AI fleet and incoming CPU attacks.
  - Right Board: Normal Computer fleet and incoming System One attacks.
- **System One vs Classic Algorithmic CPU**:
  - System One uses the deep non-autoregressive decision model (`strands-decider-2B-qwen3.5-v1-2610`).
  - Normal Computer uses classic naval Hunt-and-Target with checkerboard parity.
- **Simulation Controls**:
  - `▶ START DUEL`: Continuous turn-by-turn naval artillery exchange.
  - `⏸ PAUSE`: Freeze the simulation.
  - `⏩ STEP TURN`: Advance one artillery shot at a time.
  - **Simulation Speed**: Adjustable between Turbo (250ms), Fast (800ms), Normal (1.6s), and Slow (3.0s).

---

## 🧠 Live System One Telemetry & Decision Matrix

- **Real-Time Probability Meters**:
  - Displays top candidate coordinates (e.g. `B4`, `E5`, `H2`) with live animated probability bars.
  - Highlights highest-confidence targets in glowing emerald green.
- **ASCII Radar Vision**:
  - Real-time ASCII map representation showing what System One sees (`.` = Fog, `O` = Miss, `*` = Active Hit, `X` = Sunk vessel).
- **Latency & Confidence Telemetry**:
  - Live model latency (ms) and confidence percentage.
- **Sonar & Combat Feed**:
  - Scrolling 16-bit retro terminal logging every artillery fire, hit, splash, and sunken ship.

---

## 🔊 Retro Naval Audio Synthesizer

Synthesized entirely via the Web Audio API with zero external media files:
- Submarine Sonar Ping
- Artillery Torpedo Launch Whistle
- Water Splash (Miss)
- Explosive Metal Blast (Hit)
- Cascading Multi-Detonation Siren (Ship Sunk)
- 16-bit Victory Fanfare & Defeat Dirge

---

## 🚀 How to Run

1. **Ensure System One is running**:
   ```bash
   # Listening at http://127.0.0.1:8000/v1/systemone
   ```

2. **Start the Battleship Arcade Web Server**:
   ```bash
   python3 server.py 3001
   ```

3. **Open the game**:
   Navigate to [http://127.0.0.1:3001](http://127.0.0.1:3001) in your browser.
