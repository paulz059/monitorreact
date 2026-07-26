# 語言切換功能設計文件

日期：2026-07-26

## 背景

專案目前實際使用的頁面（`src/routes.js` 中註冊的）只有兩個：

- `MonitorDashboard.js` — 目前所有 UI 文字寫死為英文
- `RawData.js` — 目前所有 UI 文字寫死為中文

其餘模板頁面（`Dashboard.js`、`Icons.js`、`Map.js`、`Notifications.js`、`TableList.js`、`Typography.js`、`UserProfile.js`）沒有被 `routes.js` 引用，屬於未使用的範本頁面，**不在本次翻譯範圍內**。

目標：讓使用者可以在英文／中文之間切換介面語言，涵蓋上述兩個實際頁面，以及共用的 Navbar／Sidebar 文字（品牌名稱、導覽列項目名稱）。

## 範圍

**包含：**
- `MonitorDashboard.js` 所有固定 UI 文字（卡片標題、按鈕、label）
- `RawData.js` 所有固定 UI 文字
- `Sidebar.js` 導覽項目名稱
- `AdminNavbar.js` 品牌文字（`brandText`，來自 `routes[i].name`）
- 新增的語言切換按鈕本身

**不包含：**
- 未被 `routes.js` 引用的範本頁面
- 動態資料內容（devID、時間戳記、感測器數值等）——這些不翻譯
- 瀏覽器語言自動偵測（明確選擇不做，見下方「預設語言」）

## 架構

### LanguageContext + Provider

新增 `src/contexts/LanguageContext.js`，仿照現有 `src/contexts/ThemeContext.js` 的模式，定義 Context 物件與可用語言列表。

新增 `src/components/LanguageWrapper/LanguageWrapper.js`（仿照 `ThemeWrapper.js`），提供 `LanguageContextWrapper`：

- 初始化時讀取 `localStorage.getItem("appLanguage")`，若無則預設 `"en"`
- 提供 `language`、`setLanguage(lang)`、`t(key)` 三個值
- `setLanguage` 呼叫時同步寫入 `localStorage.setItem("appLanguage", lang)`

在 `src/index.js` 中，於 `ThemeContextWrapper` 旁新增 `LanguageContextWrapper` 包住整個 App（順序不影響功能，建議放在最外層或與 ThemeContextWrapper 同層）。

### 翻譯字典

新增 `src/translations/index.js`，格式為依 namespace 分組的 plain object：

```js
const translations = {
  en: {
    nav: { monitor: "Monitor Dashboard", rawData: "Raw Data" },
    monitorDashboard: { refresh: "Refresh", ... },
    rawData: { refresh: "Refresh", ... },
    common: { ... },
  },
  zh: {
    nav: { monitor: "監控儀表板", rawData: "RAW 資料" },
    monitorDashboard: { refresh: "重新整理", ... },
    rawData: { refresh: "重新整理", ... },
    common: { ... },
  },
};
export default translations;
```

`t(key)` 使用 dot-path（例如 `"monitorDashboard.refresh"`）在目前語言的物件中查表；查不到時 fallback 回傳 key 字串本身，方便日後發現遺漏翻譯的地方。

實作完成後，此檔案的中文字串內容由使用者自行編輯確認，不需要在實作階段追求文案完美。

### 套用到既有元件

- `routes.js`：`name` 欄位改存翻譯 key（如 `"nav.monitor"`、`"nav.rawData"`），不再存字面文字。
- `Sidebar.js`：透過 `useLanguage()` hook 取得 `t`，導覽項目改用 `t(prop.name)` 顯示。
- `Admin.js`：`getBrandText()` 回傳的 `routes[i].name` 同樣需要透過 `t()` 轉換後再傳給 `AdminNavbar` 的 `brandText`。
- `MonitorDashboard.js`：所有寫死的英文 UI 文字改為 `t('monitorDashboard.xxx')` 呼叫。
- `RawData.js`：所有寫死的中文 UI 文字改為 `t('rawData.xxx')` 呼叫。

### 語言切換器 UI

在 `AdminNavbar.js` 右上角（Search 按鈕旁）新增一個簡單按鈕：

- 顯示「對方語言」的名稱：目前是英文時按鈕顯示「中」，目前是中文時按鈕顯示「EN」
- 點擊呼叫 `setLanguage()` 切換至另一語言
- 不使用下拉選單（只有兩個語言，不需要）

## 資料流

1. App 啟動 → `LanguageContextWrapper` 讀取 localStorage → 設定初始 `language` state（預設 `"en"`）
2. 各元件透過 `useLanguage()` hook 取得 `{ language, setLanguage, t }`
3. 元件渲染時呼叫 `t('namespace.key')` 取得對應語言的文字
4. 使用者點擊 Navbar 的切換按鈕 → `setLanguage()` 更新 state 並寫入 localStorage → 所有訂閱 Context 的元件重新渲染，文字即時切換

## 錯誤處理

- `t(key)` 查無對應翻譯時，直接回傳原始 key 字串（不拋錯、不顯示空白），方便開發時肉眼發現遺漏的翻譯項目。
- localStorage 讀取失敗（如隱私模式禁用）時，`try/catch` 包裹，fallback 為預設值 `"en"`，不影響 App 正常運作。

## 測試策略

純 UI 文字替換與 Context 切換邏輯，無複雜商業邏輯，採手動驗證：

1. 啟動 dev server，預設應顯示英文（MonitorDashboard 英文、RawData 也應正確顯示對應語言版本）
2. 點擊語言切換按鈕，確認 Navbar 品牌文字、Sidebar 導覽項目、MonitorDashboard、RawData 頁面文字皆同步切換
3. 重新整理頁面，確認語言選擇透過 localStorage 正確保留
4. 切換路由（Monitor Dashboard ↔ RAW 資料）後，確認語言狀態不會重置

不新增自動化測試。

## 待辦（實作階段執行）

- 建立 `LanguageContext` / `LanguageWrapper`
- 建立 `src/translations/index.js`，填入初版中英文字串（使用者後續會自行校對中文內容）
- 修改 `routes.js`、`Sidebar.js`、`Admin.js`、`AdminNavbar.js`、`MonitorDashboard.js`、`RawData.js`
- 手動驗證上述測試策略四點
