# 儀表板圖表/卡片邏輯總覽 (Dashboard Charts & Cards Logic)

本文檔整理 `src/views/MonitorDashboard.js` 裡每一張卡片、每一張圖表的資料來源、計算公式、顯示條件，方便日後查閱、除錯或調整係數時對照。所有程式碼行號以撰寫本文檔當下的 `MonitorDashboard.js` 為準，之後若檔案有大改動行號可能會偏移，但邏輯位置可用區塊名稱（如「CARBON PERFORMANCE」）搜尋定位。

## 資料來源總覽

整個頁面只有兩種資料來源，理解這兩種是看懂所有卡片的前提：

| 來源 | API 呼叫方式 | 更新時機 | 用途 |
|---|---|---|---|
| **即時快照 (latest)** | `GET /data?type=latest` | 頁面載入、按重新整理 | 提供 `selectedDeviceData.sensors.xxx`，也就是每個感測器「目前最新一筆」讀數 |
| **歷史紀錄 (history)** | `GET /data?type=history&sensorType=xxx&days=N&devID=xxx` | 選擇裝置時、天數切換時 | 提供某個感測器過去 N 天的所有原始紀錄，用來畫圖表、算累積量 |

即時快照的資料存在 `devices` state 裡（`MonitorDashboard.js:228-252`），透過 `selectedDeviceData = devices.find(d => d.devID === selectedDevID)` 取出目前選中的裝置。所有「XXX LATEST」類型的卡片幾乎都是直接讀 `selectedDeviceData.sensors.感測器名稱`。

歷史紀錄目前只有三個地方在用：
- `weight2` 過去 7/15/30 天（`weightTrendDays` 切換）→ 給 Container Weight Trend 圖表
- `weight1` 過去 7 天（固定）→ 給 Daily Reduction Trend 圖表和 Carbon Performance 卡片
- `weight2` 過去 7 天（固定，跟上面的 weight2-7/15/30 是**分開兩次獨立呼叫**，不共用同一份資料）→ 給 Daily Reduction Trend 圖表

---

## CARBON PERFORMANCE 區塊

### LATEST REDUCTION
- **資料來源**：即時快照 `selectedDeviceData.sensors.weight1` / `weight2`
- **公式**：
  ```
  biomassOut = weight2 / 15
  reduction  = (weight1 × 1.5) + (biomassOut × 0.9635)
  ```
- **顯示條件**：`weight1`/`weight2` 缺值時當作 `0` 代入公式（不會顯示 `--`，永遠算得出一個數字，即使是 0）
- **單位**：KgCO2e
- 意義：用「此刻」最新一筆讀數即時算出的碳排減量估算值

### TOTAL REDUCTION (7 DAYS)
- **資料來源**：`totalReduction7Days`（`MonitorDashboard.js:220-226`），是 Daily Reduction Trend 圖表（見下方）算出的 7 天每日減量加總
- **顯示條件**：Daily Reduction Trend 沒資料時顯示 `"0.00"`
- **單位**：KgCO2e

---

## Today Waste Processed 區塊

### TODAY'S INPUT (weight1)
- **資料來源**：即時快照 `selectedDeviceData.sensors.weight1`
- **顯示條件**：
  - `weight1` 存在（非 `undefined`/`null`）→ 顯示 `parseFloat(weight1).toFixed(2)` kg
  - 否則 → 顯示 `--`
- 純粹原始讀數，無運算

### CURRENT BIOMASS (weight2)
- **資料來源**：即時快照 `selectedDeviceData.sensors.weight2`
- **顯示條件**：同 TODAY'S INPUT，存在則顯示兩位小數，否則 `--`
- 純粹原始讀數，無運算

### BIOMASS OUTPUT
- **資料來源**：同上 `weight2`，經 `useMemo` 算出（`MonitorDashboard.js:269-272`）
- **公式**：`weight2 ÷ 15`
- **顯示條件**：
  - `weight2` 是 `undefined`/`null` → 顯示 `"0.00"`（⚠️ 注意這裡 fallback 是 `"0.00"` 字串，跟上面兩張卡片的 `--` fallback **不一致**，是目前程式碼裡一個小的不統一之處）
  - 否則 → `(weight2 / 15).toFixed(2)`
- `/ 15` 這個係數跟 Carbon Performance 卡片裡的 `biomassOut = weight2 / 15` 是同一套邏輯，在檔案裡出現了兩次（一次即時算、一次歷史算），沒有共用函式

---

## ENVIRONMENTAL SENSORS 區塊

### CHAMBER TEMP / HUMIDITY
- **資料來源**：即時快照 `selectedDeviceData.sensors.Temperature` / `Humidity`
- **顯示條件**：直接顯示原始值，缺值顯示 `--`
- **異常警示**（`getAlertClass`，`MonitorDashboard.js:274-283`）：
  - Temperature > 37 → 卡片套用 `card-warning-alert` 樣式（警示邊框/發光）
  - Humidity > 75 → 同上

### CO2 / NH3 LEVEL
- **資料來源**：即時快照 `selectedDeviceData.sensors.CO2` / `NH3`
- **顯示條件**：直接顯示原始值（`CO2值 / NH3值 ppm` 並排），缺值顯示 `--`
- **異常警示**（就地判斷，非 `getAlertClass`，`MonitorDashboard.js:577`）：
  - `CO2 > 5000` **或** `NH3 > 1000` → 套用警示樣式
  - 這組閾值跟上面 `getAlertClass` 裡的 CO2/NH3 判斷式（`MonitorDashboard.js:278-279`）數值相同，但寫在兩個不同地方，維護時要記得兩處都要改

---

## BIOMASS PERFORMANCE 區塊（LARVAL GROWTH STAGE 表格）

- **資料來源**：即時快照 `Temperature` / `Humidity`
- **判定邏輯**（`MonitorDashboard.js:636`）：
  ```
  isActive = 15 ≤ Temperature ≤ 45  且  35 ≤ Humidity ≤ 75
  ```
- **顯示**：`isActive` 為真 → 綠色 `Active` 徽章；否則 → 灰色 `Inactive` 徽章
- 這是本頁唯一一個「雙邊界區間判斷」（有上限也有下限），其他警示邏輯都只有單邊界（只判斷「超過多少」）

---

## SYSTEM STATUS 區塊

- **資料來源**：即時快照，固定顯示 7 個欄位：`TiltDetect`、`RollMotor`、`CBoardPD`、`FanMotorIN`、`FanMotorOUT`、`rssi`、`value`
- **顯示條件**：逐一讀 `selectedDeviceData.sensors[欄位名]`，缺值顯示 `--`
- 純表格展示，**沒有任何異常警示邏輯**（不像上面 Temperature/Humidity/CO2/NH3 會變色警示）
- 欄位標題文字已加上 i18n 翻譯（`translations/index.js` 的 `monitorDashboard.sensorLabels`），但實際查值用的仍是這些原始英文鍵名，因為要對應後端回傳的 `sensorType` 欄位

---

## ENERGY MONITORING 區塊

### SYSTEM USAGE (ACMotor)
- **資料來源**：即時快照 `selectedDeviceData.sensors.ACMotor`
- **異常警示**：`ACMotor > 1.5` → 警示樣式（`getAlertClass`）
- 單位：kw

### SOLAR GENERATION (BatVoltage)
- **資料來源**：即時快照 `selectedDeviceData.sensors.BatVoltage`
- **異常警示**：`BatVoltage < 1.5` → 警示樣式（⚠️ 這個是「低於」才警示，跟其他幾個「高於」才警示的方向相反，是唯一一個下限型警示）
- 單位：kw（卡片標題寫的是 BatVoltage 電壓，但顯示單位是 kw，命名跟單位不完全對應，屬於既有的小瑕疵）

---

## Container Weight Trend 圖表

- **資料來源**：歷史紀錄，只抓 `weight2`，天數依右上角切換器（7/15/30 天）決定
- **每日取值方式**：取當天**時間戳記最新（最後）一筆**讀數，不加總、不平均（`MonitorDashboard.js:135-144`）
- **X 軸**：依日期排序
- **資料清洗**：非數字/`NaN` 的讀數會被排除，不計入（`Number.isFinite` 檢查）
- 意義：反映「每天結束時」容器重量的狀態快照

---

## Daily Reduction Trend 圖表（7天）

- **資料來源**：歷史紀錄，`weight1` 和 `weight2` 各自固定抓 7 天（跟上面 Container Weight Trend 用的 weight2 資料是**不同次**API呼叫，即使天數剛好都選7天也不會共用）
- **每日取值方式**：把當天**所有**讀數**加總**（不是取最後一筆）（`MonitorDashboard.js:176-192`）
- **X 軸**：weight1、weight2 兩者日期的聯集，缺的那天當 0
- **每日減量公式**：
  ```
  biomassOut = 當日weight2加總 / 15
  reduction  = (當日weight1加總 × 1.5) + (biomassOut × 0.9635)
  ```
- **7天總量**：把上面 7 天的 `reduction` 全部加總，即為 `totalReduction7Days`（給 CARBON PERFORMANCE 區塊的 TOTAL REDUCTION 卡片用）
- **資料清洗**：同上，非數字讀數不計入加總

> **兩張圖表對同一個 `weight2` 感測器的「當天怎麼算」邏輯不一樣**：Container Weight Trend 用「當天最後一筆」，Daily Reduction Trend 用「當天全部加總」。這是刻意的設計（一個看「當下狀態」、一個看「累積流量」），但如果要修改其中一個的計算方式時，要注意不要誤改到另一個。

---

## Devices Overview 表格

- **資料來源**：即時快照 `devices`（所有裝置，不只選中的那台）
- **狀態欄**：⚠️ 目前**永遠硬編碼顯示綠色「Online」徽章**（`MonitorDashboard.js:1011`），沒有實際判斷裝置是否離線、沒有跟 `lastTime` 做比對。如果之後要做真正的線上/離線判斷，這裡是需要補邏輯的地方
- **Latest Values 欄**：只顯示該裝置 `sensors` 物件裡的前 3 筆（`Object.entries(dev.sensors).slice(0, 3)`），超過 3 筆會顯示 `...`
- **Last Seen 欄**：`dev.lastTime`，是該裝置所有已知感測器讀數裡最新的時間戳記（`devices` 這個 `useMemo` 裡逐筆比對算出來的，`MonitorDashboard.js:246-248`）

---

## GPS Location（頂部控制欄內）

- **資料來源**：即時快照 `selectedDeviceData.sensors.GPS`
- **顯示條件**：GPS 存在才顯示文字座標和地圖預覽；不存在則兩者都不顯示（沒有 `--` fallback，直接不渲染）
- **地圖**：用 Google Maps 免費嵌入網址 `?q=座標&output=embed`，不需要 API Key；外層包一個連結，點擊會開新分頁到完整 Google Maps

---

## 已知的不一致 / 待確認事項清單

這些不是這次新發現的 bug，是整理過程中順便記錄下來、值得你之後決定要不要處理的地方：

1. **BIOMASS OUTPUT 缺值 fallback 是 `"0.00"`**，但同區塊的 TODAY'S INPUT / CURRENT BIOMASS 缺值 fallback 是 `"--"`，兩種风格混用。
2. **CO2/NH3 警示閾值判斷寫在兩個地方**（`getAlertClass` 裡一份、CO2&NH3 卡片內部又寫一份），數值相同但程式碼重複，改一處容易漏改另一處。
3. **SOLAR GENERATION (BatVoltage) 是唯一「低於閾值」才警示**的卡片，其餘都是「高於閾值」警示，容易忘記方向相反。
4. **BatVoltage 顯示單位寫 kw**，但欄位語意是電壓，單位命名可能需要之後確認是否要改成 V 或其他單位。
5. **Devices Overview 的狀態欄位是寫死的「Online」**，沒有真正判斷裝置是否離線。
6. **`weight2 / 15` 這個「生物量產出比例」係數**在檔案裡出現兩次（即時算一次、歷史算一次），沒有抽成共用函式，之後如果要調整這個係數，兩處都要記得改。
7. **Container Weight Trend 用「當天最後一筆」、Daily Reduction Trend 用「當天全部加總」**，同一個 `weight2` 感測器兩種不同的每日聚合方式並存，是刻意設計但容易搞混。
