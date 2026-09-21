import React, { useContext, useState, useCallback, useEffect } from "react";
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
// KioskValidationToken.jsx (page 1) - IMPROVED
//
// PERBAIKAN:
// - Better error handling
// - Improved API timeout handling
// - Better memory cleanup
// ============================================================

const SSO_LOGIN_URL = "http://localhost:8083/";
const API_TIMEOUT_MS = 30000; // 30 detik timeout

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

const ambilRedirectUrl = (res) =>
  res?.data?.redirect_url || res?.redirect_url || null;

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

// API wrapper dengan timeout
const apiWithTimeout = async (fn, timeoutMs = API_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const result = await fn(controller.signal);
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

export default function KioskValidationToken({
  guard,
  onTokenValid,
  isMobile,
}) {
  const { tokenUser } = useContext(AppContext) || {};
  const [token, setToken] = useState(ambilTokenDariUrl);

  const [status, setStatus] = useState("gate");
  const [pesanError, setPesanError] = useState("");
  const [dataUjian, setDataUjian] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [memulai, setMemulai] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // ---- Cleanup pada unmount ----
  useEffect(() => {
    return () => {
      setMemulai(false);
    };
  }, []);

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
    setPesanError("");

    try {
      const response = await apiWithTimeout(
        () => apiPost("/ujian/verify-token", "", { token }),
        API_TIMEOUT_MS,
      );
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

      let pesanErrorBaru = "Terjadi kesalahan saat menghubungi server.";

      if (error?.name === "AbortError") {
        pesanErrorBaru = "Request timeout - koneksi terlalu lambat. Coba lagi.";
      } else if (error?.response?.data?.message) {
        pesanErrorBaru = error.response.data.message;
      } else if (error?.message) {
        pesanErrorBaru = error.message;
      }

      setStatus("error");
      setPesanError(pesanErrorBaru);
    }
  }, [token]);

  // ---- Gerbang: masuk kiosk + mulai validasi ----
  const handleMasukGerbang = async () => {
    if (!token.trim()) return;
    await guard.enterKiosk();
    verifikasiToken();
  };

  // ---- Mulai ujian ----
  const handleMulaiUjian = async () => {
    if (!dataUjian?.id_riwayat_url) {
      setStatus("error");
      setPesanError("URL ruang ujian tidak tersedia. Hubungi pengawas/admin.");
      return;
    }

    setMemulai(true);

    let urlLmsFinal = dataUjian.id_riwayat_url;

    try {
      const res = await apiWithTimeout(
        () => apiGet("/moodle/get-link", "", ""),
        API_TIMEOUT_MS,
      );
      const loginUrl = ambilRedirectUrl(res);
      if (loginUrl) {
        urlLmsFinal = bangunUrlLoginKeUjian(loginUrl, dataUjian.id_riwayat_url);
      } else {
        console.warn(
          "redirect_url userkey tidak ditemukan, membuka tanpa auto-login",
        );
      }
    } catch (error) {
      console.error("Gagal mengambil link userkey:", error);
      // Lanjut terus, ruang ujian tetap dibuka
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

  const sudahTerminated = guard.terminated;

  return (
    <div className={`kvt-shell ${isMobile ? "kvt-mobile" : "kvt-desktop"}`}>
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
                  className={`kvt-token-input ${isFocused ? "focused" : ""}`}
                  placeholder="Masukkan token ujian"
                  value={token}
                  onChange={(e) => setToken(e.target.value.trim())}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && token.trim()) handleMasukGerbang();
                  }}
                  disabled={memulai}
                />

                <button
                  type="button"
                  className="kvt-cta"
                  onClick={handleMasukGerbang}
                  onTouchEnd={handleMasukGerbang}
                  disabled={!token.trim() || memulai}
                >
                  Mulai Verifikasi Aman
                  <ArrowRightOutlined />
                </button>
                <button
                  type="button"
                  className="kvt-link-sso"
                  onClick={kembaliKeSso}
                  onTouchEnd={kembaliKeSso}
                  disabled={memulai}
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
                  disabled={memulai}
                >
                  <ReloadOutlined />
                  Coba Lagi
                </button>
                <button
                  type="button"
                  className="kvt-link-sso"
                  onClick={kembaliKeSso}
                  disabled={memulai}
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

      {/* VIOLATIONS WARNING DISABLED */}
      {/* {guard.peringatan && !sudahTerminated && (
        <div className="kiosk-warning-banner">
          <span>{guard.peringatan}</span>
        </div>
      )} */}
    </div>
  );
}
