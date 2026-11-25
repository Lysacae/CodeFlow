/** Carillon court, plus doux que le bip de réussite. */
export function playNotifySound() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const tone = (freq: number, start: number, dur: number, volume: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    };
    tone(784, now, 0.12, 0.07);
    tone(988, now + 0.1, 0.14, 0.06);
    tone(1175, now + 0.2, 0.18, 0.05);
    window.setTimeout(() => {
      void ctx.close();
    }, 700);
  } catch {
    /* audio indisponible */
  }
}
