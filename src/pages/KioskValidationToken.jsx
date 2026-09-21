import React, { useContext, useState, useCallback } from "react";
import {
  SafetyCertificateOutlined,
  LockOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  SafetyOutlined,
  ArrowRightOutlined,
  ReloadOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import { AppContext } from "../context/AppContext";
import { apiGet, apiPost } from "../configurasi/apiHelper";
import "../assets/page/kioskValidationToken.css";

// ============================================================
// KioskValidationToken.jsx  (page 1)
//
// PENTING: halaman ini TIDAK LAGI membuat instance
// useExamKioskGuard sendiri. `guard` diterima sebagai PROP dari
// App.jsx -- satu-satunya instance guard untuk seluruh sesi kiosk,
// yang target fullscreen-nya adalah shell di App.jsx (elemen yang
// tidak pernah unmount). Kalau halaman ini membuat guard/shellRef
// sendiri lagi, fullscreen akan kembali "keluar sendiri" saat
// pindah ke KioskLMS -- itulah bug yang sedang diperbaiki.
//
// PERUBAHAN PENTING (fix "harus login lagi di ruang ujian"):
// Sebelumnya sesi Moodle di-priming lewat IFRAME TERSEMBUNYI
// TERPISAH sesaat halaman ini dibuka (background, jauh sebelum
// token diverifikasi). Ini rapuh karena tiga alasan:
//
//   1) Userkey Moodle (`auth/userkey/login.php?key=...`) biasanya
//      SEKALI PAKAI dan berumur pendek -- kalau diambil terlalu
//      dini lalu baru dipakai belakangan (setelah siswa selesai
//      ketik token + verifikasi), key itu sudah keburu kadaluarsa.
//   2) Cookie sesi yang diset di iframe tersembunyi itu adalah
//      cookie PIHAK KETIGA dari sudut pandang halaman ini --
//      browser modern (Safari ITP, mode incognito Chrome dkk) bisa
//      mempartisi/blokir cookie itu sehingga tidak "kebawa" ke
//      iframe ruang ujian yang berbeda, meski sama-sama nested di
//      halaman yang sama.
//   3) Ada jeda waktu (race) antara iframe priming selesai load dan
//      siswa benar-benar membuka ruang ujian.
//
// Solusinya: JANGAN priming lebih dulu. Sebagai gantinya, key
// userkey diambil FRESH tepat saat siswa menekan "Mulai Ujian", dan
// digabung langsung ke URL ruang ujian lewat parameter standar
// Moodle `wantsurl` -- sehingga proses LOGIN dan REDIRECT ke URL
// ujian terjadi DI DALAM SATU IFRAME YANG SAMA yang nanti dipakai
// KioskLMS, tanpa jeda dan tanpa iframe terpisah.
// ============================================================

const SSO_LOGIN_URL = "http://localhost:8083/";

const ambilTokenDariUrl = () => {
  try {
    const url = new URL(window.location.href);
    const dariQuery = url.searchParams.get("token");
    if (dariQuery) return dariQuery;
    const segmen = url.pathname.split("/").filter(Boolean);
    return segmen[segmen.length - 1] || "";
  } catch {
    return "";
  }
};

// Backend/apiHelper kadang membungkus body JSON di `.data`, kadang
// mengembalikannya langsung -- baca dua-duanya supaya tidak rapuh
// terhadap perbedaan implementasi apiHelper.
const ambilRedirectUrl = (res) =>
  res?.data?.redirect_url || res?.redirect_url || null;

// Tempel `wantsurl` ke link login userkey supaya Moodle, setelah
// berhasil login lewat key, otomatis redirect ke URL ruang ujian
// yang sebenarnya -- bukan ke halaman default (mis. /my/).
const bangunUrlLoginKeUjian = (loginUrl, urlTujuan) => {
  if (!loginUrl) return urlTujuan;
  if (!urlTujuan) return loginUrl;
  try {
    const url = new URL(loginUrl);
    url.searchParams.set("wantsurl", urlTujuan);
    return url.toString();
  } catch (error) {
    console.error("Gagal menyusun URL login+redirect ujian:", error);
    return urlTujuan;
  }
};

export default function KioskValidationToken({ guard, onTokenValid }) {
  const { tokenUser } = useContext(AppContext) || {};
  // `token` adalah nilai TERKONTROL (bisa diketik/ditempel manual).
  // Kalau URL sudah membawa ?token=..., itu jadi nilai awal saja.
  const [token, setToken] = useState(ambilTokenDariUrl);

  const [status, setStatus] = useState("gate");
  const [pesanError, setPesanError] = useState("");
  const [dataUjian, setDataUjian] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [memulai, setMemulai] = useState(false);

  // ---- Validasi token ke backend ----
  const verifikasiToken = useCallback(async () => {
    if (!token) {
      setStatus("invalid");
      setPesanError(
        "Tautan ujian tidak lengkap. Token tidak ditemukan pada URL.",
      );
      return;
    }
    setStatus("loading");
    try {
      const response = await apiPost("/ujian/verify-token", "", { token });
      const data = response?.data;

      if (data?.status !== "success") {
        const alasan = (data?.message || "").toLowerCase();
        if (
          data?.status === "expired" ||
          alasan.includes("kedaluwarsa") ||
          alasan.includes("expired")
        ) {
          setStatus("expired");
        } else {
          setStatus("invalid");
        }
        setPesanError(data?.message || "Token ujian tidak valid.");
        return;
      }

      setDataUjian(data.context || null);
      setExpiresAt(data.expires_at || null);
      setStatus("valid");
    } catch (error) {
      console.error("Gagal memvalidasi token ujian:", error);
      const pesanServer = error?.response?.data?.message;
      setStatus("error");
      setPesanError(
        pesanServer ||
          "Terjadi kesalahan saat menghubungi server. Silakan coba lagi.",
      );
    }
  }, [token, tokenUser]);

  // ---- Gerbang: masuk kiosk (fullscreen, via guard bersama) + mulai validasi ----
  const handleMasukGerbang = async () => {
    if (!token.trim()) return; // tombol sudah disabled, ini jaga-jaga saja
    await guard.enterKiosk();
    verifikasiToken();
  };

  // ---- Lanjut ke ruang ujian (diteruskan ke App.jsx) ----
  // Key userkey diambil DI SINI, tepat saat siswa menekan tombol --
  // sesegar mungkin, langsung digabung ke URL ruang ujian lewat
  // `wantsurl`, lalu iframe KioskLMS yang membuka URL gabungan itu
  // yang akan login sekaligus landing di ruang ujian. Tidak ada lagi
  // priming terpisah, jadi tidak ada lagi jeda/basi/cookie pihak
  // ketiga yang bisa gagal diam-diam.
  const handleMulaiUjian = async () => {
    if (!dataUjian?.id_riwayat_url) {
      setStatus("error");
      setPesanError("URL ruang ujian tidak tersedia. Hubungi pengawas/admin.");
      return;
    }
    setMemulai(true);

    let urlLmsFinal = dataUjian.id_riwayat_url;
    try {
      const res = await apiGet("/moodle/get-link", "", "");
      const loginUrl = ambilRedirectUrl(res);
      if (loginUrl) {
        urlLmsFinal = bangunUrlLoginKeUjian(loginUrl, dataUjian.id_riwayat_url);
      } else {
        console.warn(
          "redirect_url userkey tidak ditemukan pada response /moodle/get-link, " +
            "membuka ruang ujian tanpa auto-login (siswa mungkin diminta login manual).",
        );
      }
    } catch (error) {
      // Kegagalan di sini tidak menghentikan ujian -- ruang ujian tetap
      // dibuka, hanya saja siswa mungkin harus login manual di Moodle.
      console.error("Gagal mengambil link userkey Moodle:", error);
    }

    setTimeout(() => {
      onTokenValid?.({
        token,
        urlLms: urlLmsFinal,
        idKelas: dataUjian.id_kelas,
        expiresAt,
      });
    }, 400);
  };

  const kembaliKeSso = () => {
    window.location.href = SSO_LOGIN_URL;
  };

  // Terminasi ditentukan oleh guard BERSAMA (bisa terjadi kapan saja
  // sejak locked, bukan hanya status lokal halaman ini).
  const sudahTerminated = guard.terminated;

  return (
    <div className="kvt-shell">
      <div className="kvt-nodes" aria-hidden="true">
        <span className="kvt-node kvt-node-1" />
        <span className="kvt-node kvt-node-2" />
        <span className="kvt-node kvt-node-3" />
        <span className="kvt-node kvt-node-4" />
        <svg
          className="kvt-node-lines"
          viewBox="0 0 800 600"
          preserveAspectRatio="none"
        >
          <line x1="120" y1="90" x2="360" y2="220" />
          <line x1="360" y1="220" x2="680" y2="140" />
          <line x1="360" y1="220" x2="240" y2="460" />
          <line x1="240" y1="460" x2="600" y2="500" />
        </svg>
      </div>

      <div className={`kvt-card${memulai ? " kvt-card-leaving" : ""}`}>
        <div
          className={`kvt-badge kvt-badge-${sudahTerminated ? "terminated" : status}`}
        >
          {!sudahTerminated && status === "gate" && <SafetyOutlined />}
          {!sudahTerminated && status === "loading" && (
            <LockOutlined spin={false} />
          )}
          {!sudahTerminated && status === "valid" && (
            <SafetyCertificateOutlined />
          )}
          {!sudahTerminated && (status === "invalid" || status === "error") && (
            <CloseCircleOutlined />
          )}
          {!sudahTerminated && status === "expired" && <ClockCircleOutlined />}
          {sudahTerminated && <CloseCircleOutlined />}
        </div>

        <span className="kvt-eyebrow">Ruang Ujian Terkunci</span>

        {sudahTerminated ? (
          <>
            <h1 className="kvt-title">Verifikasi Dihentikan</h1>
            <p className="kvt-subtitle">
              Terlalu banyak pelanggaran keamanan terdeteksi (
              {guard.violationCount}/{guard.maxViolations}) sebelum verifikasi
              token selesai.
            </p>
            <button
              type="button"
              className="kvt-link-sso"
              onClick={kembaliKeSso}
            >
              <LogoutOutlined /> Kembali ke SSO
            </button>
          </>
        ) : (
          <>
            {status === "gate" && (
              <>
                <h1 className="kvt-title">Verifikasi Aman Diperlukan</h1>
                <p className="kvt-subtitle">
                  Halaman ini akan masuk ke{" "}
                  <strong>mode layar penuh terkunci</strong> sebelum token ujian
                  Anda diperiksa. Jangan tutup atau tinggalkan layar ini selama
                  proses berlangsung.
                </p>

                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="kvt-token-input"
                  placeholder="Masukkan token ujian"
                  value={token}
                  onChange={(e) => setToken(e.target.value.trim())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && token.trim()) handleMasukGerbang();
                  }}
                />

                <button
                  type="button"
                  className="kvt-cta"
                  onClick={handleMasukGerbang}
                  disabled={!token.trim()}
                >
                  Mulai Verifikasi Aman
                  <ArrowRightOutlined />
                </button>
                <button
                  type="button"
                  className="kvt-link-sso"
                  onClick={kembaliKeSso}
                >
                  <LogoutOutlined /> Kembali ke SSO
                </button>
              </>
            )}

            {status === "loading" && (
              <>
                <h1 className="kvt-title">Memeriksa tautan ujian…</h1>
                <p className="kvt-subtitle">
                  Mohon tunggu sebentar, kami sedang memverifikasi token ujian
                  Anda.
                </p>
                <div className="kvt-progress">
                  <span className="kvt-progress-bar" />
                </div>
              </>
            )}

            {status === "valid" && dataUjian && (
              <>
                <h1 className="kvt-title">Ujian Siap Dimulai</h1>
                <p className="kvt-subtitle">
                  Mode terkunci sudah aktif. Tekan tombol di bawah untuk masuk
                  ke ruang ujian.
                </p>

                <div className="kvt-info-list">
                  {dataUjian.id_kelas && (
                    <div className="kvt-info-item">
                      <SafetyCertificateOutlined />
                      <span>{dataUjian.id_kelas}</span>
                    </div>
                  )}
                  {expiresAt && (
                    <div className="kvt-info-item">
                      <ClockCircleOutlined />
                      <span>Berlaku sampai {expiresAt}</span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="kvt-cta"
                  onClick={handleMulaiUjian}
                  disabled={memulai}
                >
                  {memulai ? "Menyiapkan ruang ujian…" : "Mulai Ujian"}
                  {!memulai && <ArrowRightOutlined />}
                </button>

                <p className="kvt-footnote">
                  Pastikan koneksi internet Anda stabil sebelum memulai. Jangan
                  menutup atau me-refresh browser selama ujian berlangsung.
                </p>
              </>
            )}

            {(status === "invalid" ||
              status === "expired" ||
              status === "error") && (
              <>
                <h1 className="kvt-title">
                  {status === "expired"
                    ? "Tautan Ujian Sudah Kedaluwarsa"
                    : "Tautan Tidak Dapat Dibuka"}
                </h1>
                <p className="kvt-subtitle">{pesanError}</p>
                <button
                  type="button"
                  className="kvt-cta kvt-cta-ghost"
                  onClick={verifikasiToken}
                >
                  <ReloadOutlined />
                  Coba Lagi
                </button>
                <button
                  type="button"
                  className="kvt-link-sso"
                  onClick={kembaliKeSso}
                >
                  <LogoutOutlined /> Kembali ke SSO
                </button>
                <p className="kvt-footnote">
                  Jika masalah berlanjut, hubungi pengawas atau admin sekolah
                  Anda.
                </p>
              </>
            )}
          </>
        )}
      </div>

      {guard.peringatan && !sudahTerminated && (
        <div className="kiosk-warning-banner">
          <span>{guard.peringatan}</span>
        </div>
      )}
    </div>
  );
}
