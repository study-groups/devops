/**
 * tscale.js - Tau-Scale Synaptic Pulse Detector (TS-SPD)
 *
 * JS port of tau_lib/algorithms/tscale/tscale.c
 * Parity with bash/vox/vox_analyze.sh (vox_analyze, vox_rms, vox_vad)
 *
 * Bi-exponential IIR filter: k(t) = exp(-t/τr) - exp(-t/τa)
 * Onset detection via adaptive threshold: μ + λ·σ
 * VAD via RMS envelope + peak-relative dB threshold + hangover
 */
(function(exports) {
    'use strict';

    // Bi-exponential IIR: LP(τr) - LP(τa), L2 normalized
    // Causal single-pass filter
    function iirBiexp(pcm, fs, ta, tr) {
        var dt = 1.0 / fs;
        var ar = Math.exp(-dt / tr);   // recovery LP pole
        var aa = Math.exp(-dt / ta);   // attack LP pole
        var sr = 0, sa = 0;
        var g = Math.hypot(1.0 - ar, 1.0 - aa);
        var gain = g > 0 ? 1.0 / g : 1.0;
        var N = pcm.length;
        var out = new Float64Array(N);
        for (var n = 0; n < N; n++) {
            sr = ar * sr + (1.0 - ar) * pcm[n];
            sa = aa * sa + (1.0 - aa) * pcm[n];
            out[n] = (sr - sa) * gain;
        }
        return out;
    }

    // Zero-phase: forward-backward for no phase lag (offline)
    function zerophase(pcm, fs, ta, tr) {
        var fwd = iirBiexp(pcm, fs, ta, tr);
        var N = fwd.length;
        var rev = new Float64Array(N);
        for (var i = 0; i < N; i++) rev[i] = fwd[N - 1 - i];
        var bwd = iirBiexp(rev, fs, ta, tr);
        var out = new Float64Array(N);
        for (var j = 0; j < N; j++) out[j] = bwd[N - 1 - j];
        return out;
    }

    // Onset detection: adaptive threshold μ + λ·σ with refractory period
    // opts: { ta, tr, threshold (λ), refractory (sec) }
    // Returns array of onset times in seconds
    function detectOnsets(pcm, fs, opts) {
        opts = opts || {};
        var ta = opts.ta || 0.005;
        var tr = opts.tr || 0.010;
        var thrLambda = opts.threshold || 3.5;
        var refSec = opts.refractory || 0.120;

        var filtered = zerophase(pcm, fs, ta, tr);
        var dt = 1.0 / fs;
        var emaT = 0.250;  // 250ms EMA window
        var alpha = 1.0 - Math.exp(-dt / emaT);
        var mu = 0, s2 = 1e-8;
        var refSamp = Math.round(refSec * fs);
        var cooldown = 0;
        var onsets = [];

        for (var n = 0; n < filtered.length; n++) {
            var env = Math.abs(filtered[n]);
            mu = (1.0 - alpha) * mu + alpha * env;
            var d = env - mu;
            s2 = (1.0 - alpha) * s2 + alpha * (d * d);
            var sigma = Math.sqrt(Math.max(s2, 1e-12));

            if (cooldown > 0) cooldown--;
            if (cooldown === 0 && env > mu + thrLambda * sigma) {
                onsets.push(n / fs);
                cooldown = refSamp;
            }
        }
        return onsets;
    }

    // RMS envelope at hopMs intervals via bi-exp filter
    // Returns { hopMs, values[] }
    function rms(pcm, fs, hopMs) {
        hopMs = hopMs || 20;
        var tauSec = hopMs / 1000;
        var filtered = iirBiexp(pcm, fs, tauSec, tauSec * 2);
        var hopSamples = Math.floor(fs * hopMs / 1000);
        var values = [];
        for (var i = 0; i < filtered.length; i += hopSamples) {
            values.push(Math.abs(filtered[i]));
        }
        return { hopMs: hopMs, values: values };
    }

    // VAD: speech segments from RMS + peak-relative dB threshold + hangover
    // opts: { thresholdDb, hangoverMs }
    // Returns array of { start, end } in seconds
    function vad(pcm, fs, opts) {
        opts = opts || {};
        var thresholdDb = opts.thresholdDb || -40;
        var hangoverMs = opts.hangoverMs || 300;
        var hopMs = 20;

        var envelope = rms(pcm, fs, hopMs);
        var vals = envelope.values;
        var hopSec = hopMs / 1000;

        // Find peak
        var peak = 0;
        for (var i = 0; i < vals.length; i++) {
            if (vals[i] > peak) peak = vals[i];
        }

        // dB to linear: peak * 10^(dB/20)
        var thrLin = peak * Math.pow(10, thresholdDb / 20);
        if (thrLin < 1e-8) thrLin = 1e-8;

        var hangFrames = Math.floor(hangoverMs / hopMs);
        var segments = [];
        var segStart = -1;
        var hangCount = 0;

        for (var k = 0; k < vals.length; k++) {
            var t = k * hopSec;
            if (vals[k] >= thrLin) {
                if (segStart < 0) segStart = t;
                hangCount = hangFrames;
            } else {
                if (hangCount > 0) {
                    hangCount--;
                } else if (segStart >= 0) {
                    segments.push({ start: segStart, end: t });
                    segStart = -1;
                }
            }
        }
        if (segStart >= 0) {
            segments.push({ start: segStart, end: (vals.length - 1) * hopSec });
        }
        return segments;
    }

    // Full analysis: returns { onsets[], segments[], rms{} }
    function analyze(pcm, fs, opts) {
        return {
            onsets: detectOnsets(pcm, fs, opts),
            segments: vad(pcm, fs, opts),
            rms: rms(pcm, fs, (opts && opts.hopMs) || 20)
        };
    }

    exports.Tscale = {
        iirBiexp: iirBiexp,
        zerophase: zerophase,
        detectOnsets: detectOnsets,
        rms: rms,
        vad: vad,
        analyze: analyze
    };

})(typeof window !== 'undefined' ? window : module.exports);
