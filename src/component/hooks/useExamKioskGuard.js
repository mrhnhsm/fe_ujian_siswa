import { useCallback, useEffect, useRef, useState } from "react";
import { playViolationBeep, playLockBeep } from "./kioskAudio";

// ============================================================
// useExamKioskGuard (IMPROVED v2)
//
// Hook keamanan "lockdown browser" berbasis web untuk halaman ujian.
// PERBAIKAN:
// - Violations display DISABLED (hanya play sound)
// - Better fullscreen handling untuk mobile (fix mereng)
// - Improved DevTools detection dengan debounce
// - Better iframe stability
// ============================================================

const DEFAULT_MAX_VIOLATIONS = 4;
const DEVTOOLS_THRESHOLD = 160;
const DEVTOOLS_POLL_MS = 2000;
const HISTORY_BUFFER_DEPTH = 5;
const FULLSCREEN_RETRY_DELAY = 500;
const MAX_FULLSCREEN_RETRIES = 3;

// UNCOMMENT di bawah kalau ingin ENABLE violations display
// const SHOW_VIOLATIONS = true;
const SHOW_VIOLATIONS = false; // DISABLED - hanya play sound

const shortcutTerlarang = (e) => {
  const key = e.key?.toLowerCase();
  if (["f11", "f12", "f5"].includes(key)) return true;
  if (
    (e.ctrlKey || e.metaKey) &&
    !e.altKey &&
    ["r", "w", "t", "n", "p", "s", "u", "d"].includes(key)
  )
    return true;
  if (
    (e.ctrlKey || e.metaKey) &&
    e.shiftKey &&
    ["i", "j", "c", "k"].includes(key)
  )
    return true;
  return false;
};

const requestFullscreenAman = (el) => {
  const fn =
    el?.requestFullscreen ||
    el?.webkitRequestFullscreen ||
    el?.msRequestFullscreen ||
    el?.mozRequestFullScreen;
  if (!fn) return Promise.reject(new Error("Fullscreen API tidak didukung"));
  return fn.call(el);
};

const exitFullscreenAman = () => {
  const fn =
    document.exitFullscreen ||
    document.webkitExitFullscreen ||
    document.msExitFullscreen ||
    document.mozCancelFullScreen;
  if (fn && sedangFullscreen()) return fn.call(document);
  return Promise.resolve();
};

const sedangFullscreen = () =>
  !!(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.msFullscreenElement ||
    document.mozFullScreenElement
  );

export default function useExamKioskGuard({
  targetRef,
  maxViolations = DEFAULT_MAX_VIOLATIONS,
  onTerminate,
  active = true,
} = {}) {
  const [locked, setLocked] = useState(false);
  const [violations, setViolations] = useState([]);
  const [peringatan, setPeringatan] = useState(null);
  const [terminated, setTerminated] = useState(false);
  const [fullscreenLost, setFullscreenLost] = useState(false);

  const lockedRef = useRef(false);
  const terminatedRef = useRef(false);
  const warningTimerRef = useRef(null);
  const devtoolsIntervalRef = useRef(null);
  const fullscreenRetryRef = useRef(0);
  const lastViolationTimeRef = useRef(0);

  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

  const tampilkanPeringatan = useCallback((pesan) => {
    // DISABLED: Tidak menampilkan warning banner untuk violations
    // Uncomment di bawah kalau ingin re-enable
    // setPeringatan(pesan);
    // window.clearTimeout(warningTimerRef.current);
    // warningTimerRef.current = window.setTimeout(
    //   () => setPeringatan(null),
    //   4200,
    // );
  }, []);

  const catatPelanggaran = useCallback(
    (jenis, pesan) => {
      if (!lockedRef.current || terminatedRef.current) return;

      const now = Date.now();
      // Debounce: cegah double-recording dalam 100ms
      if (now - lastViolationTimeRef.current < 100) return;
      lastViolationTimeRef.current = now;

      // SELALU play sound (tidak peduli SHOW_VIOLATIONS)
      playViolationBeep();

      // Tampilkan warning HANYA kalau SHOW_VIOLATIONS = true
      if (SHOW_VIOLATIONS) {
        tampilkanPeringatan(pesan);
      }

      setViolations((prev) => {
        const next = [...prev, { jenis, waktu: Date.now() }];
        if (next.length >= maxViolations && !terminatedRef.current) {
          terminatedRef.current = true;
          window.clearInterval(devtoolsIntervalRef.current);
          setTerminated(true);
          playLockBeep();
          onTerminate?.(next);
        }
        return next;
      });
    },
    [maxViolations, onTerminate, tampilkanPeringatan],
  );

  const cobaKunciUlangFullscreen = useCallback(async () => {
    if (
      !targetRef?.current ||
      fullscreenRetryRef.current >= MAX_FULLSCREEN_RETRIES
    ) {
      return;
    }

    try {
      fullscreenRetryRef.current += 1;
      await requestFullscreenAman(targetRef.current);
      fullscreenRetryRef.current = 0; // Reset kalau berhasil
    } catch (error) {
      // Browser ditolak (mis. cooldown setelah Esc), coba ulang nanti
      if (fullscreenRetryRef.current >= MAX_FULLSCREEN_RETRIES) {
        fullscreenRetryRef.current = 0;
      }
    }
  }, [targetRef]);

  // ---- fullscreen change ----
  useEffect(() => {
    if (!active) return undefined;

    const handler = () => {
      if (!lockedRef.current || terminatedRef.current) return;
      if (!sedangFullscreen()) {
        setFullscreenLost(true);
        catatPelanggaran("fullscreen", "Anda keluar dari mode layar penuh.");
        // Retry dengan delay untuk mobile (jangan langsung, biar tidak race condition)
        setTimeout(() => cobaKunciUlangFullscreen(), FULLSCREEN_RETRY_DELAY);
      } else {
        setFullscreenLost(false);
        fullscreenRetryRef.current = 0;
      }
    };

    document.addEventListener("fullscreenchange", handler);
    document.addEventListener("webkitfullscreenchange", handler);
    document.addEventListener("MSFullscreenChange", handler);

    return () => {
      document.removeEventListener("fullscreenchange", handler);
      document.removeEventListener("webkitfullscreenchange", handler);
      document.removeEventListener("MSFullscreenChange", handler);
    };
  }, [active, catatPelanggaran, cobaKunciUlangFullscreen]);

  // ---- ganti tab / minimize / alt-tab ----
  useEffect(() => {
    if (!active) return undefined;

    const onVisibility = () => {
      if (document.hidden) {
        catatPelanggaran(
          "tab-switch",
          "Terdeteksi Anda berpindah tab/aplikasi. Aktivitas ini tercatat.",
        );
      } else if (
        lockedRef.current &&
        !terminatedRef.current &&
        !sedangFullscreen()
      ) {
        setTimeout(() => cobaKunciUlangFullscreen(), FULLSCREEN_RETRY_DELAY);
      }
    };

    const onBlur = () => {
      if (!document.hidden) {
        catatPelanggaran(
          "window-blur",
          "Jendela ujian kehilangan fokus. Aktivitas ini tercatat.",
        );
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
    };
  }, [active, catatPelanggaran, cobaKunciUlangFullscreen]);

  // ---- keyboard shortcut, klik kanan, & buka tab baru ----
  useEffect(() => {
    if (!active) return undefined;

    const onKeyDown = (e) => {
      if (!lockedRef.current || terminatedRef.current) return;
      if (shortcutTerlarang(e)) {
        e.preventDefault();
        e.stopPropagation();
        catatPelanggaran(
          "shortcut",
          "Kombinasi tombol tersebut dinonaktifkan selama ujian.",
        );
      }
    };

    const onContextMenu = (e) => {
      if (!lockedRef.current || terminatedRef.current) return;
      e.preventDefault();
    };

    const onMouseDownCapture = (e) => {
      if (!lockedRef.current || terminatedRef.current) return;
      const isMiddle = e.button === 1;
      const isModified = e.ctrlKey || e.metaKey || e.shiftKey;
      const anchor = e.target?.closest?.("a[target='_blank']");
      if (isMiddle || (anchor && isModified)) {
        e.preventDefault();
        e.stopPropagation();
        catatPelanggaran(
          "new-tab",
          "Membuka tab baru tidak diizinkan selama ujian.",
        );
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("mousedown", onMouseDownCapture, true);

    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("mousedown", onMouseDownCapture, true);
    };
  }, [active, catatPelanggaran]);

  // ---- override window.open ----
  useEffect(() => {
    if (!active) return undefined;
    const asli = window.open;
    window.open = (...args) => {
      if (lockedRef.current && !terminatedRef.current) {
        catatPelanggaran(
          "new-tab",
          "Membuka jendela/tab baru tidak diizinkan selama ujian.",
        );
        return null;
      }
      return asli.apply(window, args);
    };
    return () => {
      window.open = asli;
    };
  }, [active, catatPelanggaran]);

  // ---- cegah tombol back browser & gesture swipe-back ----
  useEffect(() => {
    if (!active || !locked) return undefined;

    const onPageShow = (e) => {
      if (!e.persisted) return;
      for (let i = 0; i < HISTORY_BUFFER_DEPTH; i += 1) {
        window.history.pushState(null, "", window.location.href);
      }
      if (!sedangFullscreen() && !terminatedRef.current) {
        catatPelanggaran(
          "back-button",
          'Gunakan tombol "Selesai" untuk mengakhiri ujian.',
        );
        setTimeout(() => cobaKunciUlangFullscreen(), FULLSCREEN_RETRY_DELAY);
      }
    };

    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [active, locked, catatPelanggaran, cobaKunciUlangFullscreen]);

  // ---- cegah menutup/refresh tab ----
  useEffect(() => {
    if (!active) return undefined;

    const onBeforeUnload = (e) => {
      if (!lockedRef.current || terminatedRef.current) return;
      e.preventDefault();
      e.returnValue = "";
      return "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [active]);

  // ---- deteksi DevTools dengan debounce (IMPROVED) ----
  useEffect(() => {
    if (!active) return undefined;

    let lastDetectionTime = 0;

    devtoolsIntervalRef.current = window.setInterval(() => {
      if (!lockedRef.current || terminatedRef.current) return;

      const now = Date.now();
      // Debounce: cegah detection terlalu sering
      if (now - lastDetectionTime < 3000) return;

      const dw = window.outerWidth - window.innerWidth;
      const dh = window.outerHeight - window.innerHeight;

      if (dw > DEVTOOLS_THRESHOLD || dh > DEVTOOLS_THRESHOLD) {
        lastDetectionTime = now;
        catatPelanggaran(
          "devtools",
          "Terdeteksi kemungkinan DevTools terbuka. Aktivitas ini tercatat.",
        );
      }
    }, DEVTOOLS_POLL_MS);

    return () => window.clearInterval(devtoolsIntervalRef.current);
  }, [active, catatPelanggaran]);

  // ---- cegah select/drag teks ----
  useEffect(() => {
    if (!active || !locked) return undefined;

    const prevUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";

    const onDragStart = (e) => e.preventDefault();
    window.addEventListener("dragstart", onDragStart);

    return () => {
      document.body.style.userSelect = prevUserSelect;
      window.removeEventListener("dragstart", onDragStart);
    };
  }, [active, locked]);

  const enterKiosk = useCallback(async () => {
    if (targetRef?.current && !sedangFullscreen()) {
      try {
        await requestFullscreenAman(targetRef.current);
        fullscreenRetryRef.current = 0;
      } catch (error) {
        console.warn("Fullscreen ditolak/tidak didukung:", error);
        fullscreenRetryRef.current = 0;
      }
    }
    lockedRef.current = true;
    setLocked(true);
  }, [targetRef]);

  const exitKiosk = useCallback(async () => {
    lockedRef.current = false;
    setLocked(false);
    window.clearInterval(devtoolsIntervalRef.current);
    fullscreenRetryRef.current = 0;

    try {
      await exitFullscreenAman();
    } catch (error) {
      console.warn("Gagal keluar fullscreen:", error);
    }
  }, []);

  return {
    locked,
    terminated,
    violations,
    violationCount: violations.length,
    maxViolations,
    peringatan,
    fullscreenLost,
    enterKiosk,
    exitKiosk,
  };
}
