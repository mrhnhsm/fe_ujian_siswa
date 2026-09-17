// ============================================================
// kioskAudio.js
//
// Bunyi peringatan disintesis langsung lewat Web Audio API, jadi
// tidak butuh file asset/CDN eksternal (tidak bergantung koneksi,
// tidak kena batasan network, dan tidak menambah bundle size).
//
// PERUBAHAN: dari "beep" pendek jadi SIREN sungguhan -- frekuensi
// disapu naik-turun berulang (efek "wail" khas alarm/sirine),
// melalui DynamicsCompressorNode supaya bisa lebih keras tanpa
// pecah/clipping di speaker HP yang kecil.
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

// ---- satu lapis oscillator sirine: frekuensi naik-turun berulang ----
const tambahLapisSiren = (
  audioCtx,
  destination,
  { freqLow, freqHigh, durasiSiklusMs, jumlahSiklus, tipe, mulaiOffsetMs = 0 },
) => {
  const osc = audioCtx.createOscillator();
  osc.type = tipe;

  const now = audioCtx.currentTime + mulaiOffsetMs / 1000;
  const siklusDetik = durasiSiklusMs / 1000;

  osc.frequency.setValueAtTime(freqLow, now);
  for (let i = 0; i < jumlahSiklus; i += 1) {
    const tMulai = now + i * siklusDetik;
    const tPuncak = tMulai + siklusDetik / 2;
    const tSelesai = tMulai + siklusDetik;
    // pakai exponential ramp supaya perubahan nada terdengar lebih
    // "menderu" seperti sirine asli, bukan linear yang terasa datar
    osc.frequency.exponentialRampToValueAtTime(freqHigh, tPuncak);
    osc.frequency.exponentialRampToValueAtTime(freqLow, tSelesai);
  }

  osc.connect(destination);
  const totalDetik = siklusDetik * jumlahSiklus;
  osc.start(now);
  osc.stop(now + totalDetik + 0.05);
  return totalDetik;
};

// ---- rangkaian umum: gain envelope + compressor (biar keras tapi aman) ----
const mainkanSiren = (audioCtx, lapisan, volume) => {
  const gain = audioCtx.createGain();
  const compressor = audioCtx.createDynamicsCompressor();

  const now = audioCtx.currentTime;
  const totalDurasi = Math.max(
    ...lapisan.map(
      (l) =>
        (l.mulaiOffsetMs || 0) / 1000 +
        (l.durasiSiklusMs / 1000) * l.jumlahSiklus,
    ),
  );

  // Envelope: naik cepat (attack), tahan penuh, turun halus di akhir
  // supaya tidak ada "klik" kasar saat suara berhenti.
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.04);
  gain.gain.setValueAtTime(volume, now + Math.max(0, totalDurasi - 0.12));
  gain.gain.exponentialRampToValueAtTime(0.0001, now + totalDurasi);

  // Compressor menekan puncak volume secara otomatis sehingga level
  // keseluruhan bisa dinaikkan jauh lebih tinggi tanpa terdengar
  // pecah/distorsi di speaker kecil (khas speaker HP).
  compressor.threshold.setValueAtTime(-8, now);
  compressor.knee.setValueAtTime(14, now);
  compressor.ratio.setValueAtTime(10, now);
  compressor.attack.setValueAtTime(0.002, now);
  compressor.release.setValueAtTime(0.12, now);

  gain.connect(compressor);
  compressor.connect(audioCtx.destination);

  lapisan.forEach((l) => tambahLapisSiren(audioCtx, gain, l));
};

// Sirine pendek & tajam -- dipakai tiap kali ada pelanggaran tercatat.
// Satu sapuan naik-turun cepat, cukup mengagetkan tanpa terlalu
// mengganggu karena bisa terjadi berkali-kali selama ujian.
export const playViolationBeep = () => {
  const audioCtx = getCtx();
  if (!audioCtx) return;
  mainkanSiren(
    audioCtx,
    [
      {
        freqLow: 600,
        freqHigh: 1200,
        durasiSiklusMs: 220,
        jumlahSiklus: 2,
        tipe: "square",
      },
    ],
    0.55,
  );
};

// Sirine besar & panjang -- dipakai saat ujian dihentikan paksa
// karena pelanggaran sudah melewati batas maksimum. Dua lapis
// oscillator (square + sawtooth, sedikit beda fase) ditumpuk supaya
// terdengar lebih "tebal"/besar seperti sirine darurat sungguhan,
// bukan sekadar nada tunggal.
export const playLockBeep = () => {
  const audioCtx = getCtx();
  if (!audioCtx) return;
  mainkanSiren(
    audioCtx,
    [
      {
        freqLow: 420,
        freqHigh: 880,
        durasiSiklusMs: 500,
        jumlahSiklus: 4,
        tipe: "sawtooth",
      },
      {
        freqLow: 440,
        freqHigh: 900,
        durasiSiklusMs: 500,
        jumlahSiklus: 4,
        tipe: "square",
        mulaiOffsetMs: 40, // sedikit offset -> efek "detune" alami, lebih besar/rich
      },
    ],
    0.6,
  );
};
