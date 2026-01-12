/**
 * stun.js - STUN fingerprinting for connection identity
 *
 * Discovers client's public IP:port via STUN protocol.
 * Works in browser (RTCPeerConnection) or could be extended for Node.
 *
 * Usage (browser):
 *   const stun = new STUNFingerprint({ enabled: true });
 *   const addr = await stun.getPublicAddress();
 *   // { ip: "73.45.123.8", port: 54321 }
 */

class STUNFingerprint {
  constructor(opts = {}) {
    this.enabled = opts.enabled || false;
    this.server = opts.server || 'stun:stun.l.google.com:19302';
    this.timeout = opts.timeout || 3000;
    this.cached = null;
  }

  async getPublicAddress() {
    if (!this.enabled) return null;
    if (this.cached) return this.cached;

    // Browser environment check
    if (typeof RTCPeerConnection === 'undefined') {
      console.log('[stun] RTCPeerConnection not available');
      return null;
    }

    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: this.server }]
      });

      pc.createDataChannel('');  // Trigger ICE gathering

      const result = await new Promise((resolve) => {
        const timeoutId = setTimeout(() => {
          pc.close();
          resolve(null);
        }, this.timeout);

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            // Parse srflx (server reflexive = public addr)
            const match = e.candidate.candidate.match(/srflx.*?(\d+\.\d+\.\d+\.\d+)\s+(\d+)/);
            if (match) {
              clearTimeout(timeoutId);
              resolve({ ip: match[1], port: parseInt(match[2]) });
              pc.close();
            }
          } else {
            clearTimeout(timeoutId);
            resolve(null);  // Gathering complete, no srflx found
            pc.close();
          }
        };

        pc.createOffer().then(o => pc.setLocalDescription(o));
      });

      this.cached = result;
      if (result) {
        console.log(`[stun] Public address: ${result.ip}:${result.port}`);
      }
      return result;
    } catch (e) {
      console.log('[stun] Query failed:', e.message);
      return null;
    }
  }

  clearCache() {
    this.cached = null;
  }
}

// Export for both Node (CommonJS) and browser (global)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { STUNFingerprint };
} else if (typeof window !== 'undefined') {
  window.STUNFingerprint = STUNFingerprint;
}
