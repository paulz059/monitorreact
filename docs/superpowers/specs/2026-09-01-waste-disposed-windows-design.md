# WASTE DISPOSED 三時間窗卡片設計文件

日期：2026-09-01

## 背景

「Today Waste Processed」區塊裡目前有一張「TODAY'S INPUT (weight1)」卡片，直接顯示 `selectedDeviceData.sensors.weight1` 這個即時快照值（裝置最新一筆 weight1 讀數，或今天沒有就 fallback 顯示昨天最新一筆）。這個顯示方式其實不是「今天輸入總量」，只是「最後一筆讀數」。

目標：把這張卡片拆成三張，改用「加總」語意，分別呈現三個時間窗的 weight1 累計投入量：
1. **WASTE DISPOSED (LAST 30 MINS)**：過去30分鐘所有 weight1 讀數加總
2. **WASTE DISPOSED (TODAY)**：今天所有 weight1 讀數加總
3. **WASTE DISPOSED (MONTH)**：本月1號至現在所有 weight1 讀數加總

## 範圍

**包含：**
- 移除舊的「TODAY'S INPUT (weight1)」卡片，新增上述三張卡片
- 新的資料抓取邏輯（沿用既有 `/data?type=history` API，不改後端）
- 對應的 i18n 翻譯 key（英/中）

**不包含：**
- 不改動 CURRENT BIOMASS、BIOMASS OUTPUT 這兩張既有卡片的邏輯
- 不新增自動定時刷新機制（維持現有「進入頁面/按 Refresh 才重新抓資料」的行為）
- 不改動後端 `timestreamProcessor` 或 `monitorreact4d35ba0f` 的任何程式碼

## 架構 / 資料流

沿用現有的 `fetchSensorHistory(sensorType, days)` helper（`MonitorDashboard.js:65-87`），呼叫既有的 `/data?type=history&sensorType=weight1&days=N&devID=X` API，一次抓取「本月1號到今天，再加1天緩衝」範圍內的所有 weight1 原始讀數，前端再依時間戳記分三段篩選、各自加總。**不新增後端端點，不改動後端程式碼**。

### 為什麼要多抓1天緩衝

若直接只抓「本月1號到今天」（`days = 今天是這個月第幾號`），會有一個午夜邊界問題：假設現在是某月1號凌晨00:10，「過去30分鐘」這個時間窗會跨到上個月最後一天，但當下的抓取範圍只涵蓋「這個月」，不包含上個月，導致這種情況下「過去30分鐘」漏抓資料。

解法：固定多抓1天（`days = 今天是這個月第幾號 + 1`），確保任何時刻「過去30分鐘」需要的資料都在抓取範圍內。這代表抓取範圍**必定會多含一天上個月的資料**，所以三個加總都要各自用明確的日期/時間條件去篩選，不能直接「加總全部抓到的資料」（即使是月加總也一樣要篩選「日期 ≥ 本月1號」，不能省略）。

### 為什麼不跟現有的 `weight1History`（固定7天，給 Carbon Performance/Daily Reduction Trend 用）共用一次抓取

本月最多可能到31天（超過現有 weight1History 固定抓7天的範圍），且兩者用途不同（一個是週減量趨勢分析、一個是月累計投入量）。為了保持每個功能各自獨立、互不影響、方便日後個別修改，這次新增一個**完全獨立**的 state 跟 `useEffect`，不去動、不去共用現有的 `weight1History`。

## 元件1：新增 state 與資料抓取

**Files:** `src/views/MonitorDashboard.js`

- 新增 state：`weight1MonthHistory`（陣列，存放原始讀數 `{sensorType, value, timestamp}`）、`loadingWasteWindows`（布林，抓取中旗標）
- 新增 `useEffect`（依賴 `selectedDevID`，跟現有的 `loadWeightSums`/`loadMainHistory` 平行、各自獨立）：
  ```js
  useEffect(() => {
    const loadWasteWindows = async () => {
      if (!selectedDevID) return;
      setLoadingWasteWindows(true);
      const now = new Date();
      const daysSinceMonthStart = now.getDate(); // 1~31
      const data = await fetchSensorHistory('weight1', (daysSinceMonthStart + 1).toString());
      setWeight1MonthHistory(data);
      setLoadingWasteWindows(false);
    };
    loadWasteWindows();
  }, [selectedDevID, fetchSensorHistory]);
  ```

## 元件2：三個加總計算（`useMemo`）

**Files:** `src/views/MonitorDashboard.js`

```js
const wasteDisposedWindows = useMemo(() => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const firstOfMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);

  let last30Min = 0;
  let today = 0;
  let month = 0;

  weight1MonthHistory.forEach(item => {
    const parsedValue = parseFloat(item.value || 0);
    if (!Number.isFinite(parsedValue)) return;
    if (!item.timestamp) return;
    const dateStr = item.timestamp.split('T')[0];

    if (dateStr >= firstOfMonthStr && dateStr <= todayStr) {
      month += parsedValue;
    }
    if (dateStr === todayStr) {
      today += parsedValue;
    }
    if (new Date(item.timestamp) >= thirtyMinAgo) {
      last30Min += parsedValue;
    }
  });

  return {
    last30Min: last30Min.toFixed(2),
    today: today.toFixed(2),
    month: month.toFixed(2),
  };
}, [weight1MonthHistory]);
```

- 沿用專案既有的資料清洗慣例（`Number.isFinite` 檢查，跳過非數字讀數，不讓 `NaN` 污染加總——這個慣例已經在 `reductionChartData`/`weightChartData` 用過）
- 無資料時三個值都是 `0`，`toFixed(2)` 後顯示 `0.00`

## 元件3：UI 卡片

**Files:** `src/views/MonitorDashboard.js`（取代原本的 TODAY'S INPUT 那張卡片）

三張新卡片跟 CURRENT BIOMASS、BIOMASS OUTPUT 一起放在同一個 `<Row>`，共5張卡片，都用 `lg="4" md="6"`（自動換行）：

| 卡片 | 圖示 | 顏色 class | 顯示值 |
|---|---|---|---|
| WASTE DISPOSED (LAST 30 MINS) | `icon-watch-time` | `icon-info` | `wasteDisposedWindows.last30Min` |
| WASTE DISPOSED (TODAY) | `icon-delivery-fast` | `icon-success` | `wasteDisposedWindows.today` |
| WASTE DISPOSED (MONTH) | `icon-calendar-60` | `icon-primary` | `wasteDisposedWindows.month` |

單位皆為 `kg`。載入中（`loadingWasteWindows` 為真）時不做個別的 loading 動畫，維持顯示目前的值直到新資料回來（沿用其餘卡片目前沒有個別 loading 狀態的慣例）；`loadingWasteWindows` state 仍然保留，之後若要加 loading UI 可以直接用。

## 元件4：i18n 翻譯

**Files:** `src/translations/index.js`

移除不再使用的 `todaysInput` key（僅這張卡片使用，確認無其他引用），新增：

| key | en | zh |
|---|---|---|
| `wasteLast30Min` | WASTE DISPOSED (LAST 30 MINS) | 過去30分鐘投入量 |
| `wasteToday` | WASTE DISPOSED (TODAY) | 今日投入量 |
| `wasteMonthTotal` | WASTE DISPOSED (MONTH) | 本月累計投入量 |

## 已知限制

**資料同步延遲，約30分鐘等級**：後端 `timestreamProcessor` 每30分鐘才把 Timestream 的原始資料同步進 DynamoDB 一次（`CloudWatchRule: rate(30 minutes)`，查詢視窗 `ago(40m)`）。這代表「WASTE DISPOSED (LAST 30 MINS)」卡片顯示的是「DynamoDB 裡目前已同步的資料」，而不是「裝置端真實發生的即時狀態」——最極端情況下，剛發生的丟棄動作要等下一次批次同步（最長約30分鐘）才會反映在這張卡片上。這是整個系統既有的資料延遲特性，不是這次新功能引入的問題，其餘卡片（CURRENT BIOMASS 等）本來就有同樣的延遲，只是「過去30分鐘」這個窗口對延遲特別敏感，值得使用者知悉。

**DynamoDB 30天 TTL**：如果哪個月分不小心超過30天沒有清資料（不會發生，因為月加總最多回溯31天，跟 TTL 30天很接近但通常夠用），理論上月初的資料有極小機率剛好在月底被 TTL 清掉。這是既有的資料保存限制（`DEPLOYMENT_GUIDE.md` 已記錄），不在本次功能修改範圍內處理。

## 測試計畫

- 選擇一台有 weight1 歷史資料的裝置，確認三張卡片都能正確顯示數字（非 `NaN`、非空白）
- 確認「過去30分鐘」數字 ≤「今天」數字 ≤「本月」數字（邏輯上後者應該包含前者，除非剛好跨月/跨日邊界）
- 手動測試無資料裝置（或新裝置剛加入、還沒有 weight1 歷史）時三張卡片都顯示 `0.00`，不是 `NaN` 或空白
- 確認切換裝置時三張卡片會重新抓取、重新計算
- 確認移除 `todaysInput` 翻譯 key 後，專案裡沒有殘留引用（grep 確認）
