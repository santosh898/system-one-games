/**
 * Shared TypeSafe System One & Google Gemini Decisions API Client
 * Supports:
 * 1. Google AI Studio Decisions API:
 *    - Endpoint: https://generativelanguage.googleapis.com/v1beta/decisions
 *    - Model: gemini-decision-1
 *    - Auth: x-goog-api-key header
 * 2. Local / Custom System One Decision Engines:
 *    - Endpoint: http://127.0.0.1:8000/v1/systemone
 *    - Model: strands-decider-2B-qwen3.5-v1-2610
 */
class SystemOneClient {
  constructor(defaultEndpoint = 'http://127.0.0.1:8000/v1/systemone') {
    this.defaultEndpoint = defaultEndpoint;
    this.endpoint = this.loadEndpoint();
    this.apiKey = this.loadApiKey();
    this.updateModelName();
    this.lastLatency = null;
    this.lastConfidence = null;
    this.isQuerying = false;
  }

  loadEndpoint() {
    const saved = localStorage.getItem('systemone_endpoint');
    return saved && saved.trim() ? saved.trim() : this.defaultEndpoint;
  }

  loadApiKey() {
    return localStorage.getItem('systemone_api_key') || '';
  }

  updateModelName() {
    if (this.isGoogleDecisionsEndpoint(this.endpoint)) {
      this.modelName = 'gemini-decision-1';
    } else {
      this.modelName = 'strands-decider-2B-qwen3.5-v1-2610';
    }
  }

  isGoogleDecisionsEndpoint(url) {
    if (!url) return false;
    return url.includes('googleapis.com') || url.includes('generativelanguage');
  }

  setEndpoint(url, apiKey = null) {
    const cleanUrl = (url || '').trim() || this.defaultEndpoint;
    this.endpoint = cleanUrl;
    localStorage.setItem('systemone_endpoint', cleanUrl);

    if (apiKey !== null) {
      this.setApiKey(apiKey);
    }

    this.updateModelName();
    window.dispatchEvent(new CustomEvent('systemone:endpoint-changed', {
      detail: { endpoint: cleanUrl, model: this.modelName, apiKey: this.apiKey }
    }));
    return cleanUrl;
  }

  setApiKey(key) {
    const cleanKey = (key || '').trim();
    this.apiKey = cleanKey;
    localStorage.setItem('systemone_api_key', cleanKey);
    return cleanKey;
  }

  getEndpoint() {
    return this.endpoint;
  }

  getApiKey() {
    return this.apiKey;
  }

  /**
   * Ping / Test Decisions API connection
   */
  async testConnection(customUrl = null, customApiKey = null) {
    const targetUrl = customUrl ? customUrl.trim() : this.endpoint;
    const effectiveKey = customApiKey !== null ? customApiKey.trim() : this.apiKey;
    const isGoogle = this.isGoogleDecisionsEndpoint(targetUrl);
    const testModel = isGoogle ? 'gemini-decision-1' : this.modelName;

    // Unified payload compatible with both Google Decisions API and System One
    const testPayload = {
      model: testModel,
      input: "System One arcade suite diagnostics connection test.",
      state: "System One arcade suite diagnostics connection test.",
      questions: {
        ping: {
          type: "choice",
          instructions: "Select READY if online.",
          criteria: {
            "READY": "Connection active and responsive.",
            "STANDBY": "Alternative standby mode."
          }
        }
      }
    };

    const headers = {
      'Content-Type': 'application/json'
    };
    if (effectiveKey) {
      headers['x-goog-api-key'] = effectiveKey;
    }

    const startTime = performance.now();
    let res = null;

    try {
      try {
        res = await fetch(targetUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(testPayload)
        });
      } catch (directErr) {
        // Fallback to local server proxy bridge
        const proxyHeaders = {
          'Content-Type': 'application/json',
          'X-Target-URL': targetUrl
        };
        if (effectiveKey) {
          proxyHeaders['x-goog-api-key'] = effectiveKey;
        }

        res = await fetch('/api/systemone', {
          method: 'POST',
          headers: proxyHeaders,
          body: JSON.stringify(testPayload)
        });
      }

      if (!res.ok) {
        const errText = await res.text();
        return { ok: false, error: `HTTP ${res.status}: ${errText}` };
      }

      const data = await res.json();
      const latency = Math.round(performance.now() - startTime);
      return {
        ok: true,
        latency: data.latency_ms ? Math.round(data.latency_ms) : latency,
        model: isGoogle ? 'gemini-decision-1' : (data.model || this.modelName)
      };
    } catch (err) {
      return { ok: false, error: err.message || 'Connection failed' };
    }
  }

  /**
   * Execute a Choice Decision Question (Single Forward Pass)
   */
  async queryChoice({ state, questionKey = 'decision', instructions = '', criteria = {} }) {
    if (this.isQuerying) {
      throw new Error('Decision model request already in progress');
    }

    this.isQuerying = true;
    const startTime = performance.now();
    const isGoogle = this.isGoogleDecisionsEndpoint(this.endpoint);
    const activeModel = isGoogle ? 'gemini-decision-1' : this.modelName;

    const payload = {
      model: activeModel,
      input: state, // Google Decisions API format
      state: state, // System One format
      questions: {
        [questionKey]: {
          type: 'choice',
          instructions,
          criteria
        }
      }
    };

    const reqHeaders = {
      'Content-Type': 'application/json'
    };
    if (this.apiKey) {
      reqHeaders['x-goog-api-key'] = this.apiKey;
    }

    let responseData = null;
    let endpointUsed = this.endpoint;

    try {
      let res;
      try {
        res = await fetch(endpointUsed, {
          method: 'POST',
          headers: reqHeaders,
          body: JSON.stringify(payload)
        });
      } catch (netErr) {
        // Retry through local proxy bridge (handles CORS if calling Google or remote endpoint)
        endpointUsed = '/api/systemone';
        const proxyHeaders = {
          'Content-Type': 'application/json',
          'X-Target-URL': this.endpoint
        };
        if (this.apiKey) {
          proxyHeaders['x-goog-api-key'] = this.apiKey;
        }

        res = await fetch(endpointUsed, {
          method: 'POST',
          headers: proxyHeaders,
          body: JSON.stringify(payload)
        });
      }

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`API error ${res.status}: ${errText}`);
      }

      responseData = await res.json();
    } catch (err) {
      this.isQuerying = false;
      throw err;
    }

    this.isQuerying = false;
    const elapsed = Math.round(performance.now() - startTime);
    this.lastLatency = responseData.latency_ms ? Math.round(responseData.latency_ms) : elapsed;
    if (isGoogle) {
      this.modelName = 'gemini-decision-1';
    } else if (responseData.model) {
      this.modelName = responseData.model;
    }

    const answer = responseData.answers?.[questionKey] || responseData.answers?.decision || Object.values(responseData.answers || {})[0];
    if (!answer) {
      throw new Error(`No answer received for question '${questionKey}' in Decisions API response.`);
    }

    const choice = (answer.choice || '').trim();
    const probabilities = answer.probabilities || {};
    const confidence = answer.confidence !== undefined ? answer.confidence : 0;
    this.lastConfidence = confidence;

    return {
      choice,
      probabilities,
      confidence,
      latency: this.lastLatency,
      model: this.modelName,
      endpointUsed,
      rawResponse: responseData
    };
  }
}

window.SystemOneClient = SystemOneClient;
window.sharedSystemOne = new SystemOneClient();
