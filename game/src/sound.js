// Synthesised sound only — no audio files. A low engine hum whose pitch
// follows throttle, a bright chime for a ring, a thud for a crash.
export function createSound() {
  let ctx = null; let osc = null; let osc2 = null; let gain = null; let muted = false;
  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 62;
      osc2 = ctx.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = 124;
      gain = ctx.createGain(); gain.gain.value = 0;
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 420;
      osc.connect(filter); osc2.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc2.start();
      return true;
    } catch { return false; }
  }
  function tone(freq, dur, type, vol, when) {
    if (!ctx || muted) return;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0, ctx.currentTime + (when || 0));
    g.gain.linearRampToValueAtTime(vol || 0.18, ctx.currentTime + (when || 0) + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (when || 0) + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(ctx.currentTime + (when || 0)); o.stop(ctx.currentTime + (when || 0) + dur + 0.05);
  }
  return {
    startEngine() { if (ensure() && ctx.state === 'suspended') ctx.resume(); },
    setEngine(throttle, speed) {
      if (!ctx || muted || !gain) return;
      const f = 52 + throttle * 55 + speed * 0.4;
      osc.frequency.setTargetAtTime(f, ctx.currentTime, 0.08);
      osc2.frequency.setTargetAtTime(f * 2, ctx.currentTime, 0.08);
      gain.gain.setTargetAtTime(0.05, ctx.currentTime, 0.1);
    },
    stopEngine() { if (gain && ctx) gain.gain.setTargetAtTime(0, ctx.currentTime, 0.1); },
    ring(golden) {
      if (!ensure()) return;
      if (golden) { tone(1174, 0.3, 'sine', 0.2); tone(1568, 0.4, 'sine', 0.18, 0.08); tone(2093, 0.5, 'sine', 0.14, 0.16); return; }
      tone(880, 0.35, 'sine', 0.2); tone(1318, 0.5, 'sine', 0.16, 0.09);
    },
    crash() { if (!ensure()) return; tone(70, 0.5, 'sawtooth', 0.25); tone(45, 0.7, 'triangle', 0.2, 0.05); },
    toggleMute() { muted = !muted; if (gain && ctx) gain.gain.setTargetAtTime(muted ? 0 : 0.05, ctx.currentTime, 0.05); return muted; },
  };
}
