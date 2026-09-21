import { useCallback, useRef, useState, useEffect } from "react";
import "antd/dist/reset.css";
import "primereact/resources/themes/lara-light-blue/theme.css";
import "primeicons/primeicons.css";
import { WarningOutlined, ExpandOutlined } from "@ant-design/icons";
import KioskValidationToken from "./pages/KioskValidationToken";
import KioskLMS from "./pages/KioskLMS";
import useExamKioskGuard from "./component/hooks/useExamKioskGuard";
import "./App.css";

// ============================================================
// App.jsx (IMPROVED v3 - RESPONSIVE)
//
// PERBAIKAN:
// - Responsive desktop + mobile
// - Better fullscreen state management
// - Memory leak prevention
// - Mobile viewport + safe-area fixes
// - Touch event handling
// ============================================================

const STEP_TOKEN = "token";
const STEP_EXAM = "exam";
const MAX_VIOLATIONS = 4;

function App() {
  const shellRef = useRef(null);
  const [step, setStep] = useState(STEP_TOKEN);
  const [examData, setExamData] = useState(null);
  const [appReady, setAppReady] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // ---- Detect mobile + setup viewport ----
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    // Setup viewport meta tag
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute(
        "content",
        "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover",
      );
    }

    // Prevent iOS scroll bounce
    document.body.addEventListener(
      "touchmove",
      (e) => {
        if (e.target === document.body) {
          e.preventDefault();
        }
      },
      { passive: false },
    );

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  const handleTerminate = useCallback(() => {
    // Guard akan handle UI termination lewat guard.terminated
  }, []);

  const guard = useExamKioskGuard({
    targetRef: shellRef,
    maxViolations: MAX_VIOLATIONS,
    onTerminate: handleTerminate,
    active: appReady,
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
    <div
      ref={shellRef}
      className={`kiosk-shell-root ${isMobile ? "mobile" : "desktop"}`}
      data-device={isMobile ? "mobile" : "desktop"}
    >
      {step === STEP_EXAM && examData ? (
        <KioskLMS
          examData={examData}
          guard={guard}
          onSelesai={handleExamFinished}
          isMobile={isMobile}
        />
      ) : (
        <KioskValidationToken
          guard={guard}
          onTokenValid={handleTokenValid}
          isMobile={isMobile}
        />
      )}

      {/* VIOLATIONS WARNING DISABLED */}
      {/* {guard.peringatan && !guard.terminated && (
        <div className="kiosk-warning-banner">
          <WarningOutlined />
          <span>{guard.peringatan}</span>
        </div>
      )} */}

      {/* ---- Resume fullscreen overlay ---- */}
      {guard.locked && guard.fullscreenLost && !guard.terminated && (
        <div className="kiosk-resume-overlay">
          <div className="kiosk-resume-card">
            <ExpandOutlined />
            <h2>Anda Keluar dari Mode Terkunci</h2>
            <p>
              Layar ujian harus tetap dalam mode layar penuh. Tekan tombol di
              bawah untuk melanjutkan.
            </p>
            <button
              type="button"
              onClick={guard.enterKiosk}
              className="kiosk-resume-btn"
              onTouchEnd={guard.enterKiosk}
            >
              Kembali ke Mode Terkunci
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
