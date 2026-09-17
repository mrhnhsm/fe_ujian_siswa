import React, { useContext } from "react";
import { Button } from "antd";
import { HomeOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import { RiCompass3Line } from "react-icons/ri";
import { AppContext } from "../context/AppContext";
import NodeNetworkBg from "./Nodenetworking";
import "../assets/component/notFound.css";

export default function NotFound() {
  const { namaAplikasi, namaPerusahaan, navigate } = useContext(AppContext);

  return (
    <div className="nf-shell">
      {/* ── Background node-network, sama seperti hero SSO ── */}
      <div className="nf-bg" aria-hidden="true">
        <NodeNetworkBg />
      </div>

      <div className="nf-content">
        <div className="nf-mark">
          <RiCompass3Line />
        </div>

        <span className="nf-eyebrow">Error 404</span>
        <h1 className="nf-code">404</h1>
        <h2 className="nf-title">Halaman Tidak Ditemukan</h2>
        <p className="nf-desc">
          Alamat yang Anda tuju tidak tersedia, sudah dipindahkan, atau Anda
          tidak memiliki akses ke {namaAplikasi} {namaPerusahaan}.
        </p>

        <div className="nf-actions">
          <Button
            type="primary"
            icon={<HomeOutlined />}
            className="nf-primary-btn"
            size="large"
            onClick={() => navigate("/")}
          >
            Kembali ke Beranda
          </Button>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            className="nf-secondary-btn"
            size="large"
            onClick={() => window.history.back()}
          >
            Halaman Sebelumnya
          </Button>
        </div>
      </div>

      <div className="nf-footer">
        © {new Date().getFullYear()} {namaPerusahaan}. Semua hak dilindungi.
      </div>
    </div>
  );
}