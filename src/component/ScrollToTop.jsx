import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// Tidak merender apa pun. Setiap kali pathname berubah (pindah
// halaman di dalam dashboard), scroll container-nya dipaksa balik
// ke atas. Butuh containerRef karena yang scroll adalah .dash-content,
// bukan window — jadi window.scrollTo(0,0) saja tidak cukup.
export default function ScrollToTop({ containerRef }) {
  const { pathname } = useLocation();

  useEffect(() => {
    if (containerRef?.current) {
      containerRef.current.scrollTo({ top: 0, left: 0, behavior: "instant" });
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [pathname, containerRef]);

  return null;
}
