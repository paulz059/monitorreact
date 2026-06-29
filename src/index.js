/*!
=========================================================
* Black Dashboard React v1.2.2
=========================================================
*/
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";

// --- AWS Amplify 配置 ---
import { Amplify } from 'aws-amplify';
import config from './aws-exports';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

import AdminLayout from "layouts/Admin/Admin.js";
import RTLLayout from "layouts/RTL/RTL.js";

import "assets/scss/black-dashboard-react.scss";
import "assets/demo/demo.css";
import "assets/css/nucleo-icons.css";
import "@fortawesome/fontawesome-free/css/all.min.css";

import ThemeContextWrapper from "./components/ThemeWrapper/ThemeWrapper";
import BackgroundColorWrapper from "./components/BackgroundColorWrapper/BackgroundColorWrapper";

// 初始化 Amplify
Amplify.configure(config);

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <ThemeContextWrapper>
    <BackgroundColorWrapper>
      {/* 🌟 加入 Authenticator 包裹整個 App */}
      <Authenticator.Provider>
        <Authenticator>
          {({ signOut, user }) => (
            <BrowserRouter>
              <Routes>
                <Route path="/admin/*" element={<AdminLayout />} />
                <Route path="/rtl/*" element={<RTLLayout />} />
                <Route
                  path="*"
                  element={<Navigate to="/admin/monitor" replace />}
                />
              </Routes>
            </BrowserRouter>
          )}
        </Authenticator>
      </Authenticator.Provider>
    </BackgroundColorWrapper>
  </ThemeContextWrapper>
);
