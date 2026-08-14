# GPS 座標顯示功能設計文件

日期：2026-08-14

## 背景

裝置會把 GPS 座標以 `"lat,lng"` 字串格式（例如 `"22.37065,114.11797"`）寫入 Timestream 的 `GPS` measure。`amplify/backend/function/timestreamProcessor/src/index.py` 已在 2026-08-05 的 commit 把 `GPS` 加進 `MAINTENANCE_SENSORS`，但實際上 GPS 資料從未出現在 DynamoDB `SensorDataCache` 快取表中。

根本原因：`timestreamProcessor` 的查詢固定用 `TRY_CAST("measure_value::varchar" AS DOUBLE) as val` 把所有感測器值轉成 DOUBLE，而 `"22.37065,114.11797"` 含逗號，無法轉成合法的 DOUBLE，`TRY_CAST` 會回傳 `NULL`。寫入迴圈中 `if 'measure_name' in row and row.get('val') is not None:` 這個判斷會把值為 `NULL` 的 GPS 資料列直接跳過、不寫入 DynamoDB，過程不會報錯，導致「加了 GPS 卻在 DB 上看不到」。

目標：修復 GPS 資料的擷取與儲存，並在前端顯示裝置的最新 GPS 座標（以可點擊的 Google Maps 連結呈現）。

## 範圍

**包含：**
- 修復 `timestreamProcessor` 對非數值型感測器值（目前僅 GPS）的擷取與儲存邏輯
- 新增前端「GPS Location」獨立卡片，顯示最新座標的 Google Maps 連結
- 新增對應的 i18n 翻譯 key

**不包含：**
- GPS 歷史移動軌跡／地圖上畫路徑（使用者確認只需要最新位置）
- 調整 GPS 的擷取頻率（維持現有 `MAINTENANCE_SENSORS` 每小時一次的既有邏輯，使用者確認目前頻率已足夠此用途）
- 座標格式驗證／容錯解析（超出「顯示連結」這個需求範圍）
- `amplify/backend/function/monitorreact4d35ba0f`（`/data` API）程式碼改動 — 已確認此函式是通用透傳邏輯，GPS 資料一旦進了 DynamoDB 會自動被回傳，不需修改

## 架構 / 資料流

```
裝置韌體
  → Timestream (measure_name='GPS', measure_value::varchar='22.37065,114.11797')
    → timestreamProcessor Lambda（每30分鐘排程，GPS 屬於 MAINTENANCE_SENSORS，約每小時抓一次）
      → DynamoDB SensorDataCache（value 存為 String，而非 Decimal）
        → monitorreact4d35ba0f `/data` API（handle_latest，原樣透傳，無需改動）
          → 前端 fetchData() → devices[].sensors.GPS
            → 新增的「GPS Location」卡片，渲染 Google Maps 連結
```

## 元件1：`amplify/backend/function/timestreamProcessor/src/index.py`

這是唯一需要修改核心邏輯的地方。

- **SQL 查詢**：把

  ```sql
  TRY_CAST("measure_value::varchar" AS DOUBLE) as val
  ```

  改成直接取原始字串：

  ```sql
  "measure_value::varchar" as val_str
  ```

- **寫入判斷與型別轉換**：在 `for row in raw_results:` 迴圈中，原本的

  ```python
  if 'measure_name' in row and row.get('val') is not None:
      ...
      'value': float_to_decimal(row['val']),
  ```

  改為：

  ```python
  val_str = row.get('val_str')
  if 'measure_name' in row and val_str is not None:
      ...
      try:
          stored_value = float_to_decimal(float(val_str))
      except (TypeError, ValueError):
          stored_value = val_str  # 無法轉數字的值（如 GPS "lat,lng"）直接存原始字串
      ...
      'value': stored_value,
  ```

- 其餘寫入邏輯（partition key、TTL、`updated_at` 等）不變。
- **不改動** `MAINTENANCE_SENSORS` 的抓取頻率條件（`if now.minute < 30`）。
- DynamoDB 對同一個屬性本來就允許不同型別的值（String 或 Number），所以這個改動不需要調整資料表結構（schema-less）。

## 元件2：`amplify/backend/function/monitorreact4d35ba0f/src/index.py`

**確認不需要任何程式碼改動。**

- `handle_latest` 與 `handle_history` 都是通用讀取 DynamoDB 並原樣回傳，沒有針對 sensorType 的白名單過濾（`SENSOR_TYPES` 常數目前未被實際使用）。
- `DecimalEncoder` 只處理 `Decimal` 型別，字串值會被 `json.dumps` 直接序列化，不受影響。
- 因此 GPS 一旦被元件1 正確寫入 DynamoDB，這支 API 會自動在 `/data?type=latest` 的回應中包含 `{"sensorType": "GPS", "value": "22.37065,114.11797", ...}`，無需修改。

## 元件3：前端 `src/views/MonitorDashboard.js` + `src/translations/index.js`

- `devices` 的 `useMemo`（第220~244行）已經是通用映射：`devicesMap[devID].sensors[sensorType] = value`，GPS 資料會自動出現在 `selectedDeviceData.sensors.GPS`，不需修改這段。
- 仿照現有 Temperature / Humidity / CO2&NH3 卡片的樣式（約第415~490行），新增一張獨立的「GPS Location」`card-stats` 卡片：
  - 若 `selectedDeviceData.sensors.GPS` 存在：顯示為可點擊連結，`href` 為 `` `https://www.google.com/maps?q=${gps}` ``，`target="_blank"` `rel="noopener noreferrer"`，連結文字顯示原始座標字串。
  - 若不存在：顯示 `--`，與其他感測器卡片的 fallback 行為一致。
- 在 `src/translations/index.js` 對應語言區塊新增卡片標題等翻譯 key（例如 `gpsLocation`），比照現有 key 的命名與分組風格。
- 不需要新增 state 或額外的 API 呼叫，GPS 資料已包含在既有的 `fetchData()`（`type=latest`）回應中，跟 Temperature 等即時感測器共用同一次抓取。

## 錯誤處理

- GPS 字串格式異常（缺逗號、多餘空白等）：連結仍會產生，只是可能連到錯誤或無效的地圖位置；不加額外的格式驗證或解析，因為需求範圍只是「顯示連結」。
- GPS 尚未被 `timestreamProcessor` 抓到時（例如剛部署完還沒到下一次排程週期）：卡片顯示 `--`，不會出現前端錯誤。
- `timestreamProcessor` 對其他既有數值型感測器（weight1、weight2、Temperature 等）的行為完全不變，因為它們的 `val_str` 都能成功 `float()` 轉換，走的還是原本的 `float_to_decimal` 路徑。

## 測試計畫

- **後端**：`amplify push` 部署後，等下一次 `now.minute < 30` 的排程執行，於 CloudWatch Logs 確認無錯誤、於 DynamoDB Console 確認出現 `timestamp_sk` 為 `SENSOR#GPS#TS#...` 的項目，且 `value` 屬性型別為 String、內容為 `"22.37065,114.11797"` 格式。
- 確認 `/data?type=latest` API 回應中包含該筆 GPS 資料。
- 確認既有數值型感測器（weight1、weight2、Temperature、Humidity、CO2、NH3、rssi 等）行為不受影響，DynamoDB 中的值仍為 Number 型別。
- **前端**：確認新卡片正確顯示座標文字、點擊連結能在新分頁開啟 Google Maps 並定位到正確座標；確認 GPS 資料尚未到位時卡片顯示 `--` 而非報錯。
