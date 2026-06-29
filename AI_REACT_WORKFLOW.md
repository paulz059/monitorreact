# React (NPM) 專案 AI 開發工作流程指南

本文件定義了使用 AI 進行 React 專案開發時的標準化流程、架構規範與環境配置，確保開發效率與程式碼一致性。

---

## 🛠️ 1. 環境建置 (Environment Setup)

在 Node.js 生態系中，「虛擬環境」通常指 **版本管理 (NVM)** 與 **依賴隔離 (node_modules)**。

### 1.1 版本管理 (NVM)
建議在專案根目錄建立 `.nvmrc` 文件，指定 Node.js 版本：
```text
v18.17.0
```
*AI 指令範例：* 「請檢查我的系統 Node 版本是否符合 .nvmrc，如果不符合請告知我切換。」

### 1.2 依賴安裝
使用 `npm` 作為套件管理工具：
```bash
npm install
```

---

## 📂 2. 標準專案目錄結構 (Project Structure)

建議遵循以下結構，讓 AI 能快速定位組件與邏輯：

```text
/
├── public/                # 靜態資源 (HTML 模板, Favicon)
├── src/
│   ├── api/               # API 請求封裝 (Axios 實例, Endpoints)
│   ├── assets/            # 靜態資源 (Images, SCSS, Fonts)
│   ├── components/        # 共用組件 (Button, Card, Input)
│   │   └── common/        # 原子級組件
│   ├── contexts/          # React Context (全域狀態管理)
│   ├── hooks/             # 自定義 React Hooks (useAuth, useFetch)
│   ├── layouts/           # 頁面佈局 (AdminLayout, AuthLayout)
│   ├── routes/            # 路由配置 (AppRoutes.js)
│   ├── utils/             # 工具函式 (格式化, 驗證)
│   ├── views/             # 頁面級組件 (Dashboard, Login)
│   ├── App.js             # 根組件
│   └── index.js           # 進入點 (Entry Point)
├── .env                   # 環境變數 (API_URL 等)
├── package.json           # 專案配置與腳本
└── README.md              # 專案說明
```

---

## 🚀 3. 進入點與核心邏輯 (Entry Point)

### 3.1 進入點 (`src/index.js`)
這是應用的起點，負責將 React 掛載到 DOM 並引入全局樣式：
```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './assets/css/main.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
```

### 3.2 根路由 (`src/App.js`)
負責全局 Provider (如 Theme, Auth) 的注入與路由分配。

---

## 🤖 4. AI 協作開發流程 (AI Workflow)

當您要求 AI 進行開發時，請遵循以下步驟：

### 第一步：提供上下文 (Context Injection)
**指令：** 「我正在開發一個 React 專案，目錄結構遵循 `AI_REACT_WORKFLOW.md`。請閱讀該文件以了解我的架構。」

### 第二步：組件開發 (Component Creation)
**指令：** 「請在 `src/components/` 下建立一個名為 `DataCard` 的組件，需使用 `reactstrap` 並符合深色模式樣式。」

### 第三步：邏輯抽離 (Hook Extraction)
**指令：** 「將 `Dashboard.js` 中處理 API 數據的邏輯抽離到 `src/hooks/useDashboardData.js` 中。」

### 第四步：路由註冊 (Routing)
**指令：** 「我新增了 `Settings.js` 視圖，請幫我更新 `src/routes.js` 將其加入導航欄。」

---

## 📝 5. 程式碼規範 (Best Practices)

1.  **優先使用 Hooks**: 避免類組件 (Class Components)。
2.  **解耦 UI 與邏輯**: 複雜邏輯應放入 `hooks/` 或 `utils/`。
3.  **樣式模組化**: 優先使用 CSS Modules 或 SCSS。
4.  **環境變數**: 敏感資訊（如 API Key）嚴禁寫死，必須放入 `.env`。

## 🐳 6. Docker 容器化建置與運行 (Containerization)

為了確保開發環境與生產環境的一致性，我們使用 Docker 進行封裝。

### 6.1 Dockerfile (生產環境優化)
在根目錄建立 `Dockerfile`，採用多階段構建以優化體積：

```dockerfile
# 階段 1: 編譯 (Build Stage)
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# 階段 2: 運行 (Production Stage)
FROM nginx:stable-alpine
COPY --from=build /app/build /usr/share/nginx/html
# 如果有使用 React Router，需覆蓋 Nginx 配置以支援 SPA 路由
# COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 6.2 Docker Compose (`docker-compose.yml`)
用於快速啟動開發或測試環境：

```yaml
version: '3.8'
services:
  web:
    build: .
    ports:
      - "8080:80"
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - NODE_ENV=production
```

### 6.3 常用 Docker 指令
*   **建置映像檔**: `docker build -t monitor-react .`
*   **啟動容器**: `docker run -d -p 8080:80 --name react-app monitor-react`
*   **使用 Compose 啟動**: `docker-compose up -d`
*   **查看日誌**: `docker logs -f react-app`

### 6.4 AI 協作指令 (Docker 相關)
**指令範例：**
*   「請幫我寫一個 `.dockerignore` 文件，排除 node_modules 和 build 資料夾。」
*   「我的 Docker 構建失敗了，報錯訊息是 [貼上訊息]，請幫我檢查 Dockerfile。」
*   「如何透過 Docker Compose 將 `.env` 文件中的環境變數傳遞給 React 應用？」

---
*Last Updated: 2026-04-02*
