// ============================================================
// kioskAudio.js
//
// Bunyi peringatan disintesis langsung lewat Web Audio API, jadi
// tidak butuh file asset/CDN eksternal (tidak bergantung koneksi,
// tidak kena batasan network, dan tidak menambah bundle size).
// ============================================================

let ctx;
const getCtx = () => {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
};

const beep = (freq, durasiMs, tipe = "sine", volume = 0.18) => {
  const audioCtx = getCtx();
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = tipe;
  osc.frequency.value = freq;
  const now = audioCtx.currentTime;
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + durasiMs / 1000);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + durasiMs / 1000);
};

// Dua nada pendek naik -- dipakai tiap kali ada pelanggaran tercatat.
export const playViolationBeep = () => {
  beep(720, 140, "square");
  window.setTimeout(() => beep(920, 160, "square"), 150);
};

// Nada turun & lebih panjang -- dipakai saat ujian dihentikan paksa
// karena pelanggaran sudah melewati batas maksimum.
export const playLockBeep = () => {
  beep(500, 220, "sawtooth", 0.22);
  window.setTimeout(() => beep(320, 380, "sawtooth", 0.22), 220);
};
