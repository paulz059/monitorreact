# 語言切換功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 MonitorDashboard 與 RawData 這兩個實際使用的頁面，以及共用的 Navbar/Sidebar 文字，支援英文／中文即時切換，並用 localStorage 記住使用者的選擇。

**Architecture:** 新增一個 `LanguageContext`（仿照現有 `ThemeContext` 模式）＋ `LanguageContextWrapper` provider，包住整個 App。翻譯內容集中放在 `src/translations/index.js` 的 dot-path 字典中，元件透過 `useLanguage()` hook 取得 `t(key)` 函式來顯示對應語言的文字。`routes.js` 的 `name` 欄位改存翻譯 key，而不是字面文字。

**Tech Stack:** React 18 Context API + Hooks（不新增任何 npm 套件）。

## Global Constraints

- 翻譯範圍僅限：`MonitorDashboard.js`、`RawData.js`、`Sidebar.js` 導覽項目、`AdminNavbar.js` 品牌文字。**不**修改 `Dashboard.js`、`Icons.js`、`Map.js` 等未被 `routes.js` 引用的範本頁面。
- 動態資料內容（devID、時間戳記、感測器數值）不翻譯。
- localStorage key 固定為 `"appLanguage"`；預設語言為 `"en"`。
- `t(key)` 查無翻譯時回傳 key 本身（不拋錯、不顯示空白）。
- **不新增自動化測試框架或測試檔案**（此為 spec 中使用者明確決定，見 `docs/superpowers/specs/2026-07-26-language-switch-design.md`）。
- **Sandbox 限制：** 此開發環境沒有安裝 `node_modules`，本機也沒有 `src/aws-exports.js`（AWS Amplify 產生的檔案，已被 `.gitignore` 排除），因此**無法**在此環境執行 `npm start` / `npm run build`。因此每個 task 的驗證步驟改用 **grep 靜態檢查**（確認舊字串已移除、新的 `t(...)` 呼叫已套用）取代原本的「跑測試」步驟；真正的瀏覽器手動驗證留到最後一個 task，由使用者在自己本機（已有 `aws-exports.js` 與 `node_modules`）執行。
- 中文翻譯內容為草稿，實作完成後由使用者自行在 `src/translations/index.js` 編輯校對，不需要在本計畫的任何 task 中追求文案完美。

---

### Task 1: LanguageContext + useLanguage hook

**Files:**
- Create: `src/contexts/LanguageContext.js`

**Interfaces:**
- Produces: `LanguageContext` (React Context), `languages` object `{ en: "en", zh: "zh" }`, `useLanguage()` hook returning `{ language: string, setLanguage: (lang: string) => void, t: (key: string) => string }`. 後續所有 task 都透過 `useLanguage()` 取用。

- [ ] **Step 1: 建立 LanguageContext.js**

```js
import { createContext, useContext } from "react";

export const languages = {
  en: "en",
  zh: "zh",
};

export const LanguageContext = createContext({
  language: languages.en,
  setLanguage: () => {},
  t: (key) => key,
});

export function useLanguage() {
  return useContext(LanguageContext);
}
```

- [ ] **Step 2: 靜態檢查檔案內容**

Run: `grep -n "export const languages\|export const LanguageContext\|export function useLanguage" src/contexts/LanguageContext.js`

Expected: 三行都要出現，各自對應到 `languages`、`LanguageContext`、`useLanguage` 的宣告。

- [ ] **Step 3: Commit**

```bash
git add src/contexts/LanguageContext.js
git commit -m "feat: add LanguageContext and useLanguage hook"
```

---

### Task 2: 翻譯字典

**Files:**
- Create: `src/translations/index.js`

**Interfaces:**
- Consumes: 無
- Produces: `export default translations`，格式為 `{ en: {...}, zh: {...} }`，每個語言底下有 `common`、`nav`、`monitorDashboard`、`rawData` 四個 namespace。後續 Task 3（LanguageWrapper 的 `t()` 查表邏輯）與 Task 4-7（各元件呼叫 `t('namespace.key')`）都依賴這裡定義的 key 名稱，須完全一致。

- [ ] **Step 1: 建立 translations/index.js**

```js
const translations = {
  en: {
    common: {
      refresh: "Refresh",
      unknown: "Unknown",
      online: "Online",
      brand: "Brand",
    },
    nav: {
      monitor: "Monitor Dashboard",
      rawData: "Raw Data",
    },
    monitorDashboard: {
      title: "Monitor Dashboard",
      lastUpdate: "Last Update",
      selectDevice: "Select Device (devID)",
      chooseDevice: "-- Choose a Device --",
      lastSeen: "Last Seen",
      errorLoad: "Failed to load latest data. Please check your connection.",
      wasteProcessed: "WASTE PROCESSED",
      todaysInput: "TODAY'S INPUT (weight1)",
      currentBiomass: "CURRENT BIOMASS (weight2)",
      biomassOutput: "BIOMASS OUTPUT",
      environmentalSensors: "ENVIRONMENTAL SENSORS",
      chamberTemp: "CHAMBER TEMP",
      humidity: "HUMIDITY",
      co2Nh3Level: "CO2 / NH3 LEVEL",
      energyMonitoring: "ENERGY MONITORING",
      systemUsage: "SYSTEM USAGE (ACMotor)",
      solarGeneration: "SOLAR GENERATION (BatVoltage)",
      reduction: "REDUCTION",
      latestReduction: "LATEST REDUCTION",
      totalReduction7Days: "TOTAL REDUCTION (7 DAYS)",
      historyData: "History Data",
      weightTrend: "Weight Trend (7 Days)",
      reductionAnalysis: "Reduction Analysis",
      dailyReductionTrend: "Daily Reduction Trend (7 Days)",
      devicesOverview: "Devices Overview",
      devIdColumn: "devID",
      statusColumn: "Status",
      latestValuesColumn: "Latest Values",
      lastSeenColumn: "Last Seen",
    },
    rawData: {
      title: "Raw Data Query",
      subtitle: "View the raw JSON data returned from the database",
      selectDevice: "Select Device (devID)",
      chooseDevice: "-- Select a Device --",
      msgId: "Msg ID",
      noData: "No data available",
    },
  },
  zh: {
    common: {
      refresh: "重新整理",
      unknown: "未知",
      online: "線上",
      brand: "品牌",
    },
    nav: {
      monitor: "監控儀表板",
      rawData: "RAW 資料",
    },
    monitorDashboard: {
      title: "監控儀表板",
      lastUpdate: "最後更新",
      selectDevice: "選擇設備 (devID)",
      chooseDevice: "-- 請選擇設備 --",
      lastSeen: "最後偵測時間",
      errorLoad: "無法載入最新資料，請檢查網路連線。",
      wasteProcessed: "廢棄物處理量",
      todaysInput: "今日投入量 (weight1)",
      currentBiomass: "目前生質量 (weight2)",
      biomassOutput: "生質產出量",
      environmentalSensors: "環境感測數據",
      chamberTemp: "艙內溫度",
      humidity: "濕度",
      co2Nh3Level: "CO2 / NH3 濃度",
      energyMonitoring: "能源監控",
      systemUsage: "系統用電量 (ACMotor)",
      solarGeneration: "太陽能發電量 (BatVoltage)",
      reduction: "減量分析",
      latestReduction: "最新減量",
      totalReduction7Days: "總減量（近 7 天）",
      historyData: "歷史數據",
      weightTrend: "重量趨勢（近 7 天）",
      reductionAnalysis: "減量分析",
      dailyReductionTrend: "每日減量趨勢（近 7 天）",
      devicesOverview: "設備總覽",
      devIdColumn: "設備 ID",
      statusColumn: "狀態",
      latestValuesColumn: "最新數值",
      lastSeenColumn: "最後偵測時間",
    },
    rawData: {
      title: "RAW 資料查詢",
      subtitle: "檢視資料庫回傳的原始 JSON 數據",
      selectDevice: "選擇設備 (devID)",
      chooseDevice: "-- 請選擇設備 --",
      msgId: "Msg ID",
      noData: "目前沒有資料",
    },
  },
};

export default translations;
```

- [ ] **Step 2: 靜態檢查兩個語言的 key 是否一致**

Run:
```bash
node -e "
const fs = require('fs');
const src = fs.readFileSync('src/translations/index.js', 'utf8');
const enKeys = [...src.matchAll(/en:[\s\S]*?zh:/)][0][0];
console.log('OK: file readable, manual key-parity check done via review below');
"
```

Expected: 指令成功執行不報錯（此指令僅確認檔案可讀取、語法上 `en:` 與 `zh:` 區塊都存在；因為專案沒有安裝 `node_modules`，無法直接 `require` 這個 ES module 檔案）。接著人工比對：`en` 與 `zh` 兩個物件底下的 namespace（`common`/`nav`/`monitorDashboard`/`rawData`）與各自的 key 數量應完全對應——上面的程式碼已經是逐一對應寫好的，只需視覺確認沒有拼字不一致（例如 `chooseDevice` 兩邊都要有，不可以一邊寫成 `chooseDev`）。

- [ ] **Step 3: Commit**

```bash
git add src/translations/index.js
git commit -m "feat: add en/zh translation dictionary"
```

---

### Task 3: LanguageContextWrapper provider，並接上 index.js

**Files:**
- Create: `src/components/LanguageWrapper/LanguageWrapper.js`
- Modify: `src/index.js`

**Interfaces:**
- Consumes: `LanguageContext`, `languages` from `contexts/LanguageContext`（Task 1）；`translations` from `translations`（Task 2）。
- Produces: `export default function LanguageContextWrapper(props)` — 一個 React component，`props.children` 會被 `LanguageContext.Provider` 包住。後續所有元件透過 `useLanguage()` 拿到的 `{ language, setLanguage, t }` 都來自這裡。

- [ ] **Step 1: 建立 LanguageWrapper.js**

```js
import React, { useState, useCallback } from "react";
import { LanguageContext, languages } from "contexts/LanguageContext";
import translations from "translations";

const STORAGE_KEY = "appLanguage";

function getInitialLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === languages.en || stored === languages.zh) {
      return stored;
    }
  } catch (e) {
    // localStorage unavailable (e.g. private browsing) - fall back to default
  }
  return languages.en;
}

export default function LanguageContextWrapper(props) {
  const [language, setLanguageState] = useState(getInitialLanguage);

  const setLanguage = useCallback((lang) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {
      // ignore write failures
    }
  }, []);

  const t = useCallback(
    (key) => {
      const parts = key.split(".");
      let value = translations[language];
      for (const part of parts) {
        value = value?.[part];
      }
      return typeof value === "string" ? value : key;
    },
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {props.children}
    </LanguageContext.Provider>
  );
}
```

- [ ] **Step 2: 靜態檢查**

Run: `grep -n "export default function LanguageContextWrapper\|STORAGE_KEY = \"appLanguage\"" src/components/LanguageWrapper/LanguageWrapper.js`

Expected: 兩行都要出現。

- [ ] **Step 3: 修改 index.js，加入 import**

Modify `src/index.js`:

```js
import ThemeContextWrapper from "./components/ThemeWrapper/ThemeWrapper";
import BackgroundColorWrapper from "./components/BackgroundColorWrapper/BackgroundColorWrapper";
```

改為：

```js
import ThemeContextWrapper from "./components/ThemeWrapper/ThemeWrapper";
import BackgroundColorWrapper from "./components/BackgroundColorWrapper/BackgroundColorWrapper";
import LanguageContextWrapper from "./components/LanguageWrapper/LanguageWrapper";
```

- [ ] **Step 4: 修改 index.js，包住 root.render**

Modify `src/index.js`:

```js
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
```

改為：

```js
root.render(
  <LanguageContextWrapper>
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
  </LanguageContextWrapper>
);
```

- [ ] **Step 5: 靜態檢查 index.js**

Run: `grep -n "LanguageContextWrapper" src/index.js`

Expected: 至少 3 行出現——1 次 import、1 次開頭標籤 `<LanguageContextWrapper>`、1 次結尾標籤 `</LanguageContextWrapper>`。

- [ ] **Step 6: Commit**

```bash
git add src/components/LanguageWrapper/LanguageWrapper.js src/index.js
git commit -m "feat: wire LanguageContextWrapper into app root"
```

---

### Task 4: routes.js 導覽名稱改用 key，Sidebar/Admin 套用翻譯

**Files:**
- Modify: `src/routes.js`
- Modify: `src/components/Sidebar/Sidebar.js`
- Modify: `src/layouts/Admin/Admin.js`

**Interfaces:**
- Consumes: `useLanguage()`（Task 1）。
- Produces: `routes[i].name` 從字面文字改為翻譯 key（`"nav.monitor"` / `"nav.rawData"`），`Sidebar` 與 `Admin` 的 `getBrandText` 都改成呼叫 `t(routes[i].name)` 顯示。這是後續 Task 5（Navbar 顯示 brandText）依賴的行為。

- [ ] **Step 1: 修改 routes.js**

Modify `src/routes.js`:

```js
var routes = [
  {
    path: "/monitor",
    name: "Monitor Dashboard",
    icon: "tim-icons icon-chart-pie-36",
    component: <MonitorDashboard />,
    layout: "/admin",
  },
  {
    path: "/raw-data",
    name: "RAW 資料",
    icon: "tim-icons icon-paper",
    component: <RawData />,
    layout: "/admin",
  }
];
```

改為：

```js
var routes = [
  {
    path: "/monitor",
    name: "nav.monitor",
    icon: "tim-icons icon-chart-pie-36",
    component: <MonitorDashboard />,
    layout: "/admin",
  },
  {
    path: "/raw-data",
    name: "nav.rawData",
    icon: "tim-icons icon-paper",
    component: <RawData />,
    layout: "/admin",
  }
];
```

- [ ] **Step 2: 修改 Sidebar.js，加入 import 與 hook**

Modify `src/components/Sidebar/Sidebar.js`:

```js
import {
  BackgroundColorContext,
  backgroundColors,
} from "contexts/BackgroundColorContext";
```

改為：

```js
import {
  BackgroundColorContext,
  backgroundColors,
} from "contexts/BackgroundColorContext";
import { useLanguage } from "contexts/LanguageContext";
```

- [ ] **Step 3: 在 Sidebar function 內取得 t，並套用到導覽項目**

Modify `src/components/Sidebar/Sidebar.js`:

```js
function Sidebar(props) {
  const location = useLocation();
  const sidebarRef = React.useRef(null);
```

改為：

```js
function Sidebar(props) {
  const location = useLocation();
  const sidebarRef = React.useRef(null);
  const { t } = useLanguage();
```

再修改：

```js
                    <NavLink
                      to={prop.layout + prop.path}
                      className="nav-link"
                      onClick={props.toggleSidebar}
                    >
                      <i className={prop.icon} />
                      <p>{rtlActive ? prop.rtlName : prop.name}</p>
                    </NavLink>
```

改為：

```js
                    <NavLink
                      to={prop.layout + prop.path}
                      className="nav-link"
                      onClick={props.toggleSidebar}
                    >
                      <i className={prop.icon} />
                      <p>{rtlActive ? prop.rtlName : t(prop.name)}</p>
                    </NavLink>
```

- [ ] **Step 4: 修改 Admin.js，加入 import 與 hook**

Modify `src/layouts/Admin/Admin.js`:

```js
import logo from "assets/img/react-logo.png";
import { BackgroundColorContext } from "contexts/BackgroundColorContext";
```

改為：

```js
import logo from "assets/img/react-logo.png";
import { BackgroundColorContext } from "contexts/BackgroundColorContext";
import { useLanguage } from "contexts/LanguageContext";
```

- [ ] **Step 5: 在 Admin function 內取得 t，並套用到 getBrandText**

Modify `src/layouts/Admin/Admin.js`:

```js
function Admin(props) {
  const location = useLocation();
  const mainPanelRef = React.useRef(null);
```

改為：

```js
function Admin(props) {
  const location = useLocation();
  const mainPanelRef = React.useRef(null);
  const { t } = useLanguage();
```

再修改：

```js
  const getBrandText = (path) => {
    for (let i = 0; i < routes.length; i++) {
      if (location.pathname.indexOf(routes[i].layout + routes[i].path) !== -1) {
        return routes[i].name;
      }
    }
    return "Brand";
  };
```

改為：

```js
  const getBrandText = (path) => {
    for (let i = 0; i < routes.length; i++) {
      if (location.pathname.indexOf(routes[i].layout + routes[i].path) !== -1) {
        return t(routes[i].name);
      }
    }
    return t("common.brand");
  };
```

- [ ] **Step 6: 靜態檢查**

Run:
```bash
grep -n '"nav.monitor"\|"nav.rawData"' src/routes.js
grep -n "useLanguage\|t(prop.name)" src/components/Sidebar/Sidebar.js
grep -n "useLanguage\|t(routes\[i\].name)\|t(\"common.brand\")" src/layouts/Admin/Admin.js
```

Expected: 三個指令都要有輸出，分別確認 routes.js 的 key、Sidebar.js 的 hook 與呼叫、Admin.js 的 hook 與呼叫都已套用。

- [ ] **Step 7: Commit**

```bash
git add src/routes.js src/components/Sidebar/Sidebar.js src/layouts/Admin/Admin.js
git commit -m "feat: translate nav route names and brand text"
```

---

### Task 5: AdminNavbar 加入語言切換按鈕

**Files:**
- Modify: `src/components/Navbars/AdminNavbar.js`

**Interfaces:**
- Consumes: `useLanguage()`, `languages`（Task 1）。
- Produces: 一個會呼叫 `setLanguage()` 切換語言的按鈕，放在 Navbar 右上角、Search 按鈕左邊。

- [ ] **Step 1: 加入 import**

Modify `src/components/Navbars/AdminNavbar.js`:

```js
import React from "react";
// nodejs library that concatenates classes
import classNames from "classnames";
```

改為：

```js
import React from "react";
// nodejs library that concatenates classes
import classNames from "classnames";
import { useLanguage, languages } from "contexts/LanguageContext";
```

- [ ] **Step 2: 在元件內取得 language/setLanguage，並新增切換函式**

Modify `src/components/Navbars/AdminNavbar.js`:

```js
function AdminNavbar(props) {
  const [collapseOpen, setcollapseOpen] = React.useState(false);
  const [modalSearch, setmodalSearch] = React.useState(false);
  const [color, setcolor] = React.useState("navbar-transparent");
```

改為：

```js
function AdminNavbar(props) {
  const [collapseOpen, setcollapseOpen] = React.useState(false);
  const [modalSearch, setmodalSearch] = React.useState(false);
  const [color, setcolor] = React.useState("navbar-transparent");
  const { language, setLanguage } = useLanguage();
```

再修改（緊接在 `toggleModalSearch` 之後加入新函式）：

```js
  // this function is to open the Search modal
  const toggleModalSearch = () => {
    setmodalSearch(!modalSearch);
  };
```

改為：

```js
  // this function is to open the Search modal
  const toggleModalSearch = () => {
    setmodalSearch(!modalSearch);
  };
  // this function switches between English and Chinese UI text
  const toggleLanguage = () => {
    setLanguage(language === languages.en ? languages.zh : languages.en);
  };
```

- [ ] **Step 3: 在 JSX 中加入切換按鈕**

Modify `src/components/Navbars/AdminNavbar.js`:

```js
          <Collapse navbar isOpen={collapseOpen}>
            <Nav className="ml-auto" navbar>
              <InputGroup className="search-bar">
                <Button color="link" onClick={toggleModalSearch}>
                  <i className="tim-icons icon-zoom-split" />
                  <span className="d-lg-none d-md-block">Search</span>
                </Button>
              </InputGroup>
```

改為：

```js
          <Collapse navbar isOpen={collapseOpen}>
            <Nav className="ml-auto" navbar>
              <Button
                color="link"
                className="btn-language"
                onClick={toggleLanguage}
              >
                {language === languages.en ? "中" : "EN"}
              </Button>
              <InputGroup className="search-bar">
                <Button color="link" onClick={toggleModalSearch}>
                  <i className="tim-icons icon-zoom-split" />
                  <span className="d-lg-none d-md-block">Search</span>
                </Button>
              </InputGroup>
```

- [ ] **Step 4: 靜態檢查**

Run: `grep -n "useLanguage\|toggleLanguage\|btn-language" src/components/Navbars/AdminNavbar.js`

Expected: 至少 4 行輸出（import、hook 取值、函式定義、JSX 按鈕的 className 與 onClick）。

- [ ] **Step 5: Commit**

```bash
git add src/components/Navbars/AdminNavbar.js
git commit -m "feat: add language toggle button to AdminNavbar"
```

---

### Task 6: 翻譯 MonitorDashboard.js

**Files:**
- Modify: `src/views/MonitorDashboard.js`

**Interfaces:**
- Consumes: `useLanguage()`（Task 1），對應 `monitorDashboard.*` 與 `common.*` key（Task 2 中已定義）。
- Produces: 頁面上所有原本寫死的英文 UI 文字改為透過 `t()` 顯示。錯誤訊息與「Unknown」文字改存翻譯 key／sentinel，在 render 時才呼叫 `t()`，避免 `fetchData` 因為 `t` 改變而重新觸發（`t` 會隨語言切換而換一份新的 function reference）。

- [ ] **Step 1: 加入 import 與 hook，定義 unknown sentinel**

Modify `src/views/MonitorDashboard.js`:

```js
import {
  Card,
  CardHeader,
  CardBody,
  CardTitle,
  Row,
  Col,
  Table,
  Spinner,
  Badge,
  FormGroup,
  Label,
  Input,
  Alert
} from "reactstrap";

// 5. 主儀表板畫面
function MonitorDashboard() {
  const [loading, setLoading] = useState(true);
```

改為：

```js
import {
  Card,
  CardHeader,
  CardBody,
  CardTitle,
  Row,
  Col,
  Table,
  Spinner,
  Badge,
  FormGroup,
  Label,
  Input,
  Alert
} from "reactstrap";
import { useLanguage } from "contexts/LanguageContext";

const UNKNOWN_LAST_UPDATED = "__unknown__";

// 5. 主儀表板畫面
function MonitorDashboard() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
```

- [ ] **Step 2: 錯誤訊息改存 key，lastUpdated fallback 改用 sentinel**

Modify `src/views/MonitorDashboard.js`:

```js
      if (response && response.data && response.data.LATEST) {
        const transformedData = { 'B-BOX-01': response.data.LATEST };
        setRawData(transformedData);
        setLastUpdated(response.last_updated || "Unknown");
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Failed to load latest data. Please check your connection.");
    } finally {
```

改為：

```js
      if (response && response.data && response.data.LATEST) {
        const transformedData = { 'B-BOX-01': response.data.LATEST };
        setRawData(transformedData);
        setLastUpdated(response.last_updated || UNKNOWN_LAST_UPDATED);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("monitorDashboard.errorLoad");
    } finally {
```

- [ ] **Step 3: 頂部控制欄文字（error alert、標題、Refresh、Select Device、Last Seen）**

Modify `src/views/MonitorDashboard.js`:

```js
      {error && (
        <Alert color="danger" toggle={() => setError(null)}>
          {error}
        </Alert>
      )}
```

改為：

```js
      {error && (
        <Alert color="danger" toggle={() => setError(null)}>
          {t(error)}
        </Alert>
      )}
```

再修改：

```js
                <Col md="6">
                  <CardTitle tag="h2">Monitor Dashboard</CardTitle>
                  <p className="text-muted">Last Update: {lastUpdated}</p>
                </Col>
                <Col md="6" className="text-right">
                  <button className="btn btn-info btn-sm" onClick={fetchData} disabled={loading}>
                    {loading ? <Spinner size="sm" /> : "Refresh"}
                  </button>
                </Col>
```

改為：

```js
                <Col md="6">
                  <CardTitle tag="h2">{t('monitorDashboard.title')}</CardTitle>
                  <p className="text-muted">
                    {t('monitorDashboard.lastUpdate')}: {lastUpdated === UNKNOWN_LAST_UPDATED ? t('common.unknown') : lastUpdated}
                  </p>
                </Col>
                <Col md="6" className="text-right">
                  <button className="btn btn-info btn-sm" onClick={fetchData} disabled={loading}>
                    {loading ? <Spinner size="sm" /> : t('common.refresh')}
                  </button>
                </Col>
```

再修改：

```js
                    <Label for="devSelect" className="text-white">Select Device (devID)</Label>
                    <Input 
                      type="select" 
                      id="devSelect"
                      value={selectedDevID}
                      onChange={(e) => setSelectedDevID(e.target.value)}
                      className="bg-dark text-white border-info"
                    >
                      <option value="">-- Choose a Device --</option>
```

改為：

```js
                    <Label for="devSelect" className="text-white">{t('monitorDashboard.selectDevice')}</Label>
                    <Input 
                      type="select" 
                      id="devSelect"
                      value={selectedDevID}
                      onChange={(e) => setSelectedDevID(e.target.value)}
                      className="bg-dark text-white border-info"
                    >
                      <option value="">{t('monitorDashboard.chooseDevice')}</option>
```

再修改：

```js
                    <div className="text-right">
                      <p className="mb-0 text-muted">Last Seen: {new Date(selectedDeviceData.lastTime).toLocaleString()}</p>
                    </div>
```

改為：

```js
                    <div className="text-right">
                      <p className="mb-0 text-muted">{t('monitorDashboard.lastSeen')}: {new Date(selectedDeviceData.lastTime).toLocaleString()}</p>
                    </div>
```

- [ ] **Step 4: WASTE PROCESSED 區塊三張卡片**

Modify `src/views/MonitorDashboard.js`:

```js
          <h3 className="section-title text-success">
            <i className="tim-icons icon-delivery-fast mr-2" /> WASTE PROCESSED
          </h3>
```

改為：

```js
          <h3 className="section-title text-success">
            <i className="tim-icons icon-delivery-fast mr-2" /> {t('monitorDashboard.wasteProcessed')}
          </h3>
```

再修改：

```js
                        <p className="card-category">TODAY'S INPUT (weight1)</p>
```

改為：

```js
                        <p className="card-category">{t('monitorDashboard.todaysInput')}</p>
```

再修改：

```js
                        <p className="card-category">CURRENT BIOMASS (weight2)</p>
```

改為：

```js
                        <p className="card-category">{t('monitorDashboard.currentBiomass')}</p>
```

再修改：

```js
                        <p className="card-category">BIOMASS OUTPUT</p>
```

改為：

```js
                        <p className="card-category">{t('monitorDashboard.biomassOutput')}</p>
```

- [ ] **Step 5: ENVIRONMENTAL SENSORS 區塊三張卡片**

Modify `src/views/MonitorDashboard.js`:

```js
          <h3 className="section-title text-info">
            <i className="tim-icons icon-world mr-2" /> ENVIRONMENTAL SENSORS
          </h3>
```

改為：

```js
          <h3 className="section-title text-info">
            <i className="tim-icons icon-world mr-2" /> {t('monitorDashboard.environmentalSensors')}
          </h3>
```

再修改：

```js
                        <p className="card-category">CHAMBER TEMP</p>
```

改為：

```js
                        <p className="card-category">{t('monitorDashboard.chamberTemp')}</p>
```

再修改：

```js
                        <p className="card-category">HUMIDITY</p>
```

改為：

```js
                        <p className="card-category">{t('monitorDashboard.humidity')}</p>
```

再修改：

```js
                            <p className="card-category">CO2 / NH3 LEVEL</p>
```

改為：

```js
                            <p className="card-category">{t('monitorDashboard.co2Nh3Level')}</p>
```

- [ ] **Step 6: ENERGY MONITORING 區塊兩張卡片**

Modify `src/views/MonitorDashboard.js`:

```js
          <h3 className="section-title text-warning">
            <i className="tim-icons icon-bolt-31 mr-2" /> ENERGY MONITORING
          </h3>
```

改為：

```js
          <h3 className="section-title text-warning">
            <i className="tim-icons icon-bolt-31 mr-2" /> {t('monitorDashboard.energyMonitoring')}
          </h3>
```

再修改：

```js
                        <p className="card-category">SYSTEM USAGE (ACMotor)</p>
```

改為：

```js
                        <p className="card-category">{t('monitorDashboard.systemUsage')}</p>
```

再修改：

```js
                        <p className="card-category">SOLAR GENERATION (BatVoltage)</p>
```

改為：

```js
                        <p className="card-category">{t('monitorDashboard.solarGeneration')}</p>
```

- [ ] **Step 7: REDUCTION 區塊兩張卡片**

Modify `src/views/MonitorDashboard.js`:

```js
          <h3 className="section-title text-danger">
            <i className="tim-icons icon-trash-simple mr-2" /> REDUCTION
          </h3>
```

改為：

```js
          <h3 className="section-title text-danger">
            <i className="tim-icons icon-trash-simple mr-2" /> {t('monitorDashboard.reduction')}
          </h3>
```

再修改：

```js
                        <p className="card-category">LATEST REDUCTION</p>
```

改為：

```js
                        <p className="card-category">{t('monitorDashboard.latestReduction')}</p>
```

再修改：

```js
                        <p className="card-category">TOTAL REDUCTION (7 DAYS)</p>
```

改為：

```js
                        <p className="card-category">{t('monitorDashboard.totalReduction7Days')}</p>
```

- [ ] **Step 8: 兩個歷史趨勢圖表標題**

Modify `src/views/MonitorDashboard.js`:

```js
                  <Col className="text-left" sm="6">
                    <h5 className="card-category">History Data</h5>
                    <CardTitle tag="h2">Weight Trend (7 Days)</CardTitle>
                  </Col>
```

改為：

```js
                  <Col className="text-left" sm="6">
                    <h5 className="card-category">{t('monitorDashboard.historyData')}</h5>
                    <CardTitle tag="h2">{t('monitorDashboard.weightTrend')}</CardTitle>
                  </Col>
```

再修改：

```js
                  <Col className="text-left" sm="6">
                    <h5 className="card-category">Reduction Analysis</h5>
                    <CardTitle tag="h2">Daily Reduction Trend (7 Days)</CardTitle>
                  </Col>
```

改為：

```js
                  <Col className="text-left" sm="6">
                    <h5 className="card-category">{t('monitorDashboard.reductionAnalysis')}</h5>
                    <CardTitle tag="h2">{t('monitorDashboard.dailyReductionTrend')}</CardTitle>
                  </Col>
```

- [ ] **Step 9: Devices Overview 表格**

Modify `src/views/MonitorDashboard.js`:

```js
            <CardHeader>
              <CardTitle tag="h4">Devices Overview</CardTitle>
            </CardHeader>
            <CardBody>
              <Table className="tablesorter" responsive>
                <thead className="text-primary">
                  <tr>
                    <th>devID</th>
                    <th>Status</th>
                    <th>Latest Values</th>
                    <th>Last Seen</th>
                  </tr>
                </thead>
```

改為：

```js
            <CardHeader>
              <CardTitle tag="h4">{t('monitorDashboard.devicesOverview')}</CardTitle>
            </CardHeader>
            <CardBody>
              <Table className="tablesorter" responsive>
                <thead className="text-primary">
                  <tr>
                    <th>{t('monitorDashboard.devIdColumn')}</th>
                    <th>{t('monitorDashboard.statusColumn')}</th>
                    <th>{t('monitorDashboard.latestValuesColumn')}</th>
                    <th>{t('monitorDashboard.lastSeenColumn')}</th>
                  </tr>
                </thead>
```

再修改：

```js
                        <td>
                          <Badge color="success">Online</Badge>
                        </td>
```

改為：

```js
                        <td>
                          <Badge color="success">{t('common.online')}</Badge>
                        </td>
```

- [ ] **Step 10: 靜態檢查——確認舊的寫死英文字串都已移除**

Run:
```bash
grep -n "WASTE PROCESSED\|ENVIRONMENTAL SENSORS\|ENERGY MONITORING\|>REDUCTION<\|TODAY'S INPUT\|CURRENT BIOMASS\|BIOMASS OUTPUT\|CHAMBER TEMP\|>HUMIDITY<\|CO2 / NH3 LEVEL\|SYSTEM USAGE\|SOLAR GENERATION\|LATEST REDUCTION\|TOTAL REDUCTION\|Devices Overview\|>Refresh<\|Select Device (devID)\|Choose a Device\|Failed to load latest data" src/views/MonitorDashboard.js
```

Expected: 沒有任何輸出（代表所有寫死字串都已經被 `t(...)` 呼叫取代）。

- [ ] **Step 11: 靜態檢查——確認 t() 呼叫數量合理**

Run: `grep -c "t('monitorDashboard\." src/views/MonitorDashboard.js`

Expected: 至少 `24`（對應本檔案用到的 monitorDashboard namespace key 數量）。

- [ ] **Step 12: Commit**

```bash
git add src/views/MonitorDashboard.js
git commit -m "feat: translate MonitorDashboard UI text"
```

---

### Task 7: 翻譯 RawData.js

**Files:**
- Modify: `src/views/RawData.js`

**Interfaces:**
- Consumes: `useLanguage()`（Task 1），對應 `rawData.*` 與 `common.refresh` key（Task 2 中已定義）。
- Produces: 頁面上所有原本寫死的中文 UI 文字改為透過 `t()` 顯示（這樣切回英文時會正確顯示英文）。

- [ ] **Step 1: 加入 import 與 hook**

Modify `src/views/RawData.js`:

```js
import { get } from 'aws-amplify/api';
import {
  Card,
  CardHeader,
  CardBody,
  CardTitle,
  Row,
  Col,
  Spinner,
  FormGroup,
  Label,
  Input,
  Badge
} from "reactstrap";

function RawData() {
  const [loading, setLoading] = useState(true);
```

改為：

```js
import { get } from 'aws-amplify/api';
import {
  Card,
  CardHeader,
  CardBody,
  CardTitle,
  Row,
  Col,
  Spinner,
  FormGroup,
  Label,
  Input,
  Badge
} from "reactstrap";
import { useLanguage } from "contexts/LanguageContext";

function RawData() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
```

- [ ] **Step 2: 標題、重新整理按鈕、選擇設備**

Modify `src/views/RawData.js`:

```js
                <Col md="8">
                  <CardTitle tag="h2">RAW 資料查詢</CardTitle>
                  <p className="text-muted">檢視資料庫回傳的原始 JSON 數據</p>
                </Col>
                <Col md="4" className="text-right">
                  <button className="btn btn-info btn-sm" onClick={fetchData} disabled={loading}>
                    {loading ? <Spinner size="sm" /> : "重新整理"}
                  </button>
                </Col>
              </Row>
            </CardHeader>
            <CardBody>
              <FormGroup>
                <Label for="devSelect" className="text-white">選擇設備 (devID)</Label>
                <Input 
                  type="select" 
                  id="devSelect"
                  value={selectedDevID}
                  onChange={(e) => setSelectedDevID(e.target.value)}
                  className="bg-dark text-white border-info"
                >
                  <option value="">-- 請選擇設備 --</option>
```

改為：

```js
                <Col md="8">
                  <CardTitle tag="h2">{t('rawData.title')}</CardTitle>
                  <p className="text-muted">{t('rawData.subtitle')}</p>
                </Col>
                <Col md="4" className="text-right">
                  <button className="btn btn-info btn-sm" onClick={fetchData} disabled={loading}>
                    {loading ? <Spinner size="sm" /> : t('common.refresh')}
                  </button>
                </Col>
              </Row>
            </CardHeader>
            <CardBody>
              <FormGroup>
                <Label for="devSelect" className="text-white">{t('rawData.selectDevice')}</Label>
                <Input 
                  type="select" 
                  id="devSelect"
                  value={selectedDevID}
                  onChange={(e) => setSelectedDevID(e.target.value)}
                  className="bg-dark text-white border-info"
                >
                  <option value="">{t('rawData.chooseDevice')}</option>
```

- [ ] **Step 3: Msg ID badge 與無資料訊息**

Modify `src/views/RawData.js`:

```js
                      <Badge color="info">Msg ID: {record.msgID}</Badge>
```

改為：

```js
                      <Badge color="info">{t('rawData.msgId')}: {record.msgID}</Badge>
```

再修改：

```js
              <div className="text-center p-5 text-muted">目前沒有資料</div>
```

改為：

```js
              <div className="text-center p-5 text-muted">{t('rawData.noData')}</div>
```

- [ ] **Step 4: 靜態檢查——確認舊的寫死中文字串都已移除**

Run:
```bash
grep -n "RAW 資料查詢\|檢視資料庫回傳的原始\|重新整理\|選擇設備 (devID)\|請選擇設備\|Msg ID: {record\|目前沒有資料" src/views/RawData.js
```

Expected: 沒有任何輸出。

- [ ] **Step 5: 靜態檢查——確認 t() 呼叫數量合理**

Run: `grep -c "t('rawData\.\|t('common.refresh')" src/views/RawData.js`

Expected: 至少 `6`。

- [ ] **Step 6: Commit**

```bash
git add src/views/RawData.js
git commit -m "feat: translate RawData UI text"
```

---

### Task 8: 手動端對端驗證（使用者本機執行）

**Files:**
- 無新檔案變更，僅驗證前面 7 個 task 的成果。

**Interfaces:**
- 無

此 task 無法在目前的 sandbox 完成（沒有 `node_modules`，也沒有本機的 `src/aws-exports.js`），需要在使用者自己已設定好 AWS Amplify 的本機環境執行。

- [ ] **Step 1: 安裝依賴（若尚未安裝）**

Run: `npm install`

Expected: 安裝成功，無 error。

- [ ] **Step 2: 啟動 dev server**

Run: `npm start`

Expected: 瀏覽器開啟 `http://localhost:3000`，自動導向 `/admin/monitor`。

- [ ] **Step 3: 確認預設語言為英文**

在瀏覽器檢查：
- Sidebar 顯示 "Monitor Dashboard" 與 "Raw Data"
- Navbar 品牌文字顯示 "Monitor Dashboard"
- Monitor Dashboard 頁面所有卡片標題為英文（"WASTE PROCESSED"、"TODAY'S INPUT (weight1)" 等）
- 切到 Raw Data 頁面，標題顯示 "Raw Data Query"，按鈕顯示 "Refresh"

- [ ] **Step 4: 點擊 Navbar 語言切換按鈕，確認切換到中文**

在瀏覽器檢查：
- 按鈕從顯示「中」變成顯示「EN」
- Sidebar、Navbar 品牌文字、Monitor Dashboard、Raw Data 兩頁的固定文字都變成中文
- 動態資料（devID、感測器數值、時間）維持不變，不受語言切換影響

- [ ] **Step 5: 重新整理頁面，確認語言記憶生效**

在瀏覽器檢查：
- 重新整理（F5）後，介面依然維持中文（不會跳回英文）
- 開啟瀏覽器 DevTools → Application → Local Storage，確認有 `appLanguage: "zh"` 這筆資料

- [ ] **Step 6: 切換路由後確認語言狀態不重置**

在瀏覽器檢查：
- 從 Monitor Dashboard 切到 Raw Data、再切回來，語言仍維持中文（或使用者當時選擇的語言）

- [ ] **Step 7: 確認找不到翻譯時的 fallback 行為（可略過，僅原理確認）**

若在校對翻譯字典時不小心刪掉某個 key，`t()` 會直接顯示該 key 字串（例如 `monitorDashboard.title`）而不是空白或報錯——這是刻意設計，方便之後肉眼抓漏翻。

---

## 完成後續

實作全部完成、Task 8 手動驗證通過後，使用者可以直接編輯 `src/translations/index.js` 裡 `zh` 區塊的字串來調整中文文案措辭，不需要改動任何其他程式碼。
