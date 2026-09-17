import React, { createContext, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import logo from "../assets/Logo.png";

export const AppContext = createContext(null);

const THEME_STORAGE_KEY = "theme";

export default function AppContextProvider({ children }) {
  const [namaPerusahaan] = useState(`SD Swasta Ma'arif`);
  const [namaAplikasi] = useState(`SSO`);
  // For Navigate
  const navigate = useNavigate();
  const location = useLocation();
  const [userLoged, setUserLoged] = useState(null);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tokenUser, setTokenUser] = useState("");

  const [mode, setMode] = useState(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);

    if (saved === "dark" || saved === "light") {
      return saved;
    }

    return "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", mode);
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  }, [mode]);

  const toggleMode = () => {
    setMode((prev) => (prev === "light" ? "dark" : "light"));
  };

  const value = {
    mobileMenuOpen,
    setMobileMenuOpen,

    mode,
    setMode,
    toggleMode,
    isDark: mode === "dark",

    navigate,
    location,
    logo,
    namaPerusahaan,
    namaAplikasi,
    userLoged,
    setUserLoged,
    tokenUser,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
