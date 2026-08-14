# GPS 座標顯示功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修復 `timestreamProcessor` 讓 GPS 這種非數值型（`"lat,lng"` 字串）感測器值能正確寫入 DynamoDB，並在前端新增一張顯示裝置最新 GPS 座標（可點擊 Google Maps 連結）的卡片。

**Architecture:** `timestreamProcessor` 目前用 `TRY_CAST(... AS DOUBLE)` 把所有感測器值強制轉成數字，GPS 的 `"22.37065,114.11797"` 因含逗號轉換失敗變 `NULL` 而被靜默丟棄。改為取得原始字串，並用一個獨立、無 AWS 依賴的純函式 `parse_sensor_value` 判斷能否轉數字：能轉存 `Decimal`（維持現有數值感測器行為不變），不能轉則存原始字串。前端 `monitorreact4d35ba0f` API 本身是通用透傳，不用改；`MonitorDashboard.js` 只需新增一張跟 Temperature/Humidity/CO2 同排的 stats 卡片讀取 `selectedDeviceData.sensors.GPS`。

**Tech Stack:** Python 3.11（AWS Lambda, boto3），React 18 / reactstrap（前端）。

## Global Constraints

- 部署方式為 Amplify Gen1；本計畫**不包含**任何 `amplify push` 或實際部署動作，程式改完由使用者自行部署。
- **不修改** `amplify/backend/function/monitorreact4d35ba0f`（已確認為通用透傳邏輯，GPS 資料進了 DynamoDB 就會自動被回傳）。
- **不調整** GPS 的擷取頻率／時間窗（維持 `timestreamProcessor` 現有 `MAINTENANCE_SENSORS` 每小時一次的邏輯）。
- **不做**歷史 GPS 軌跡顯示，只顯示最新位置。
- **不做**座標格式驗證或解析容錯，非數值字串一律原樣存入/顯示。
- GPS 連結格式固定為 `https://www.google.com/maps?q=<GPS值>`，並以 `target="_blank" rel="noopener noreferrer"` 開新分頁。
- 新卡片樣式需比照現有 `card-stats` 卡片（Temperature/Humidity/CO2），放在同一排（`ENVIRONMENTAL SENSORS` 區塊）。
- i18n 只需要 `en` 與 `zh` 兩個語言，比照 `src/translations/index.js` 現有 key 命名風格（camelCase）。

---

### Task 1: 抽出並測試感測器數值解析邏輯（value_parsing.py）

**Files:**
- Create: `amplify/backend/function/timestreamProcessor/src/value_parsing.py`
- Create: `amplify/backend/function/timestreamProcessor/src/test_value_parsing.py`

**Interfaces:**
- Produces: `parse_sensor_value(val_str: str | None) -> Decimal | str | None`
  - `val_str is None` → 回傳 `None`
  - `val_str` 能被 `float()` 轉換（如 `"23.5"`, `"42"`）→ 回傳 `Decimal`
  - `val_str` 不能被 `float()` 轉換（如 `"22.37065,114.11797"`）→ 原樣回傳該字串
- Produces: `float_to_decimal(value) -> Decimal | None`（從 `index.py` 搬移過來，簽名與行為完全不變）

這個模組刻意不 import `boto3`，讓它可以在本機不裝 boto3 的情況下直接用標準 `unittest` 測試。

- [ ] **Step 1: 寫失敗的測試**

建立 `amplify/backend/function/timestreamProcessor/src/test_value_parsing.py`：

```python
import unittest
from decimal import Decimal

from value_parsing import parse_sensor_value


class TestParseSensorValue(unittest.TestCase):
    def test_numeric_string_becomes_decimal(self):
        result = parse_sensor_value("23.5")
        self.assertEqual(result, Decimal("23.5"))

    def test_integer_string_becomes_decimal(self):
        result = parse_sensor_value("42")
        self.assertEqual(result, Decimal("42"))

    def test_gps_coordinate_string_is_kept_as_is(self):
        result = parse_sensor_value("22.37065,114.11797")
        self.assertEqual(result, "22.37065,114.11797")

    def test_none_returns_none(self):
        self.assertIsNone(parse_sensor_value(None))


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: 執行測試，確認失敗**

Run:
```bash
cd amplify/backend/function/timestreamProcessor/src && python3 -m unittest test_value_parsing.py -v
```
Expected: `ModuleNotFoundError: No module named 'value_parsing'`（因為這個檔案還不存在）

- [ ] **Step 3: 建立 value_parsing.py 實作**

建立 `amplify/backend/function/timestreamProcessor/src/value_parsing.py`：

```python
from decimal import Decimal


def float_to_decimal(value):
    """Converts numeric values to Decimal for DynamoDB storage."""
    if value is None:
        return None
    try:
        # Convert through string to avoid float precision issues
        return Decimal(str(value))
    except:
        return value


def parse_sensor_value(val_str):
    """Converts a raw Timestream varchar value into the type used for
    DynamoDB storage. Numeric values become Decimal; non-numeric values
    (e.g. GPS "lat,lng" strings) are kept as-is.
    """
    if val_str is None:
        return None
    try:
        return float_to_decimal(float(val_str))
    except (TypeError, ValueError):
        return val_str
```

- [ ] **Step 4: 執行測試，確認通過**

Run:
```bash
cd amplify/backend/function/timestreamProcessor/src && python3 -m unittest test_value_parsing.py -v
```
Expected: 4 個測試全部 `ok`

- [ ] **Step 5: Commit**

```bash
git add amplify/backend/function/timestreamProcessor/src/value_parsing.py amplify/backend/function/timestreamProcessor/src/test_value_parsing.py
git commit -m "feat(timestreamProcessor): add testable sensor value parser for non-numeric values"
```

---

### Task 2: 讓 timestreamProcessor 改用原始字串查詢與新的解析函式

**Files:**
- Modify: `amplify/backend/function/timestreamProcessor/src/index.py:1-136`

**Interfaces:**
- Consumes: `parse_sensor_value(val_str)` from Task 1 (`value_parsing.py`)
- Produces: `handler(event, context)` 對外行為不變（回傳格式、DynamoDB item 結構都不變），只有 `value` 屬性在遇到非數值感測器時會存字串而非 `Decimal`

現況（`index.py` 目前內容）：

```python
import boto3
import json
import os
import time
from datetime import datetime, timezone
from collections import defaultdict
from decimal import Decimal
```

改成移除不再需要的 `Decimal` import，改 import `parse_sensor_value`：

- [ ] **Step 1: 修改檔案開頭 import**

把：
```python
import boto3
import json
import os
import time
from datetime import datetime, timezone
from collections import defaultdict
from decimal import Decimal
```
改成：
```python
import boto3
import json
import os
import time
from datetime import datetime, timezone
from collections import defaultdict

from value_parsing import parse_sensor_value
```

- [ ] **Step 2: 修改 SQL 查詢，改抓原始字串**

把（約第46~54行）：
```python
        raw_query = f"""
            SELECT devID, measure_name, 
                   TRY_CAST("measure_value::varchar" AS DOUBLE) as val, 
                   time
            FROM "{TIMESTREAM_DB}"."{TIMESTREAM_TABLE}"
            WHERE time > ago(40m)
            AND measure_name IN ({sensor_list_str})
            ORDER BY time DESC
        """
```
改成：
```python
        raw_query = f"""
            SELECT devID, measure_name, 
                   "measure_value::varchar" as val_str, 
                   time
            FROM "{TIMESTREAM_DB}"."{TIMESTREAM_TABLE}"
            WHERE time > ago(40m)
            AND measure_name IN ({sensor_list_str})
            ORDER BY time DESC
        """
```

- [ ] **Step 3: 修改寫入判斷與 value 欄位**

把（約第61~83行）：
```python
        with table.batch_writer() as batch:
            for row in raw_results:
                if 'measure_name' in row and row.get('val') is not None:
                    # Parse timestamp to get date for partitioning
                    ts_str = row['time'] # e.g. "2026-05-20 10:30:00.000000000"
                    dt_obj = datetime.strptime(ts_str.split('.')[0], '%Y-%m-%d %H:%M:%S').replace(tzinfo=timezone.utc)
                    date_str = dt_obj.strftime('%Y-%m-%d')
                    
                    # New Logical Partitioning:
                    # PK: DEVICE#<devID>#DATE#<YYYY-MM-DD>
                    # SK: SENSOR#<sensorType>#TS#<ISO_Timestamp>
                    batch.put_item(Item={
                        'cache_key': f"DEVICE#{row['devID']}#DATE#{date_str}", # Partition Key
                        'timestamp_sk': f"SENSOR#{row['measure_name']}#TS#{dt_obj.isoformat()}", # Sort Key
                        'date': date_str, # 用於 GSI 優化查詢
                        'devID': row['devID'],
                        'sensorType': row['measure_name'],
                        'value': float_to_decimal(row['val']),
                        'timestamp': dt_obj.isoformat(),
                        'type': 'RAW_DATA',
                        'updated_at': now.isoformat(),
                        'expire_at': expire_at # TTL field for auto-deletion
                    })
```
改成：
```python
        with table.batch_writer() as batch:
            for row in raw_results:
                if 'measure_name' in row and row.get('val_str') is not None:
                    # Parse timestamp to get date for partitioning
                    ts_str = row['time'] # e.g. "2026-05-20 10:30:00.000000000"
                    dt_obj = datetime.strptime(ts_str.split('.')[0], '%Y-%m-%d %H:%M:%S').replace(tzinfo=timezone.utc)
                    date_str = dt_obj.strftime('%Y-%m-%d')
                    
                    # New Logical Partitioning:
                    # PK: DEVICE#<devID>#DATE#<YYYY-MM-DD>
                    # SK: SENSOR#<sensorType>#TS#<ISO_Timestamp>
                    batch.put_item(Item={
                        'cache_key': f"DEVICE#{row['devID']}#DATE#{date_str}", # Partition Key
                        'timestamp_sk': f"SENSOR#{row['measure_name']}#TS#{dt_obj.isoformat()}", # Sort Key
                        'date': date_str, # 用於 GSI 優化查詢
                        'devID': row['devID'],
                        'sensorType': row['measure_name'],
                        'value': parse_sensor_value(row['val_str']),
                        'timestamp': dt_obj.isoformat(),
                        'type': 'RAW_DATA',
                        'updated_at': now.isoformat(),
                        'expire_at': expire_at # TTL field for auto-deletion
                    })
```

- [ ] **Step 4: 移除檔案底部已搬移的 `float_to_decimal` 函式**

刪掉檔案最後的：
```python
def float_to_decimal(value):
    """Converts numeric values to Decimal for DynamoDB storage."""
    if value is None:
        return None
    try:
        # Convert through string to avoid float precision issues
        return Decimal(str(value))
    except:
        return value
```
（邏輯已搬到 Task 1 的 `value_parsing.py`，這裡改用 import 進來的版本）

- [ ] **Step 5: 語法檢查（本機沒裝 boto3，無法完整執行 handler，用 py_compile 做語法層級的 smoke test）**

Run:
```bash
python3 -m py_compile amplify/backend/function/timestreamProcessor/src/index.py
```
Expected: 無輸出、exit code 0（代表語法正確；`py_compile` 只編譯不執行，所以即使本機沒裝 `boto3` 也能跑通這個檢查）

- [ ] **Step 6: 確認 Task 1 的單元測試仍然通過（回歸檢查）**

Run:
```bash
cd amplify/backend/function/timestreamProcessor/src && python3 -m unittest test_value_parsing.py -v
```
Expected: 4 個測試全部 `ok`

- [ ] **Step 7: Commit**

```bash
git add amplify/backend/function/timestreamProcessor/src/index.py
git commit -m "fix(timestreamProcessor): stop dropping non-numeric sensor values (GPS) via raw varchar query"
```

> **部署備註（非本計畫任務，僅供之後參考）：** 這兩個 task 完成後，程式碼變更需要使用者自行執行 `amplify push` 部署，並等下一次 `now.minute < 30` 的排程執行後，才能在 DynamoDB 看到 `SENSOR#GPS#...` 項目。這屬於部署動作，不在此實作計畫範圍內。

---

### Task 3: 前端新增 GPS Location 卡片

**Files:**
- Modify: `src/translations/index.js:24-52`（`en.monitorDashboard`）與 `:84-112`（`zh.monitorDashboard`）
- Modify: `src/views/MonitorDashboard.js:457-486`（ENVIRONMENTAL SENSORS 那排 stats 卡片）

**Interfaces:**
- Consumes: `t('monitorDashboard.gpsLocation')`（沿用既有 `useLanguage()` 的 `t()` 函式，來自 `src/contexts/LanguageContext`）
- Consumes: `selectedDeviceData.sensors.GPS`（既有的 `devices` useMemo 已通用映射所有 sensorType，不需改動）
- 無其他任務依賴這個 task 的輸出（純前端顯示，UI 端點）

此專案沒有既有的前端自動化測試（無 `*.test.js`），所以這個 task 用「啟動 dev server 手動驗證」取代自動化測試，符合專案現況。

- [ ] **Step 1: 在 `src/translations/index.js` 的 `en.monitorDashboard` 新增 key**

在第27行 `co2Nh3Level: "CO2 / NH3 LEVEL",` 之後新增：
```js
      co2Nh3Level: "CO2 / NH3 LEVEL",
      gpsLocation: "GPS LOCATION",
```

- [ ] **Step 2: 在 `zh.monitorDashboard` 新增對應翻譯**

在第87行 `co2Nh3Level: "CO2 / NH3 濃度",` 之後新增：
```js
      co2Nh3Level: "CO2 / NH3 濃度",
      gpsLocation: "GPS 位置",
```

- [ ] **Step 3: 在 MonitorDashboard.js 的 ENVIRONMENTAL SENSORS 卡片排新增 GPS 卡片**

在 `src/views/MonitorDashboard.js` 第457~485行的 CO2 & NH3 卡片 `</Col>` 之後、Row 的 `</Row>`（第486行）之前，插入：

```jsx
            {/* GPS LOCATION */}
            <Col lg="4" md="6">
              <Card className="card-stats">
                <CardBody>
                  <Row>
                    <Col xs="4">
                      <div className="info-icon text-center icon-info">
                        <i className="tim-icons icon-square-pin" />
                      </div>
                    </Col>
                    <Col xs="8">
                      <div className="numbers">
                        <p className="card-category">{t('monitorDashboard.gpsLocation')}</p>
                        <CardTitle tag="h3" style={{ fontSize: "1.1rem" }}>
                          {selectedDeviceData.sensors.GPS ? (
                            <a
                              href={`https://www.google.com/maps?q=${selectedDeviceData.sensors.GPS}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {selectedDeviceData.sensors.GPS}
                            </a>
                          ) : (
                            "--"
                          )}
                        </CardTitle>
                      </div>
                    </Col>
                  </Row>
                </CardBody>
              </Card>
            </Col>
```

- [ ] **Step 4: 啟動 dev server 手動驗證**

Run:
```bash
npm start
```
在瀏覽器打開 dashboard，選擇一個裝置：
- 若該裝置目前 DynamoDB 裡還沒有 `GPS` 感測器資料（Task 1/2 部署前的正常狀態），確認新卡片顯示 `GPS LOCATION` 標題與 `--`，沒有噴錯、版面沒有跑掉。
- 若已經有 GPS 資料，確認顯示的座標文字可點擊，點下去會在新分頁開啟 Google Maps 並定位到該座標。
- 切換語言（英文／中文）確認卡片標題正確跟著切換。

- [ ] **Step 5: Commit**

```bash
git add src/translations/index.js src/views/MonitorDashboard.js
git commit -m "feat(dashboard): add GPS Location card linking to Google Maps"
```
