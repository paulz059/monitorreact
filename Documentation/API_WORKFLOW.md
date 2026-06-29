# 監控系統 API 工作流程 (Monitor API Workflows) - 性能優化與 TTL 版

本文檔說明了系統在經過**並行查詢優化**及實施 **TTL 自動清理**後的後端工作流程。

## 1. 數據同步與自動清理 (`timestreamProcessor`)

此函數負責將 AWS Timestream 的原始數據同步到 DynamoDB，並設定自動過期機制。

### 工作流程：
1.  **觸發方式**：每 30 分鐘自動執行一次。
2.  **數據拉取**：從 Timestream 抓取過去 40 分鐘內感測器的原始數據點。
3.  **存儲與 TTL (DynamoDB - SensorDataCache)**：
    *   **分區鍵 (PK)**：`DEVICE#<devID>#DATE#<YYYY-MM-DD>`。
    *   **排序鍵 (SK)**：`SENSOR#<sensorType>#TS#<ISO時間戳>`。
    *   **自動清理 (TTL)**：每筆紀錄包含 `expire_at` 欄位（Unix 時間戳），設定為 **7 天後自動刪除**，以維持資料表性能並節省儲存成本。

---

## 2. 前端數據接口 (`monitorApi` / `monitorreact4d35ba0f`)

此 API 經過深度優化，支持並行處理與精準過濾，顯著降低了查詢延遲。

### 端點：`GET /` (API Gateway)

#### A. 獲取即時數據 (Latest) - [高性能版]
*   **參數**：`?type=latest`
*   **性能優化**：
    *   **並行執行**：利用 Python 多執行緒 (`ThreadPoolExecutor`) 同時查詢多台設備。
    *   **合併查詢**：每個設備僅執行 **1 次** 批量查詢獲取所有感測器值，取代舊版的 12 次重複查詢。
    *   **小時截斷**：設備搜尋採用小時級截斷（Hourly Truncated），解決毫秒不匹配導致設備消失的問題。
*   **用途**：秒級獲取所有在線設備的最新感測器狀態。
*   **回傳格式**：包含 `LATEST` 列表及按 `devID` 分組的字典結構，提高前端兼容性。

#### B. 獲取歷史原始數據 (History) - [精準過濾版]
*   **參數**：`?type=history&days=7&devID=BBox01&sensorType=weight1`
*   **性能優化**：
    *   **服務端過濾**：直接在 DynamoDB 查詢層級過濾 `sensorType`，減少 90% 無效數據傳輸。
    *   **欄位精簡**：僅回傳 `sensorType`, `value`, `timestamp` 關鍵欄位，大幅壓縮 JSON 體積。
*   **用途**：獲取特定設備過去 N 天的特定感測器數據趨勢。

---

## 技術架構總結

*   **資料庫結構**：採用「單表設計 (Single Table Design)」，利用分區與 TTL 解決了長期的性能與成本問題。
*   **並行性能**：透過並行化處理與查詢合併，API 響應時間從平均 8 秒優化至 1-2 秒。
*   **數據完整性**：無視毫秒精度的差異，確保如 `0002` 等特殊設備在任何時間點都能穩定顯示。
*   **智能前端**：前端 React 具備感測器自動識別邏輯，能根據設備擁有的感測器自動切換顯示內容。

