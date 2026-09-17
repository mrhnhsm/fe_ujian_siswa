import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  LoadingOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  FieldTimeOutlined,
  StopOutlined,
} from "@ant-design/icons";
import "../assets/page/kioskLms.css";

// ============================================================
// KioskLMS.jsx  (page 2)
//
// PENTING: halaman ini TIDAK LAGI membuat instance
// useExamKioskGuard sendiri. `guard` diterima sebagai PROP dari
// App.jsx -- SAMA PERSIS dengan instance yang dipakai
// KioskValidationToken. Karena fullscreen sudah aktif sejak
// gerbang di halaman sebelumnya, dan target-nya adalah shell di
// App.jsx yang tidak pernah unmount, mode kiosk di sini otomatis
// tetap aktif tanpa perlu gerbang/klik kedua -- dan yang lebih
// penting, TIDAK keluar dari fullscreen saat "pindah halaman" ini.
// ============================================================

export default function KioskLMS({ examData, guard, onSelesai }) {
  const { urlLms, idKelas, expiresAt } = examData || {};

  const [iframeSiap, setIframeSiap] = useState(false);
  const [showKonfirmasi, setShowKonfirmasi] = useState(false);
  const [menyelesaikan, setMenyelesaikan] = useState(false);
  const [sisaWaktu, setSisaWaktu] = useState(null); // detik

  const DURASI_UJIAN = 4 * 60 * 60; // 4 jam

  // ---- jaga-jaga: pastikan masih fullscreen begitu halaman ini tampil.
  // Ini idempotent (enterKiosk cek `!sedangFullscreen()` dulu), jadi
  // aman dipanggil ulang -- fullscreen TIDAK akan sempat keluar karena
  // shell/target-nya sama dan tidak pernah unmount. ----
  useEffect(() => {
    guard.enterKiosk();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- akhiri ujian (dipakai baik oleh tombol Selesai maupun waktu habis/terminasi) ----
  const akhiriUjian = useCallback(
    async ({ tampilkanTransisi = true } = {}) => {
      if (menyelesaikan) return;
      if (tampilkanTransisi) setMenyelesaikan(true);
      await guard.exitKiosk();
      setTimeout(() => onSelesai?.(), tampilkanTransisi ? 450 : 0);
    },
    [guard, menyelesaikan, onSelesai],
  );

  // ---- countdown dari expires_at ----
  // useEffect(() => {
  //   if (!expiresAt) return undefined;
  //   const target = new Date(expiresAt.replace(" ", "T")).getTime();
  //   if (Number.isNaN(target)) return undefined;
  //   const tick = () => {
  //     const detik = Math.max(0, Math.floor((target - Date.now()) / 1000));
  //     setSisaWaktu(detik);
  //     if (detik <= 0) {
  //       window.clearInterval(id);
  //       akhiriUjian({ tampilkanTransisi: true });
  //     }
  //   };
  //   tick();
  //   const id = window.setInterval(tick, 1000);
  //   return () => window.clearInterval(id);
  // }, [expiresAt, akhiriUjian]);

  useEffect(() => {
    let waktu = DURASI_UJIAN;
    setSisaWaktu(waktu);
    const id = window.setInterval(() => {
      waktu -= 1;
      setSisaWaktu(Math.max(0, waktu));
      if (waktu <= 0) {
        window.clearInterval(id);
        akhiriUjian({ tampilkanTransisi: true });
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [akhiriUjian]);

  // ---- kalau pelanggaran melewati batas, kunci & akhiri paksa ----
  useEffect(() => {
    if (!guard.terminated) return undefined;
    const id = window.setTimeout(() => {
      akhiriUjian({ tampilkanTransisi: true });
    }, 5000);
    return () => window.clearTimeout(id);
  }, [guard.terminated, akhiriUjian]);

  const waktuFormatted = useMemo(() => {
    if (sisaWaktu === null) return null;
    const m = Math.floor(sisaWaktu / 60)
      .toString()
      .padStart(2, "0");
    const s = (sisaWaktu % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }, [sisaWaktu]);

  const handleSelesaiClick = () => setShowKonfirmasi(true);
  const handleBatalSelesai = () => setShowKonfirmasi(false);
  const handleKonfirmasiSelesai = () => {
    setShowKonfirmasi(false);
    akhiriUjian({ tampilkanTransisi: true });
  };

  if (!urlLms) return null;

  return (
    <div className={`klms-shell${menyelesaikan ? " klms-shell-fading" : ""}`}>
      {/* ---------- Bar status di atas ---------- */}
      <div className="klms-topbar">
        <div className="klms-topbar-left">
          <span className="klms-lock-dot" />
          <span className="klms-topbar-label">Mode Terkunci Aktif</span>
        </div>
        <div className="klms-topbar-center">
          {idKelas && <span className="klms-topbar-exam">{idKelas}</span>}
          {guard.violationCount > 0 && !guard.terminated && (
            <span className="klms-topbar-violation">
              Pelanggaran {guard.violationCount}/{guard.maxViolations}
            </span>
          )}
        </div>
        <div className="klms-topbar-right">
          {waktuFormatted && (
            <span className="klms-topbar-duration">
              <FieldTimeOutlined /> {waktuFormatted}
            </span>
          )}
        </div>
      </div>

      {/* ---------- Iframe LMS ---------- */}
      <div className="klms-frame-wrap">
        {!iframeSiap && (
          <div className="klms-frame-loading">
            <LoadingOutlined spin />
            <span>Memuat ruang ujian…</span>
          </div>
        )}
        <iframe
          title="Ruang Ujian LMS"
          src={urlLms}
          className={`klms-frame${iframeSiap ? " klms-frame-ready" : ""}`}
          onLoad={() => setIframeSiap(true)}
          allow="fullscreen"
        />
      </div>

      {/* ---------- Tombol Selesai mengambang ---------- */}
      {!menyelesaikan && !guard.terminated && (
        <button
          type="button"
          className="klms-finish-btn"
          onClick={handleSelesaiClick}
        >
          <CheckCircleOutlined />
          Selesai
        </button>
      )}

      {/* ---------- Banner peringatan ---------- */}
      {guard.peringatan && !guard.terminated && (
        <div className="kiosk-warning-banner">
          <WarningOutlined />
          <span>{guard.peringatan}</span>
        </div>
      )}

      {/* ---------- Modal konfirmasi selesai ---------- */}
      {showKonfirmasi && (
        <div className="klms-modal-overlay" role="dialog" aria-modal="true">
          <div className="klms-modal-card">
            <div className="klms-modal-badge">
              <CheckCircleOutlined />
            </div>
            <h2 className="klms-modal-title">Akhiri ujian sekarang?</h2>
            <p className="klms-modal-text">
              Pastikan seluruh jawaban Anda sudah tersimpan di LMS. Setelah ini,
              mode terkunci akan berakhir dan Anda tidak bisa kembali ke ruang
              ujian.
            </p>
            <div className="klms-modal-actions">
              <button
                type="button"
                className="klms-modal-btn-ghost"
                onClick={handleBatalSelesai}
              >
                Batal, Kembali
              </button>
              <button
                type="button"
                className="klms-modal-btn-solid"
                onClick={handleKonfirmasiSelesai}
              >
                Ya, Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Layar kunci paksa akibat pelanggaran berulang ---------- */}
      {guard.terminated && (
        <div className="klms-lockdown-overlay">
          <StopOutlined />
          <h2>Ujian Dihentikan</h2>
          <p>
            Sistem mendeteksi {guard.violationCount} pelanggaran keamanan selama
            ujian berlangsung. Sesi ini telah dikunci dan akan ditutup otomatis.
            Hubungi pengawas/admin sekolah Anda.
          </p>
        </div>
      )}

      {/* ---------- Layar transisi saat menyelesaikan ---------- */}
      {menyelesaikan && (
        <div className="klms-exit-overlay">
          <LoadingOutlined spin />
          <span>Menyimpan &amp; keluar dari mode terkunci…</span>
        </div>
      )}
    </div>
  );
}
