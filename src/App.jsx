import { useCallback, useRef, useState } from "react";
import "antd/dist/reset.css";
import "primereact/resources/themes/lara-light-blue/theme.css";
import "primeicons/primeicons.css";
import { WarningOutlined, ExpandOutlined } from "@ant-design/icons";
import KioskValidationToken from "./pages/KioskValidationToken";
import KioskLMS from "./pages/KioskLMS";
import useExamKioskGuard from "./component/hooks/useExamKioskGuard";
import "./App.css";

// ============================================================
// App.jsx
//
// PENTING (fix bug "fullscreen keluar sendiri saat pindah dari
// validasi token ke ruang ujian"):
//
// Fullscreen API browser mengikat status fullscreen ke ELEMEN DOM
// spesifik yang memintanya. Kalau App.jsx meng-unmount komponen
// halaman lama lalu me-mount komponen halaman baru (kondisional
// render biasa), elemen yang tadinya fullscreen ikut lenyap dari
// DOM -- dan browser OTOMATIS keluar dari fullscreen begitu itu
// terjadi.
//
// Solusinya: satu shell fullscreen di sini (shellRef) yang TIDAK
// PERNAH unmount selama sesi kiosk berjalan. Yang berganti hanya
// KONTEN di dalamnya (halaman token vs halaman ujian). guard JUGA
// cuma SATU instance, dibuat di sini, diteruskan sebagai prop ke
// KEDUA halaman -- kedua halaman TIDAK BOLEH membuat instance
// useExamKioskGuard sendiri, karena itu akan menciptakan target
// fullscreen yang berbeda-beda dan menyebabkan bug yang sama.
// ============================================================

const STEP_TOKEN = "token";
const STEP_EXAM = "exam";
const MAX_VIOLATIONS = 100;

function App() {
  const shellRef = useRef(null);
  const [step, setStep] = useState(STEP_TOKEN);
  const [examData, setExamData] = useState(null);

  const handleTerminate = useCallback(() => {
    // Masing-masing halaman menampilkan UI terminasinya sendiri
    // lewat guard.terminated -- di sini cukup dibiarkan kosong.
  }, []);

  const guard = useExamKioskGuard({
    targetRef: shellRef,
    maxViolations: MAX_VIOLATIONS,
    onTerminate: handleTerminate,
    active: true,
  });

  const handleTokenValid = useCallback((data) => {
    setExamData(data);
    setStep(STEP_EXAM);
  }, []);

  const handleExamFinished = useCallback(() => {
    setExamData(null);
    setStep(STEP_TOKEN);
  }, []);

  return (
    <div ref={shellRef} className="kiosk-shell-root">
      {step === STEP_EXAM && examData ? (
        <KioskLMS
          examData={examData}
          guard={guard}
          onSelesai={handleExamFinished}
        />
      ) : (
        <KioskValidationToken guard={guard} onTokenValid={handleTokenValid} />
      )}

      {/* ---------- Banner peringatan pelanggaran (global, di atas semua halaman) ---------- */}
      {guard.peringatan && !guard.terminated && (
        <div className="kiosk-warning-banner">
          <WarningOutlined />
          <span>{guard.peringatan}</span>
        </div>
      )}

      {/* ----------------------------------------------------------------
          Overlay "kembali ke mode terkunci" -- ditampilkan setiap kali
          fullscreen terdeteksi keluar SELAMA sesi terkunci berlangsung.
          Klik tombol di sini adalah user-gesture asli, satu-satunya cara
          yang bisa diandalkan browser manapun untuk benar-benar kembali
          ke fullscreen. Auto-retry di background (di dalam hook) tetap
          dicoba duluan, overlay ini hanya muncul kalau itu gagal.
         ---------------------------------------------------------------- */}
      {guard.locked && guard.fullscreenLost && !guard.terminated && (
        <div className="kiosk-resume-overlay">
          <div className="kiosk-resume-card">
            <ExpandOutlined />
            <h2>Anda Keluar dari Mode Terkunci</h2>
            <p>
              Layar ujian harus tetap dalam mode layar penuh. Tekan tombol di
              bawah untuk melanjutkan.
            </p>
            <button type="button" onClick={guard.enterKiosk}>
              Kembali ke Mode Terkunci
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
