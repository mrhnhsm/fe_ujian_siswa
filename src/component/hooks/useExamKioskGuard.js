import { useCallback, useEffect, useRef, useState } from "react";
import { playViolationBeep, playLockBeep } from "./kioskAudio";

// ============================================================
// useExamKioskGuard
//
// Hook keamanan "lockdown browser" berbasis web untuk halaman ujian.
// Ini BUKAN pengganti Safe Exam Browser asli (itu berjalan di level
// OS/native dan bisa mengunci seluruh sistem), tapi menutup celah
// paling umum yang bisa dilakukan lewat browser biasa (Chrome dst):
//
//   - keluar dari fullscreen        -> pelanggaran, coba kunci ulang
//   - pindah tab / minimize         -> pelanggaran (visibilitychange)
//   - window kehilangan fokus       -> pelanggaran (blur, indikasi alt-tab)
//   - buka DevTools                 -> pelanggaran (heuristik ukuran window)
//   - shortcut refresh/close/print/
//     save/new-tab/devtools         -> diblokir + pelanggaran
//   - klik kanan                    -> diblokir (tanpa dihitung pelanggaran)
//   - buka tab baru (ctrl/cmd/middle
//     click, window.open)           -> diblokir + pelanggaran
//   - tombol back browser           -> diblokir + pelanggaran
//   - menutup/refresh tab           -> dicegah lewat beforeunload
//
// Setelah `maxViolations` pelanggaran tercatat, `onTerminate` dipanggil
// sekali -- pemanggil (halaman) yang menentukan apa yang terjadi
// selanjutnya (biasanya: kunci layar & akhiri sesi ujian paksa).
//
// CATATAN PENTING (keterbatasan browser, bukan bug):
// `element.requestFullscreen()` WAJIB dipanggil dari dalam user-gesture
// (klik/tap). Browser tidak mengizinkan halaman auto-fullscreen begitu
// dibuka tanpa interaksi apapun. Karena itu hook ini meng-expose
// `enterKiosk()` yang harus dipanggil dari handler klik pertama
// pengguna (lihat gate/overlay di halaman pemanggil).
//
// CATATAN TAMBAHAN (tombol/gesture back di HP):
// Tombol back OS/browser dan gesture swipe-dari-tepi (terutama di
// Safari iOS) adalah bagian UI browser, BUKAN bagian halaman -- JS
// tidak bisa menyembunyikan atau menonaktifkannya secara fisik. Yang
// bisa dilakukan hanya: (1) menetralkan efeknya lewat history buffer +
// popstate di bawah, dan (2) mempersulit gesture-nya lewat CSS
// (overscroll-behavior/touch-action) di file CSS pemanggil. Untuk
// benar-benar menghilangkan UI browser, aplikasi harus dijalankan
// sebagai PWA standalone atau dibungkus WebView native kiosk mode.
// ============================================================

const DEFAULT_MAX_VIOLATIONS = 4;
const DEVTOOLS_THRESHOLD = 160; // px selisih outer-inner yang dicurigai devtools terbuka (docked)
const DEVTOOLS_POLL_MS = 1000;
const HISTORY_BUFFER_DEPTH = 5; // jumlah entry dummy yang didorong ke history saat lock aktif

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
  // Alt+Tab / Alt+F4 adalah shortcut level OS, tidak bisa dicegat dari
  // JS sama sekali di browser manapun -- efeknya (window blur / hidden)
  // tetap tertangkap lewat listener visibilitychange & blur di bawah.
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

  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

  const tampilkanPeringatan = useCallback((pesan) => {
    setPeringatan(pesan);
    window.clearTimeout(warningTimerRef.current);
    warningTimerRef.current = window.setTimeout(
      () => setPeringatan(null),
      4200,
    );
  }, []);

  const catatPelanggaran = useCallback(
    (jenis, pesan) => {
      if (!lockedRef.current || terminatedRef.current) return;
      playViolationBeep();
      tampilkanPeringatan(pesan);
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

  const cobaKunciUlangFullscreen = useCallback(() => {
    if (!targetRef?.current) return;
    requestFullscreenAman(targetRef.current).catch(() => {
      // Ditolak browser karena tanpa gesture langsung -- guard lain
      // (shortcut/tab/devtools) tetap aktif sebagai soft-lock.
    });
  }, [targetRef]);

  // ---- fullscreen change ----
  useEffect(() => {
    if (!active) return undefined;
    const handler = () => {
      if (!lockedRef.current || terminatedRef.current) return;
      if (!sedangFullscreen()) {
        setFullscreenLost(true);
        catatPelanggaran("fullscreen", "Anda keluar dari mode layar penuh.");
        // Percobaan otomatis -- browser SERING SENGAJA menolak ini
        // (cooldown anti-abuse setelah keluar lewat Esc), jadi ini
        // hanya best-effort. Jalan pasti untuk kembali adalah lewat
        // tombol "Kembali ke Mode Terkunci" (gesture klik asli),
        // ditampilkan oleh pemanggil selama fullscreenLost === true.
        cobaKunciUlangFullscreen();
      } else {
        setFullscreenLost(false);
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
        cobaKunciUlangFullscreen();
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
    // Cegah tab baru lewat ctrl/cmd/shift+click atau middle-click pada link.
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

  // ---- override window.open selama terkunci ----
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

  // ---- cegah tombol back browser & gesture swipe-back di HP ----
  // Catatan: JS tidak bisa "menyembunyikan" tombol back browser --
  // yang bisa dilakukan hanya menetralkan efek navigasinya. Kita
  // dorong beberapa entry history sekaligus (bukan cuma satu) supaya
  // satu swipe-back cepat di HP (terutama Safari iOS, yang kadang
  // memicu navigasi sebelum React sempat re-render) tidak langsung
  // menembus habis buffer sebelum popstate sempat menahan & mendorong
  // ulang.
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
        cobaKunciUlangFullscreen();
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [active, locked, catatPelanggaran, cobaKunciUlangFullscreen]);

  // ---- cegah menutup/refresh tab tanpa sadar ----
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

  // ---- deteksi DevTools (heuristik selisih ukuran window) ----
  useEffect(() => {
    if (!active) return undefined;
    devtoolsIntervalRef.current = window.setInterval(() => {
      if (!lockedRef.current || terminatedRef.current) return;
      const dw = window.outerWidth - window.innerWidth;
      const dh = window.outerHeight - window.innerHeight;
      if (dw > DEVTOOLS_THRESHOLD || dh > DEVTOOLS_THRESHOLD) {
        catatPelanggaran(
          "devtools",
          "Terdeteksi kemungkinan DevTools terbuka. Aktivitas ini tercatat.",
        );
      }
    }, DEVTOOLS_POLL_MS);
    return () => window.clearInterval(devtoolsIntervalRef.current);
  }, [active, catatPelanggaran]);

  // ---- cegah select/drag teks selama terkunci ----
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
      } catch (error) {
        // Ditolak/tidak didukung -> tetap lanjut soft-lock dengan
        // guard lain (shortcut/tab/devtools/back-button dst).
        console.warn("Fullscreen ditolak/tidak didukung:", error);
      }
    }
    lockedRef.current = true;
    setLocked(true);
  }, [targetRef]);

  const exitKiosk = useCallback(async () => {
    lockedRef.current = false;
    setLocked(false);
    window.clearInterval(devtoolsIntervalRef.current);
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
