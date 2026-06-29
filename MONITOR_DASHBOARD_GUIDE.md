# Monitor Dashboard 程式運作說明文檔

本文件詳細說明 `demo2/monitorreact/src/views/MonitorDashboard.js` 的設計架構、資料處理流程以及 UI 組件運作邏輯。

---

## 1. 核心功能概述
Monitor Dashboard 是本系統的主儀表板，主要功能包括：
*   **即時狀態監控**：顯示各設備最新收到的感測器數值。
*   **數據分組顯示**：將感測器按功能（廢棄物、生物質、環境、能源）進行分類呈現。
*   **設備切換**：支援透過下拉選單切換查看不同 `devID` 的詳細數據。
*   **全局概覽**：底部的表格列出所有在線設備及其最後更新時間。

---

## 2. 資料流架構 (Data Flow)

### A. 後端獲取
當組件掛載 (Mount) 或點擊「Refresh」時，執行 `fetchData` 函式：
1.  呼叫 AWS Amplify 的 `get` API 請求路徑 `/data`。
2.  對應的 Lambda 函式 (`monitorreact4d35ba0f`) 會執行 `scan()` 操作，從 DynamoDB 的 `SensorDataCache-dev` 表中抓取最近 24 小時的所有快取區塊。
3.  回傳格式為：
    ```json
    {
      "data": { "msgID_1": [records...], "msgID_2": [records...] },
      "last_updated": "2026-05-11T..."
    }
    ```

### B. 前端處理 (`useMemo` 邏輯)
為了提高效能，我們使用 `useMemo` 監聽 `rawData`，將雜亂的原始訊息轉換為以設備為中心的結構：
1.  **分組 (Grouping)**：按 `devID` 將所有紀錄分類。
2.  **最新值篩選 (Latest Value Filtering)**：
    *   比較每條紀錄的 `time`。
    *   每個設備 (`devID`) 下的每個感測器 (`sensorType`) 只保留時間戳記最晚的那一筆數值。
3.  **排序**：將設備清單按 `devID` 字母順序排列。

---

## 3. UI 組件結構

### 第一層：頂部控制卡片 (Control Card)
*   顯示最後同步時間。
*   提供「Refresh」手動刷新按鈕。
*   **下拉選單 (Select Device)**：改變 `selectedDevID` 狀態，觸發下方的連動更新。

### 第二層：感測器分組區 (Sensor Groups)
程式碼中使用一個配置陣列 `sensorGroups` 來定義分類：
*   **WASTE PROCESSED**: 顯示 `weight1`。
*   **BIOMASS PERFORMANCE**: 顯示 `weight2`。
*   **ENVIRONMENTAL SENSORS**: 顯示溫濕度、CO2、NH3。
*   **ENERGY MONITORING**: 顯示 AC 馬達與電池電壓。

每個區塊會檢查 `selectedDeviceData` 是否含有該組定義的感測器，若有則顯示卡片。

### 第三層：設備概覽表 (Devices Overview)
*   列出系統偵測到的所有設備 ID。
*   點擊表格中的任何一行 (Row)，會直接切換選取該設備，上方卡片也會同步更新。
*   顯示每個設備「前三項」感測器的數值縮影。

---

## 4. 樣式與擴展說明

### 如何新增感測器型態？
若未來有新的感測器加入（例如 `Pressure`），只需修改兩處：
1.  **`getSensorDetail` 函式**：新增該型態的單位與圖示。
    ```javascript
    "Pressure": { unit: "hPa", icon: "tim-icons icon-compass-05" }
    ```
2.  **`sensorGroups` 配置**：將 `Pressure` 加入適合的分組（如 `ENVIRONMENTAL SENSORS`）。

### 樣式說明
*   **圖示庫**：使用 `nucleo-icons` (tim-icons)。
*   **佈局**：基於 `reactstrap` (Bootstrap 4) 的 Grid System，支援響應式 (Responsive) 顯示。

---

## 5. 效能優化點
*   **useMemo**：確保只有在 API 抓回新資料時才進行大規模的數據轉換運算。
*   **Conditional Rendering**：只有當設備真的有該感測器資料時，才會渲染對應卡片，避免出現空值卡片。
*   **Lambda Scan**：目前的 Lambda 採用掃描機制獲取 24 小時數據，這確保了即使最新快取遺失，也能從歷史分區中恢復顯示。

---
*文檔更新日期：2026年5月11日*
