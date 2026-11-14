/**
 * Shared TypeSafe System One Client
 * Provides unified API querying, latency & confidence telemetry, proxy fallbacks,
 * and persistent endpoint management across all arcade games.
 */
class SystemOneClient {
  constructor(defaultEndpoint = 'http://127.0.0.1:8000/v1/systemone') {
    this.defaultEndpoint = defaultEndpoint;
    this.endpoint = this.loadEndpoint();
    this.modelName = 'strands-decider-2B-qwen3.5-v1-2610';
    this.lastLatency = null;
    this.lastConfidence = null;
    this.isQuerying = false;
  }

  loadEndpoint() {
    const saved = localStorage.getItem('systemone_endpoint');
    return saved && saved.trim() ? saved.trim() : this.defaultEndpoint;
  }

  setEndpoint(url) {
    const clean = (url || '').trim() || this.defaultEndpoint;
    this.endpoint = clean;
    localStorage.setItem('systemone_endpoint', clean);
    window.dispatchEvent(new CustomEvent('systemone:endpoint-changed', { detail: { endpoint: clean } }));
    return clean;
  }

  getEndpoint() {
    return this.endpoint;
  }

  /**
   * Ping / Test System One endpoint connection
   */
  async testConnection(customUrl = null) {
    const targetUrl = customUrl ? customUrl.trim() : this.endpoint;
    const testPayload = {
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

    const startTime = performance.now();
    let res = null;

    try {
      try {
        res = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testPayload)
        });
      } catch (directErr) {
        // Fallback to proxy
        res = await fetch('/api/systemone', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Target-URL': targetUrl
          },
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
        model: data.model || this.modelName
      };
    } catch (err) {
      return { ok: false, error: err.message || 'Connection failed' };
    }
  }

  /**
   * Execute a System One Choice Question
   */
  async queryChoice({ state, questionKey = 'decision', instructions = '', criteria = {} }) {
    if (this.isQuerying) {
      throw new Error('System One request already in progress');
    }

    this.isQuerying = true;
    const startTime = performance.now();

    const payload = {
      state,
      questions: {
        [questionKey]: {
          type: 'choice',
          instructions,
          criteria
        }
      }
    };

    let responseData = null;
    let endpointUsed = this.endpoint;

    try {
      let res;
      try {
        res = await fetch(endpointUsed, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (netErr) {
        // Retry through local proxy bridge
        endpointUsed = '/api/systemone';
        res = await fetch(endpointUsed, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Target-URL': this.endpoint
          },
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
    if (responseData.model) {
      this.modelName = responseData.model;
    }

    const answer = responseData.answers?.[questionKey] || responseData.answers?.decision || Object.values(responseData.answers || {})[0];
    if (!answer) {
      throw new Error(`No answer received for question '${questionKey}' in System One response.`);
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
