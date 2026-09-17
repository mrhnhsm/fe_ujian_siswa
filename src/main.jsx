import React, { useContext } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConfigProvider, App as AntApp, theme as antTheme } from "antd";
import idID from "antd/locale/id_ID";
import "antd/dist/reset.css";
import "./index.css";
import "./App.css";
import App from "./App.jsx";
import AppContextProvider, { AppContext } from "./context/AppContext.jsx";

const BLUE = "#2f6bff";
const INK = "#060b16";

function AntConfig({ children }) {
  const { isDark } = useContext(AppContext);

  return (
    <ConfigProvider
      locale={idID}
      theme={{
        algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
        token: {
          colorPrimary: BLUE,
          colorInfo: BLUE,
          colorLink: BLUE,
          colorText: isDark ? "#e9eefb" : INK,
          borderRadius: 12,
          fontFamily: "'Inter', 'Space Grotesk', sans-serif",
          colorBgBase: isDark ? "#05070d" : "#f4f7fc",
        },
        components: {
          Layout: {
            headerBg: "transparent",
            bodyBg: isDark ? "#05070d" : "#f4f7fc",
            footerBg: isDark ? "#03050a" : "#060b16",
          },
          Button: {
            borderRadius: 10,
            controlHeightLG: 48,
          },
          Card: {
            borderRadiusLG: 20,
          },
          Input: {
            borderRadius: 10,
            controlHeightLG: 48,
          },
        },
      }}
    >
      <AntApp>{children}</AntApp>
    </ConfigProvider>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppContextProvider>
        <AntConfig>
          <App />
        </AntConfig>
      </AppContextProvider>
    </BrowserRouter>
  </React.StrictMode>
);
