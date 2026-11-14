/**
 * Shared Arcade Navigation, CRT, Audio & Model Configuration Controller
 */
(function() {
  function initNav() {
    // 1. Initialize CRT State
    const crtSaved = localStorage.getItem('arcade_crt');
    const isCrtActive = crtSaved === null ? true : crtSaved === 'true';
    if (isCrtActive) {
      document.body.classList.add('crt-active');
    } else {
      document.body.classList.remove('crt-active');
    }

    const btnCrtToggle = document.getElementById('btnCrtToggle');
    if (btnCrtToggle) {
      btnCrtToggle.textContent = isCrtActive ? '📺 CRT: ON' : '📺 CRT: OFF';
      btnCrtToggle.addEventListener('click', () => {
        const active = document.body.classList.toggle('crt-active');
        localStorage.setItem('arcade_crt', active ? 'true' : 'false');
        btnCrtToggle.textContent = active ? '📺 CRT: ON' : '📺 CRT: OFF';
      });
    }

    // 2. Initialize Sound State
    const btnSoundToggle = document.getElementById('btnSoundToggle');
    if (btnSoundToggle && window.arcadeAudioCore) {
      btnSoundToggle.textContent = window.arcadeAudioCore.isMuted() ? '🔇 MUTED' : '🔊 SOUND ON';
      btnSoundToggle.addEventListener('click', () => {
        const muted = window.arcadeAudioCore.toggleMute();
        btnSoundToggle.textContent = muted ? '🔇 MUTED' : '🔊 SOUND ON';
      });

      window.arcadeAudioCore.onMuteChange((muted) => {
        btnSoundToggle.textContent = muted ? '🔇 MUTED' : '🔊 SOUND ON';
      });
    }

    // 3. Model Badge and Config Modal Setup
    const valModelName = document.getElementById('valModelName');
    if (valModelName && window.sharedSystemOne) {
      valModelName.textContent = window.sharedSystemOne.modelName || 'strands-decider-2B-qwen3.5-v1-2610';
      valModelName.title = `Endpoint: ${window.sharedSystemOne.getEndpoint()} (Click to configure)`;
      valModelName.addEventListener('click', () => openModelModal());
    }

    const btnModelConfig = document.getElementById('btnModelConfig');
    if (btnModelConfig) {
      btnModelConfig.addEventListener('click', () => openModelModal());
    }

    // Build Model Modal dynamically if not in DOM
    ensureModalDOM();
  }

  function ensureModalDOM() {
    if (document.getElementById('arcadeModelModal')) return;

    const modal = document.createElement('div');
    modal.id = 'arcadeModelModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-box">
        <div class="panel-title">
          <span>⚙️ DECISION MODEL CONFIGURATION</span>
          <button class="retro-btn btn-sub" id="btnCloseModelModal">✕</button>
        </div>
        <div style="font-size: 8px; color: var(--text-dim); line-height: 1.4;">
          Configure the TypeSafe System One API endpoint. All arcade games (Battleship, Snake, future titles) dynamically use this decision source.
        </div>
        <div>
          <label style="font-size: 8px; color: var(--accent-cyan); display: block; margin-bottom: 6px;">API ENDPOINT URL:</label>
          <input type="text" class="modal-input" id="inputModalEndpoint" value="http://127.0.0.1:8000/v1/systemone" placeholder="http://127.0.0.1:8000/v1/systemone">
        </div>
        <div id="modalTestResult" style="font-family: var(--font-terminal); font-size: 15px; color: var(--accent-gold); min-height: 20px;"></div>
        <div style="display: flex; justify-content: space-between; gap: 8px;">
          <button class="retro-btn" id="btnTestEndpoint">⚡ TEST CONNECTION</button>
          <button class="retro-btn btn-primary" id="btnSaveEndpoint">💾 SAVE & APPLY</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('btnCloseModelModal').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    document.getElementById('btnTestEndpoint').addEventListener('click', async () => {
      const url = document.getElementById('inputModalEndpoint').value.trim();
      const resultEl = document.getElementById('modalTestResult');
      resultEl.textContent = 'PINGING MODEL SOURCE...';
      resultEl.style.color = 'var(--accent-gold)';

      const res = await window.sharedSystemOne.testConnection(url);
      if (res.ok) {
        resultEl.textContent = `✓ ONLINE: ${res.model} (${res.latency}ms latency)`;
        resultEl.style.color = 'var(--accent-green)';
        if (window.arcadeAudioCore) window.arcadeAudioCore.playAiBlip();
      } else {
        resultEl.textContent = `✗ OFFLINE: ${res.error}`;
        resultEl.style.color = 'var(--accent-red)';
      }
    });

    document.getElementById('btnSaveEndpoint').addEventListener('click', () => {
      const url = document.getElementById('inputModalEndpoint').value.trim();
      if (url) {
        window.sharedSystemOne.setEndpoint(url);
        const valModelName = document.getElementById('valModelName');
        if (valModelName) {
          valModelName.title = `Endpoint: ${url} (Click to configure)`;
        }
        if (window.arcadeAudioCore) window.arcadeAudioCore.playClick();
        closeModal();
      }
    });
  }

  function openModelModal() {
    ensureModalDOM();
    const modal = document.getElementById('arcadeModelModal');
    const input = document.getElementById('inputModalEndpoint');
    const resultEl = document.getElementById('modalTestResult');
    if (input && window.sharedSystemOne) {
      input.value = window.sharedSystemOne.getEndpoint();
    }
    if (resultEl) resultEl.textContent = '';
    if (modal) modal.classList.add('open');
  }

  function closeModal() {
    const modal = document.getElementById('arcadeModelModal');
    if (modal) modal.classList.remove('open');
  }

  window.openModelModal = openModelModal;
  window.addEventListener('DOMContentLoaded', initNav);
})();
