import React, { useContext } from "react";
import { RiCompass3Line } from "react-icons/ri";
import { AppContext } from "../context/AppContext";
import "../assets/component/loading.css";

/**
 * Loading — layar/blok pemuatan bermerek, memakai token desain yang
 * sama dengan NotFound.jsx & alur auth (Hijau Tebing design system).
 *
 * Props:
 * - label        teks status, default "Memuat halaman"
 * - fullscreen   true = layar penuh (dipakai untuk route-level loader),
 *                false = varian inline (dipakai di dalam kartu/section)
 * - progress     angka 0–100. Kalau diisi, progress bar jadi determinate.
 *                Kalau tidak diisi, progress bar jadi indeterminate.
 * - showBar      tampilkan/sembunyikan progress bar (default true)
 * 
 * cara manggilnya 
 * <Loading />
<Loading label="Menyinkronkan data" fullscreen={false} />
<Loading label="Mengunggah file" progress={uploadPercent} />
 */
export default function Loading({
  label = "Memuat halaman",
  fullscreen = true,
  progress,
  showBar = true,
}) {
  const { namaAplikasi, namaPerusahaan, logo } = useContext(AppContext);

  const isDeterminate = typeof progress === "number" && !Number.isNaN(progress);
  const clampedProgress = isDeterminate
    ? Math.min(100, Math.max(0, progress))
    : 0;

  return (
    <div
      className={`ld-shell${fullscreen ? "" : " ld-inline"}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="ld-content">
        <div className="ld-mark-wrap">
          <div className="ld-ring" aria-hidden="true" />
          <div className="ld-ring ld-ring--slow" aria-hidden="true" />
          <div className="ld-mark">
            {logo ? (
              <img
                src={logo}
                alt={namaAplikasi || "Logo"}
                className="ld-mark-img"
              />
            ) : (
              <RiCompass3Line />
            )}
          </div>
        </div>

        <p className="ld-brand">
          {namaAplikasi} {namaPerusahaan}
        </p>

        <span className="ld-label">
          {label}
          <span className="ld-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </span>

        {showBar && (
          <div className="ld-bar-track">
            <div
              className={`ld-bar-fill${isDeterminate ? "" : " ld-bar-indeterminate"}`}
              style={
                isDeterminate ? { width: `${clampedProgress}%` } : undefined
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
