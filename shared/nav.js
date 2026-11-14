/**
 * Shared Arcade Navigation, CRT, Audio & Decisions API Configuration Controller
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

    // 3. Model Badge Setup
    const valModelName = document.getElementById('valModelName');
    if (valModelName && window.sharedSystemOne) {
      updateModelBadgeText(valModelName);
      valModelName.style.cursor = 'pointer';
      valModelName.addEventListener('click', () => openModelModal());
    }

    window.addEventListener('systemone:endpoint-changed', (e) => {
      const badge = document.getElementById('valModelName');
      if (badge) {
        updateModelBadgeText(badge);
      }
    });

    // Build Model Modal dynamically if not in DOM
    ensureModalDOM();
  }

  function updateModelBadgeText(el) {
    if (!window.sharedSystemOne) return;
    const model = window.sharedSystemOne.modelName || 'gemini-decision-1';
    const isGoogle = window.sharedSystemOne.isGoogleDecisionsEndpoint(window.sharedSystemOne.getEndpoint());
    el.textContent = isGoogle ? `⚡ ${model}` : `🧠 ${model}`;
    el.title = `Source: ${window.sharedSystemOne.getEndpoint()} (Click to configure)`;
  }

  function ensureModalDOM() {
    if (document.getElementById('arcadeModelModal')) return;

    const modal = document.createElement('div');
    modal.id = 'arcadeModelModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-box" style="max-width: 520px;">
        <div class="panel-title">
          <span>⚙️ DECISION ENGINE CONFIGURATION</span>
          <button class="retro-btn btn-sub" id="btnCloseModelModal">✕</button>
        </div>

        <div style="font-size: 8px; color: var(--text-dim); line-height: 1.5;">
          Select your tactical decision engine source. Both Google AI Studio's <strong>Decisions API</strong> and local <strong>System One</strong> models evaluate decisions in a single forward pass without generating text tokens.
        </div>

        <!-- PRESET SELECTORS -->
        <div style="display: flex; gap: 8px; margin-top: 4px;">
          <button class="retro-btn btn-sub" id="presetGoogleDecisions" style="flex: 1; font-size: 7.5px;">⚡ GOOGLE DECISIONS API</button>
          <button class="retro-btn btn-sub" id="presetLocalSystemOne" style="flex: 1; font-size: 7.5px;">💻 LOCAL SYSTEM ONE</button>
        </div>

        <!-- ENDPOINT URL -->
        <div>
          <label style="font-size: 8px; color: var(--accent-cyan); display: block; margin-bottom: 4px;">ENDPOINT REST URL:</label>
          <input type="text" class="modal-input" id="inputModalEndpoint" placeholder="https://generativelanguage.googleapis.com/v1beta/decisions">
        </div>

        <!-- API KEY CONTAINER -->
        <div id="apiKeyGroup">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <label style="font-size: 8px; color: var(--accent-gold);">GOOGLE AI STUDIO API KEY:</label>
            <span style="font-size: 7px; color: var(--text-dim); cursor: pointer;" id="toggleKeyVisibility">SHOW KEY</span>
          </div>
          <input type="password" class="modal-input" id="inputModalApiKey" placeholder="AIzaSy... (Saved locally in browser)">
          <div style="font-size: 7px; color: var(--text-dim); margin-top: 3px;">
            🔑 Required for Google Decisions API (<code>gemini-decision-1</code>).
          </div>
        </div>

        <div id="modalTestResult" style="font-family: var(--font-terminal); font-size: 15px; color: var(--accent-gold); min-height: 20px; line-height: 1.3;"></div>

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

    // Preset Handlers
    document.getElementById('presetGoogleDecisions').addEventListener('click', () => {
      document.getElementById('inputModalEndpoint').value = 'https://generativelanguage.googleapis.com/v1beta/decisions';
      document.getElementById('apiKeyGroup').style.display = 'block';
      highlightActivePreset('google');
    });

    document.getElementById('presetLocalSystemOne').addEventListener('click', () => {
      document.getElementById('inputModalEndpoint').value = 'http://127.0.0.1:8000/v1/systemone';
      document.getElementById('apiKeyGroup').style.display = 'none';
      highlightActivePreset('local');
    });

    // Key Visibility Toggle
    const toggleKeyVisibility = document.getElementById('toggleKeyVisibility');
    const inputApiKey = document.getElementById('inputModalApiKey');
    toggleKeyVisibility.addEventListener('click', () => {
      if (inputApiKey.type === 'password') {
        inputApiKey.type = 'text';
        toggleKeyVisibility.textContent = 'HIDE KEY';
      } else {
        inputApiKey.type = 'password';
        toggleKeyVisibility.textContent = 'SHOW KEY';
      }
    });

    // Test Connection Handler
    document.getElementById('btnTestEndpoint').addEventListener('click', async () => {
      const url = document.getElementById('inputModalEndpoint').value.trim();
      const apiKey = document.getElementById('inputModalApiKey').value.trim();
      const resultEl = document.getElementById('modalTestResult');
      resultEl.textContent = 'TESTING DECISION ENDPOINT...';
      resultEl.style.color = 'var(--accent-gold)';

      const res = await window.sharedSystemOne.testConnection(url, apiKey);
      if (res.ok) {
        resultEl.textContent = `✓ ONLINE: ${res.model} (${res.latency}ms latency)`;
        resultEl.style.color = 'var(--accent-green)';
        if (window.arcadeAudioCore) window.arcadeAudioCore.playAiBlip();
      } else {
        resultEl.textContent = `✗ FAILED: ${res.error}`;
        resultEl.style.color = 'var(--accent-red)';
      }
    });

    // Save & Apply Handler
    document.getElementById('btnSaveEndpoint').addEventListener('click', () => {
      const url = document.getElementById('inputModalEndpoint').value.trim();
      const apiKey = document.getElementById('inputModalApiKey').value.trim();
      if (url) {
        window.sharedSystemOne.setEndpoint(url, apiKey);
        if (window.arcadeAudioCore) window.arcadeAudioCore.playClick();
        closeModal();
      }
    });
  }

  function highlightActivePreset(type) {
    const btnGoogle = document.getElementById('presetGoogleDecisions');
    const btnLocal = document.getElementById('presetLocalSystemOne');
    if (!btnGoogle || !btnLocal) return;

    if (type === 'google') {
      btnGoogle.classList.add('btn-primary');
      btnLocal.classList.remove('btn-primary');
    } else {
      btnLocal.classList.add('btn-primary');
      btnGoogle.classList.remove('btn-primary');
    }
  }

  function openModelModal() {
    ensureModalDOM();
    const modal = document.getElementById('arcadeModelModal');
    const inputUrl = document.getElementById('inputModalEndpoint');
    const inputApiKey = document.getElementById('inputModalApiKey');
    const resultEl = document.getElementById('modalTestResult');
    const apiKeyGroup = document.getElementById('apiKeyGroup');

    if (inputUrl && window.sharedSystemOne) {
      const currentUrl = window.sharedSystemOne.getEndpoint();
      inputUrl.value = currentUrl;
      inputApiKey.value = window.sharedSystemOne.getApiKey();

      const isGoogle = window.sharedSystemOne.isGoogleDecisionsEndpoint(currentUrl);
      if (apiKeyGroup) {
        apiKeyGroup.style.display = isGoogle ? 'block' : 'none';
      }
      highlightActivePreset(isGoogle ? 'google' : 'local');
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
