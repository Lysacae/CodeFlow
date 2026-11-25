/** Montée courte et douce, distincte du carillon de notification. */
export function playRankUpSound() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const tone = (freq: number, start: number, dur: number, volume: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    };
    tone(523.25, now, 0.18, 0.07);
    tone(659.25, now + 0.12, 0.2, 0.06);
    tone(783.99, now + 0.24, 0.22, 0.055);
    tone(1046.5, now + 0.38, 0.32, 0.05);
    window.setTimeout(() => {
      void ctx.close();
    }, 900);
  } catch {
    /* audio indisponible */
  }
}
