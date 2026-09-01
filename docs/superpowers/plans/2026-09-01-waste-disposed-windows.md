# WASTE DISPOSED 三時間窗卡片 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把「Today Waste Processed」區塊裡的「TODAY'S INPUT (weight1)」卡片拆成三張時間窗卡片（過去30分鐘／今天／本月累計投入量），三者都是 weight1 原始讀數的加總，取代原本「只顯示最新一筆讀數」的行為。

**Architecture:** 沿用既有 `fetchSensorHistory(sensorType, days)` helper 呼叫既有的 `/data?type=history` API（不改後端），一次抓取「本月1號到今天再加1天緩衝」範圍內的 weight1 原始讀數，前端用一個 `useMemo` 依時間戳記分三段篩選、各自加總。CURRENT BIOMASS、BIOMASS OUTPUT 兩張卡片維持完全不變，只是跟新的三張卡片一起放進同一排（5張卡片自動換行）。

**Tech Stack:** React（`useState`/`useEffect`/`useMemo`），Reactstrap，沿用專案既有的 `LanguageContext` i18n 機制。

## Global Constraints

- **不改後端**：不修改 `timestreamProcessor` 或 `monitorreact4d35ba0f` 任何程式碼，完全沿用既有的 `/data?type=history&sensorType=weight1&days=N&devID=X` API。
- **不新增自動定時刷新**：三張新卡片跟現有卡片一樣，只在「進入頁面／選裝置／按 Refresh」時重新抓取，不加 `setInterval` 之類的定時器。
- **CURRENT BIOMASS、BIOMASS OUTPUT 兩張卡片邏輯與外觀完全不動**，只調整它們在排版中的相對位置（跟新卡片放進同一個 Row）。
- **抓取天數公式固定為 `本月第幾號 + 1`**（例如今天是9月15號，抓 `days=16`），多抓的1天是為了避免月初凌晨「過去30分鐘」跨月漏抓資料的邊界問題（詳見設計文件的「已知限制」章節）。
- **三個加總都要用日期字串明確篩選**，不能假設「抓到的全部資料 = 本月資料」（因為抓取範圍固定比本月多1天，那1天屬於上個月）。
- **非數字/非有限值的讀數要被排除**，不能讓 `NaN` 污染加總（用 `Number.isFinite` 檢查，沿用專案裡 `reductionChartData`/`weightChartData` 已經用過的慣例）。
- **無資料時三個值都顯示 `0.00`**（不是 `--`），比照 `totalReduction7Days` 無資料時的 fallback 慣例。
- **此專案沒有前端自動化測試套件**（`npm test` 會回報 "No tests found"），驗證方式統一為：`npx eslint`、Python 一行指令做大括號/小括號配對檢查、啟動 dev server 確認編譯成功＋列出人工瀏覽器檢查清單。
- **圖示與顏色**：過去30分鐘用 `icon-watch-time` + `icon-info`，今天用 `icon-delivery-fast` + `icon-success`，本月用 `icon-calendar-60` + `icon-primary`。

---

### Task 1: 新增／移除 i18n 翻譯 key

**Files:**
- Modify: `src/translations/index.js:21-23`（en 區塊）
- Modify: `src/translations/index.js:93-95`（zh 區塊，實際行號在 Task 開始執行前用 `grep -n "todaysInput"` 確認，可能因為 Task 前的檔案狀態有微小差異而偏移）

**Interfaces:**
- Produces：三個新翻譯 key，供 Task 2 的 JSX 呼叫：`t('monitorDashboard.wasteLast30Min')`、`t('monitorDashboard.wasteToday')`、`t('monitorDashboard.wasteMonthTotal')`（en/zh 都要有）
- 移除 `todaysInput` key。Task 1 完成後、Task 2 開始前，畫面上「TODAY'S INPUT (weight1)」那張卡片（還沒被 Task 2 替換掉）會暫時顯示字面上的 key 路徑文字而不是英文/中文，這是**預期中的過渡狀態**，Task 2 完成後就會恢復正常，不需要在 Task 1 特別處理。

現況（`src/translations/index.js` 第13~24行，en 區塊節錄）：
```js
    monitorDashboard: {
      title: "B-BOX DASH Dashboard",
      lastUpdate: "Last Update",
      selectDevice: "Select Device (devID)",
      chooseDevice: "-- Choose a Device --",
      lastSeen: "Last Seen",
      errorLoad: "Failed to load latest data. Please check your connection.",
      carbonPerformance: "CARBON PERFORMANCE",
      wasteProcessed: "Today Waste Processed",
      todaysInput: "TODAY'S INPUT (weight1)",
      currentBiomass: "CURRENT BIOMASS (weight2)",
      biomassOutput: "BIOMASS OUTPUT",
```

現況（`src/translations/index.js` 第85~96行，zh 區塊節錄）：
```js
    monitorDashboard: {
      title: "B-BOX DASH 監控平台",
      lastUpdate: "最後更新",
      selectDevice: "選擇設備 (devID)",
      chooseDevice: "-- 請選擇設備 --",
      lastSeen: "最後偵測時間",
      errorLoad: "無法載入最新資料，請檢查網路連線。",
      carbonPerformance: "碳表現指標",
      wasteProcessed: "今日已處理廢棄物",
      todaysInput: "今日投入量 (weight1)",
      currentBiomass: "生物質表現 (weight2)",
      biomassOutput: "已轉化有機質",
```

- [ ] **Step 1: 修改 en 區塊，移除 `todaysInput`、新增三個新 key**

把：
```js
      wasteProcessed: "Today Waste Processed",
      todaysInput: "TODAY'S INPUT (weight1)",
      currentBiomass: "CURRENT BIOMASS (weight2)",
```
改成：
```js
      wasteProcessed: "Today Waste Processed",
      wasteLast30Min: "WASTE DISPOSED (LAST 30 MINS)",
      wasteToday: "WASTE DISPOSED (TODAY)",
      wasteMonthTotal: "WASTE DISPOSED (MONTH)",
      currentBiomass: "CURRENT BIOMASS (weight2)",
```

- [ ] **Step 2: 修改 zh 區塊，移除 `todaysInput`、新增三個新 key**

把：
```js
      wasteProcessed: "今日已處理廢棄物",
      todaysInput: "今日投入量 (weight1)",
      currentBiomass: "生物質表現 (weight2)",
```
改成：
```js
      wasteProcessed: "今日已處理廢棄物",
      wasteLast30Min: "過去30分鐘投入量",
      wasteToday: "今日投入量",
      wasteMonthTotal: "本月累計投入量",
      currentBiomass: "生物質表現 (weight2)",
```

- [ ] **Step 3: 驗證 key 正確移除/新增**

Run:
```bash
grep -c "todaysInput" src/translations/index.js
```
Expected: `0`（完全移除，注意這個指令的結果只代表 `translations/index.js` 這個檔案本身乾淨，`MonitorDashboard.js` 仍會在 Task 2 之前殘留引用，屬於預期中的過渡狀態）

```bash
grep -c "wasteLast30Min\|wasteToday\|wasteMonthTotal" src/translations/index.js
```
Expected: `6`（三個 key，各出現在 en/zh 兩個區塊，3×2=6）

- [ ] **Step 4: ESLint 檢查**

Run:
```bash
npx eslint src/translations/index.js
```
Expected: 無錯誤、無警告輸出（除了 npm 本身的 config 警告，那些跟這次改動無關，可忽略）

- [ ] **Step 5: Commit**

```bash
git add src/translations/index.js
git commit -m "feat(i18n): replace todaysInput key with wasteLast30Min/wasteToday/wasteMonthTotal"
```

---

### Task 2: 資料抓取、加總計算、UI 卡片

**Files:**
- Modify: `src/views/MonitorDashboard.js:37`（新增 state）
- Modify: `src/views/MonitorDashboard.js:101-114`（新增 useEffect，緊接在現有的「今日與週加總資料抓取」useEffect 後面）
- Modify: `src/views/MonitorDashboard.js:269-272`（新增 `wasteDisposedWindows` useMemo，緊接在 `biomassOutput` useMemo 後面）
- Modify: `src/views/MonitorDashboard.js:436-515`（把 TODAY'S INPUT 卡片換成三張新卡片，CURRENT BIOMASS／BIOMASS OUTPUT 兩張卡片原樣保留、放進同一個 Row）

**Interfaces:**
- Consumes：Task 1 產生的三個翻譯 key `t('monitorDashboard.wasteLast30Min')`、`t('monitorDashboard.wasteToday')`、`t('monitorDashboard.wasteMonthTotal')`；既有的 `fetchSensorHistory(sensorType, limitDays)` helper（`MonitorDashboard.js:65-87`，回傳 `Promise<Array<{sensorType, value, timestamp}>>`）；既有的 `selectedDevID` state
- Produces：`wasteDisposedWindows` 物件 `{ last30Min: string, today: string, month: string }`（都是 `toFixed(2)` 過的字串），本任務內部自己消費，不影響其他任務
- 注意：`latestWeight1`（`MonitorDashboard.js:266`）**不要刪除**，它在 CARBON PERFORMANCE 區塊的 LATEST REDUCTION 卡片仍然被使用（`const w1 = parseFloat(latestWeight1 || 0);`），這次只是移除它在 TODAY'S INPUT 卡片裡的使用，宣告本身保留

現況（`src/views/MonitorDashboard.js` 第36~39行）：
```js
  const [selectedDevID, setSelectedDevID] = useState("");
  const [weightTrendDays, setWeightTrendDays] = useState("7");

  const fetchData = useCallback(async () => {
```

- [ ] **Step 1: 新增兩個 state**

把：
```js
  const [selectedDevID, setSelectedDevID] = useState("");
  const [weightTrendDays, setWeightTrendDays] = useState("7");

  const fetchData = useCallback(async () => {
```
改成：
```js
  const [selectedDevID, setSelectedDevID] = useState("");
  const [weightTrendDays, setWeightTrendDays] = useState("7");
  const [weight1MonthHistory, setWeight1MonthHistory] = useState([]);
  const [loadingWasteWindows, setLoadingWasteWindows] = useState(false);

  const fetchData = useCallback(async () => {
```

現況（`src/views/MonitorDashboard.js` 第101~116行）：
```js
  // 今日與週加總資料抓取 (weight1 & weight2)
  useEffect(() => {
    const loadWeightSums = async () => {
      if (!selectedDevID) return;
      // 改為抓取 7 天以支援週圖表
      const [w1, w2] = await Promise.all([
        fetchSensorHistory('weight1', '7'),
        fetchSensorHistory('weight2', '7')
      ]);
      setWeight1History(w1);
      setWeight2History(w2);
    };
    loadWeightSums();
  }, [selectedDevID, fetchSensorHistory]);

  // Weight parameters are now retrieved from the latest device sensor reading directly
```

- [ ] **Step 2: 新增 WASTE DISPOSED 三時間窗資料抓取的 useEffect**

把：
```js
    loadWeightSums();
  }, [selectedDevID, fetchSensorHistory]);

  // Weight parameters are now retrieved from the latest device sensor reading directly
```
改成：
```js
    loadWeightSums();
  }, [selectedDevID, fetchSensorHistory]);

  // WASTE DISPOSED 三時間窗資料抓取 (weight1，本月1號至今+1天緩衝)
  useEffect(() => {
    const loadWasteWindows = async () => {
      if (!selectedDevID) return;
      setLoadingWasteWindows(true);
      const now = new Date();
      const daysSinceMonthStart = now.getDate();
      const data = await fetchSensorHistory('weight1', (daysSinceMonthStart + 1).toString());
      setWeight1MonthHistory(data);
      setLoadingWasteWindows(false);
    };
    loadWasteWindows();
  }, [selectedDevID, fetchSensorHistory]);

  // Weight parameters are now retrieved from the latest device sensor reading directly
```

現況（`src/views/MonitorDashboard.js` 第269~274行）：
```js
  const biomassOutput = useMemo(() => {
    if (latestWeight2 === undefined || latestWeight2 === null) return "0.00";
    return (parseFloat(latestWeight2) / 15).toFixed(2);
  }, [latestWeight2]);

  const getAlertClass = (type, value) => {
```

- [ ] **Step 3: 新增 `wasteDisposedWindows` useMemo**

把：
```js
  const biomassOutput = useMemo(() => {
    if (latestWeight2 === undefined || latestWeight2 === null) return "0.00";
    return (parseFloat(latestWeight2) / 15).toFixed(2);
  }, [latestWeight2]);

  const getAlertClass = (type, value) => {
```
改成：
```js
  const biomassOutput = useMemo(() => {
    if (latestWeight2 === undefined || latestWeight2 === null) return "0.00";
    return (parseFloat(latestWeight2) / 15).toFixed(2);
  }, [latestWeight2]);

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

  const getAlertClass = (type, value) => {
```

現況（`src/views/MonitorDashboard.js` 第436~515行，完整區塊）：
```jsx
          {/* 第一區 WASTE PROCESSED */}
          <Row>
            <Col xs="12">
              <Card>
                <CardHeader>
                  <h3 className="section-title" style={{ marginTop: 0 }}>
                    <img src={wasteIcon} alt="" className="mr-2" style={{ width: "20px", height: "20px", verticalAlign: "text-bottom" }} />
                    {t('monitorDashboard.wasteProcessed')}
                  </h3>
                </CardHeader>
                <CardBody>
                  <Row>
                    <Col lg="4" md="6">
                      <Card className="card-stats">
                        <CardBody>
                          <Row>
                            <Col xs="5">
                              <div className="info-icon text-center icon-success">
                                <i className="tim-icons icon-delivery-fast" />
                              </div>
                            </Col>
                            <Col xs="7">
                              <div className="numbers">
                                <p className="card-category">{t('monitorDashboard.todaysInput')}</p>
                                <CardTitle tag="h3">
                                  {latestWeight1 !== undefined && latestWeight1 !== null ? parseFloat(latestWeight1).toFixed(2) : "--"} <small>kg</small>
                                </CardTitle>
                              </div>
                            </Col>
                          </Row>
                        </CardBody>
                      </Card>
                    </Col>
                    <Col lg="4" md="6">
                      <Card className="card-stats">
                        <CardBody>
                          <Row>
                            <Col xs="5">
                              <div className="info-icon text-center icon-primary">
                                <i className="tim-icons icon-chart-pie-36" />
                              </div>
                            </Col>
                            <Col xs="7">
                              <div className="numbers">
                                <p className="card-category">{t('monitorDashboard.currentBiomass')}</p>
                                <CardTitle tag="h3">
                                  {latestWeight2 !== undefined && latestWeight2 !== null ? parseFloat(latestWeight2).toFixed(2) : "--"} <small>kg</small>
                                </CardTitle>
                              </div>
                            </Col>
                          </Row>
                        </CardBody>
                      </Card>
                    </Col>
                    <Col lg="4" md="6">
                      <Card className="card-stats">
                        <CardBody>
                          <Row>
                            <Col xs="5">
                              <div className="info-icon text-center icon-warning">
                                <i className="tim-icons icon-coins" />
                              </div>
                            </Col>
                            <Col xs="7">
                              <div className="numbers">
                                <p className="card-category">{t('monitorDashboard.biomassOutput')}</p>
                                <CardTitle tag="h3">
                                  {biomassOutput} <small>kg</small>
                                </CardTitle>
                              </div>
                            </Col>
                          </Row>
                        </CardBody>
                      </Card>
                    </Col>
                  </Row>
                </CardBody>
              </Card>
            </Col>
          </Row>
```

- [ ] **Step 4: 把 TODAY'S INPUT 卡片換成三張新卡片，CURRENT BIOMASS/BIOMASS OUTPUT 保留**

把整個上面那段區塊改成：
```jsx
          {/* 第一區 WASTE PROCESSED */}
          <Row>
            <Col xs="12">
              <Card>
                <CardHeader>
                  <h3 className="section-title" style={{ marginTop: 0 }}>
                    <img src={wasteIcon} alt="" className="mr-2" style={{ width: "20px", height: "20px", verticalAlign: "text-bottom" }} />
                    {t('monitorDashboard.wasteProcessed')}
                  </h3>
                </CardHeader>
                <CardBody>
                  <Row>
                    <Col lg="4" md="6">
                      <Card className="card-stats">
                        <CardBody>
                          <Row>
                            <Col xs="5">
                              <div className="info-icon text-center icon-info">
                                <i className="tim-icons icon-watch-time" />
                              </div>
                            </Col>
                            <Col xs="7">
                              <div className="numbers">
                                <p className="card-category">{t('monitorDashboard.wasteLast30Min')}</p>
                                <CardTitle tag="h3">
                                  {wasteDisposedWindows.last30Min} <small>kg</small>
                                </CardTitle>
                              </div>
                            </Col>
                          </Row>
                        </CardBody>
                      </Card>
                    </Col>
                    <Col lg="4" md="6">
                      <Card className="card-stats">
                        <CardBody>
                          <Row>
                            <Col xs="5">
                              <div className="info-icon text-center icon-success">
                                <i className="tim-icons icon-delivery-fast" />
                              </div>
                            </Col>
                            <Col xs="7">
                              <div className="numbers">
                                <p className="card-category">{t('monitorDashboard.wasteToday')}</p>
                                <CardTitle tag="h3">
                                  {wasteDisposedWindows.today} <small>kg</small>
                                </CardTitle>
                              </div>
                            </Col>
                          </Row>
                        </CardBody>
                      </Card>
                    </Col>
                    <Col lg="4" md="6">
                      <Card className="card-stats">
                        <CardBody>
                          <Row>
                            <Col xs="5">
                              <div className="info-icon text-center icon-primary">
                                <i className="tim-icons icon-calendar-60" />
                              </div>
                            </Col>
                            <Col xs="7">
                              <div className="numbers">
                                <p className="card-category">{t('monitorDashboard.wasteMonthTotal')}</p>
                                <CardTitle tag="h3">
                                  {wasteDisposedWindows.month} <small>kg</small>
                                </CardTitle>
                              </div>
                            </Col>
                          </Row>
                        </CardBody>
                      </Card>
                    </Col>
                    <Col lg="4" md="6">
                      <Card className="card-stats">
                        <CardBody>
                          <Row>
                            <Col xs="5">
                              <div className="info-icon text-center icon-primary">
                                <i className="tim-icons icon-chart-pie-36" />
                              </div>
                            </Col>
                            <Col xs="7">
                              <div className="numbers">
                                <p className="card-category">{t('monitorDashboard.currentBiomass')}</p>
                                <CardTitle tag="h3">
                                  {latestWeight2 !== undefined && latestWeight2 !== null ? parseFloat(latestWeight2).toFixed(2) : "--"} <small>kg</small>
                                </CardTitle>
                              </div>
                            </Col>
                          </Row>
                        </CardBody>
                      </Card>
                    </Col>
                    <Col lg="4" md="6">
                      <Card className="card-stats">
                        <CardBody>
                          <Row>
                            <Col xs="5">
                              <div className="info-icon text-center icon-warning">
                                <i className="tim-icons icon-coins" />
                              </div>
                            </Col>
                            <Col xs="7">
                              <div className="numbers">
                                <p className="card-category">{t('monitorDashboard.biomassOutput')}</p>
                                <CardTitle tag="h3">
                                  {biomassOutput} <small>kg</small>
                                </CardTitle>
                              </div>
                            </Col>
                          </Row>
                        </CardBody>
                      </Card>
                    </Col>
                  </Row>
                </CardBody>
              </Card>
            </Col>
          </Row>
```

- [ ] **Step 5: ESLint 檢查**

Run:
```bash
npx eslint src/views/MonitorDashboard.js
```
Expected: 無錯誤、無警告輸出（除了 npm 本身的 config 警告可忽略）

- [ ] **Step 6: 大括號/小括號配對檢查**

Run:
```bash
python3 -c "
content = open('src/views/MonitorDashboard.js').read()
o, c = content.count('{'), content.count('}')
po, pc = content.count('('), content.count(')')
print('braces open:', o, 'close:', c, 'OK' if o==c else 'MISMATCH')
print('parens open:', po, 'close:', pc, 'OK' if po==pc else 'MISMATCH')
"
```
Expected: 兩行都顯示 `OK`

- [ ] **Step 7: 確認 `todaysInput` 完全沒有殘留引用**

Run:
```bash
grep -rn "todaysInput" src/
```
Expected: 無輸出（完全沒有任何檔案還引用這個已移除的 key）

- [ ] **Step 8: 啟動 dev server 確認編譯成功**

Run:
```bash
BROWSER=none nohup npm start > /tmp/waste-windows-task2.log 2>&1 &
```
等待最多90秒，每隔幾秒檢查一次：
```bash
cat /tmp/waste-windows-task2.log
```
Expected: log 裡出現 `Compiled successfully!` 或 `Compiled with warnings`（沒有 `Failed to compile`）。確認後停掉這個 dev server（用 `pkill -f "react-scripts start"` 或殺掉背景那個 process），不要留著背景執行。

> **人工瀏覽器驗證清單**（沒有瀏覽器存取權限的執行者請明確在報告裡列出這份清單交給使用者，不要跳過或假裝驗證過）：
> - 開啟 dashboard，選擇一台有 weight1 歷史資料的裝置
> - 「Today Waste Processed」區塊應該顯示 5 張卡片：WASTE DISPOSED (LAST 30 MINS)、WASTE DISPOSED (TODAY)、WASTE DISPOSED (MONTH)、CURRENT BIOMASS (weight2)、BIOMASS OUTPUT
> - 三張新卡片都顯示數字（不是 `NaN`、不是空白），沒資料時顯示 `0.00`
> - 邏輯上「過去30分鐘」數字 ≤「今天」數字 ≤「本月」數字（除非剛好卡在跨日/跨月邊界）
> - 切換裝置後，三張新卡片的數字會重新計算（不是卡住不變）
> - 切換語言（英/中）後，三張新卡片的標題文字正確跟著切換，沒有殘留 `monitorDashboard.xxx` 這種字面 key 路徑文字
> - CURRENT BIOMASS、BIOMASS OUTPUT 兩張卡片行為/數值跟改動前完全一致

- [ ] **Step 9: Commit**

```bash
git add src/views/MonitorDashboard.js
git commit -m "feat(dashboard): split TODAY'S INPUT into WASTE DISPOSED 30-min/today/month cards"
```
