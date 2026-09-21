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
// KioskLMS.jsx (page 2) - IMPROVED
//
// PERBAIKAN:
// - Better iframe error handling
// - Prevent iframe stuck dengan timeout detection
// - Improved fullscreen stability
// - Better memory management
// ============================================================

const IFRAME_LOAD_TIMEOUT = 15000; // 15 detik timeout
const IFRAME_HEALTH_CHECK_INTERVAL = 5000; // Check setiap 5 detik

export default function KioskLMS({ examData, guard, onSelesai, isMobile }) {
  const { urlLms, idKelas, expiresAt } = examData || {};

  const [iframeSiap, setIframeSiap] = useState(false);
  const [iframeError, setIframeError] = useState(null);
  const [showKonfirmasi, setShowKonfirmasi] = useState(false);
  const [menyelesaikan, setMenyelesaikan] = useState(false);
  const [sisaWaktu, setSisaWaktu] = useState(null);
  const iframeRef = useRef(null);
  const loadTimeoutRef = useRef(null);
  const healthCheckRef = useRef(null);

  const DURASI_UJIAN = 4 * 60 * 60; // 4 jam
  const TOPBAR_HEIGHT = isMobile ? 46 : 52; // Responsive topbar

  const fokusKeIframe = useCallback(() => {
    try {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.focus();
      }
    } catch (e) {
      // Cross-origin, ignore
    }
  }, []);

  // ---- Fullscreen safety check saat halaman mount ----
  useEffect(() => {
    guard.enterKiosk();
    return () => {
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
      if (healthCheckRef.current) clearInterval(healthCheckRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Iframe load timeout detection ----
  useEffect(() => {
    if (!urlLms) return;

    loadTimeoutRef.current = setTimeout(() => {
      if (!iframeSiap) {
        setIframeError("Iframe loading timeout - coba muat ulang");
        console.error("Iframe load timeout after 15s");
      }
    }, IFRAME_LOAD_TIMEOUT);

    return () => {
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    };
  }, [urlLms, iframeSiap]);

  // ---- Iframe health check (deteksi stuck) ----
  useEffect(() => {
    if (!iframeSiap) return;

    healthCheckRef.current = setInterval(() => {
      try {
        // Cek apakah iframe masih accessible
        const doc = iframeRef.current?.contentDocument;
        if (!doc && iframeSiap) {
          console.warn("Iframe health check: document not accessible");
        }
      } catch (e) {
        // Cross-origin error adalah normal, ignore
      }
    }, IFRAME_HEALTH_CHECK_INTERVAL);

    return () => {
      if (healthCheckRef.current) clearInterval(healthCheckRef.current);
    };
  }, [iframeSiap]);

  // ---- Akhiri ujian ----
  const akhiriUjian = useCallback(
    async ({ tampilkanTransisi = true } = {}) => {
      if (menyelesaikan) return;
      if (tampilkanTransisi) setMenyelesaikan(true);

      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
      if (healthCheckRef.current) clearInterval(healthCheckRef.current);

      await guard.exitKiosk();
      setTimeout(() => onSelesai?.(), tampilkanTransisi ? 450 : 0);
    },
    [guard, menyelesaikan, onSelesai],
  );

  // ---- Countdown timer ----
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

  // ---- Kalau pelanggaran melewati batas ----
  useEffect(() => {
    if (!guard.terminated) return;

    const id = window.setTimeout(() => {
      akhiriUjian({ tampilkanTransisi: true });
    }, 5000);

    return () => window.clearTimeout(id);
  }, [guard.terminated, akhiriUjian]);

  // ---- Focus ke iframe saat window focus ----
  useEffect(() => {
    const onWindowFocus = () => {
      if (showKonfirmasi || menyelesaikan || guard.terminated) return;
      if (iframeSiap) fokusKeIframe();
    };

    window.addEventListener("focus", onWindowFocus);
    return () => window.removeEventListener("focus", onWindowFocus);
  }, [
    showKonfirmasi,
    menyelesaikan,
    guard.terminated,
    iframeSiap,
    fokusKeIframe,
  ]);

  // ---- Format waktu ----
  const waktuFormatted = useMemo(() => {
    if (sisaWaktu === null) return null;
    const m = Math.floor(sisaWaktu / 60)
      .toString()
      .padStart(2, "0");
    const s = (sisaWaktu % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }, [sisaWaktu]);

  const handleSelesaiClick = (e) => {
    e?.preventDefault?.();
    setShowKonfirmasi(true);
  };
  const handleBatalSelesai = (e) => {
    e?.preventDefault?.();
    setShowKonfirmasi(false);
    fokusKeIframe();
  };
  const handleKonfirmasiSelesai = (e) => {
    e?.preventDefault?.();
    setShowKonfirmasi(false);
    akhiriUjian({ tampilkanTransisi: true });
  };

  const handleIframeLoad = () => {
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    setIframeSiap(true);
    setIframeError(null);
    fokusKeIframe();
  };

  const handleIframeError = (e) => {
    console.error("Iframe error:", e);
    setIframeError("Gagal memuat ruang ujian");
  };

  if (!urlLms) return null;

  return (
    <div
      className={`klms-shell${menyelesaikan ? " klms-shell-fading" : ""} ${isMobile ? "klms-mobile" : "klms-desktop"}`}
    >
      {/* ---------- Bar status di atas ---------- */}
      <div className="klms-topbar">
        <div className="klms-topbar-left">
          <span className="klms-lock-dot" />
          <span className="klms-topbar-label">Mode Terkunci Aktif</span>
        </div>
        <div className="klms-topbar-center">
          {idKelas && <span className="klms-topbar-exam">{idKelas}</span>}
          {/* VIOLATIONS DISPLAY DISABLED */}
          {/* {guard.violationCount > 0 && !guard.terminated && (
            <span className="klms-topbar-violation">
              Pelanggaran {guard.violationCount}/{guard.maxViolations}
            </span>
          )} */}
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
            <span>{iframeError ? iframeError : "Memuat ruang ujian…"}</span>
          </div>
        )}
        {iframeError && iframeSiap && (
          <div className="klms-frame-error">
            <WarningOutlined />
            <span>{iframeError}</span>
          </div>
        )}
        <iframe
          ref={iframeRef}
          title="Ruang Ujian LMS"
          src={urlLms}
          className={`klms-frame${iframeSiap ? " klms-frame-ready" : ""}`}
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-modals"
          allow="fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
          loading="eager"
        />
      </div>

      {/* ---------- Tombol Selesai ---------- */}
      {!menyelesaikan && !guard.terminated && iframeSiap && (
        <button
          type="button"
          className="klms-finish-btn"
          onClick={handleSelesaiClick}
          onTouchEnd={handleSelesaiClick}
        >
          <CheckCircleOutlined />
          Selesai
        </button>
      )}

      {/* ---------- VIOLATIONS DISPLAY DISABLED ---------- */}
      {/* {guard.peringatan && !guard.terminated && (
        <div className="kiosk-warning-banner">
          <WarningOutlined />
          <span>{guard.peringatan}</span>
        </div>
      )} */}

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
                onTouchEnd={handleBatalSelesai}
              >
                Batal, Kembali
              </button>
              <button
                type="button"
                className="klms-modal-btn-solid"
                onClick={handleKonfirmasiSelesai}
                onTouchEnd={handleKonfirmasiSelesai}
              >
                Ya, Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Layar kunci paksa --------- */}
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

      {/* ---------- Layar transisi keluar ---------- */}
      {menyelesaikan && (
        <div className="klms-exit-overlay">
          <LoadingOutlined spin />
          <span>Menyimpan &amp; keluar dari mode terkunci…</span>
        </div>
      )}
    </div>
  );
}
