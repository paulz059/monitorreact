# 深藍薄荷綠視覺改版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `monitorreact` 儀表板的用色從目前的黑白灰中性色盤，改成使用者提供的參考設計（`gemini-code-1786718233539.html`）採用的深藍（`#052F5F`）＋薄荷綠（`#10B981`）＋藍灰（`#5893AD`）品牌色系，並同步採用該參考設計的卡片圓角、陰影、字體（Inter + JetBrains Mono）規範。

**Architecture:** 純粹的視覺改版（換色 + 換字型 + 換圓角/陰影），完全不改變現有 Reactstrap 的 `Row`/`Col` 排版結構，不引入 Tailwind CSS，不新增任何後端資料或前端邏輯。做法是延續本次對話已經建立的模式：直接修改 `_variables.scss` 裡驅動全站樣式的 SCSS 變數（這些變數已經在稍早的黑白灰改版中被系統性使用，所以改變數值就能連動全站），並撤銷稍早改成「淺色侧邊欄＋黑字」的側邊欄覆寫（因為這次要帶回參考設計的深色側邊欄＋白字）。

**Tech Stack:** SCSS（`sass` CLI 編譯驗證）、CRA + React（無需改動 JS 邏輯，僅一處全域 CSS 選擇器覆蓋數字文字字體）。

## Global Constraints

- **範圍鎖定為純視覺改版**：不新增地圖嵌入、碳排指標、健康分析判定、歷史紀錄列表、CSV/XLSX 匯出等參考設計裡出現、但需要新後端資料的功能。這些不在本計畫範圍內。
- **不引入 Tailwind CSS**，也不把 `public/index.html` 改成載入參考設計裡的 CDN 腳本（Tailwind/FontAwesome/Leaflet/Chart.js/SheetJS）——現有專案已經有自己的 SCSS + Chart.js 整合，不重複引入。
- **不修改任何 `.js`/`.jsx` 檔案**——所有改動都在 SCSS 變數層級 + `public/index.html` 的字體連結，靠既有的 SCSS cascade 連動全站，不需要碰 JSX。
- **side bar 這次改回深色**（深藍漸層＋白字），推翻本次對話稍早「側邊欄改淺色＋黑字」的決定——這是使用者這次明確要求的方向。主內容區（navbar、卡片、表格）維持淺色背景不變。
- **success/warning/danger 語意色允許微調**（改成 Tailwind emerald/amber/rose 對應色階），因為這是「視覺改版」的一部分、讓警示色跟參考設計的色階一致，但**語意角色不變**（success 還是綠、warning 還是橘、danger 還是紅）。
- 顏色數值一律使用下表的確切色碼，禁止自行調整：

| 變數 | 目前值 | 改成 | 說明 |
|---|---|---|---|
| `$light-bg` | `#f8f8f8` | `#F1F5F8` | 主內容區背景 |
| `$default` | `#2a2a2e` | `#5893AD` | 次要強調色（藍灰） |
| `$primary` | `#55555a` | `#052F5F` | 主品牌色（深藍） |
| `$success` | `#00f2c3` | `#10B981` | 正常/成功狀態（薄荷綠） |
| `$info` | `#55555a` | `#5893AD` | 資訊/次要強調色（藍灰） |
| `$warning` | `#ff8d72` | `#F59E0B` | 警告狀態（琥珀色） |
| `$danger` | `#fd5d93` | `#EF4444` | 危險/離線狀態（紅色） |
| `$black` | `#000000` | `#052F5F` | 標題/次要文字（深藍，非純黑） |
| `$default-states` | `#1f1f22` | `#3A7091` | `$default` 的 hover/深色版 |
| `$primary-states` | `#3f3f43` | `#0A192F` | `$primary` 的 hover/深色版，也是側邊欄漸層底色 |
| `$info-states` | `#3f3f43` | `#3A7091` | `$info` 的 hover/深色版 |
| `$black-states` | `#000000` | `#052F5F` | 內文/卡片標題文字（深藍） |
| `$font-family-base` | `'Poppins', sans-serif` | `'Inter', sans-serif` | 全站基礎字型 |
| `$card-border-radius` | `$border-radius-sm`（≈4.6px） | `1.25rem`（20px） | 卡片圓角，對應參考設計的 `rounded-2xl` |

---

### Task 1: 更新核心品牌色系變數

**Files:**
- Modify: `src/assets/scss/black-dashboard-react/custom/_variables.scss:27,99-116,893`

**Interfaces:**
- Produces: 全站共用的 SCSS 顏色變數新值（見 Global Constraints 表格），後續 Task 2/3 依賴這些變數已經是新值。

- [ ] **Step 1: 修改 `$light-bg`（第27行）**

把：
```scss
$light-bg:                   #f8f8f8 !default;
```
改成：
```scss
$light-bg:                   #F1F5F8 !default;
```

- [ ] **Step 2: 修改主色系區塊（第99~106行）**

把：
```scss
$default:       #2a2a2e !default;
$primary:       #55555a !default;
$secondary:     #f4f5f7 !default;
$success:       #00f2c3 !default;
$info:          #55555a !default;
$warning:       #ff8d72 !default;
$danger:        #fd5d93 !default;
$black:         #000000 !default;
```
改成：
```scss
$default:       #5893AD !default;
$primary:       #052F5F !default;
$secondary:     #f4f5f7 !default;
$success:       #10B981 !default;
$info:          #5893AD !default;
$warning:       #F59E0B !default;
$danger:        #EF4444 !default;
$black:         #052F5F !default;
```

- [ ] **Step 3: 修改 hover/深色狀態變數（第110~116行）**

把：
```scss
$default-states:       #1f1f22 !default;
$primary-states:       #3f3f43 !default;
$success-states:       #0098f0 !default;
$info-states:          #3f3f43 !default;
$warning-states:       #ff6491 !default;
$danger-states:        #ec250d !default;
$black-states:         #000000 !default;
```
改成：
```scss
$default-states:       #3A7091 !default;
$primary-states:       #0A192F !default;
$success-states:       #0098f0 !default;
$info-states:          #3A7091 !default;
$warning-states:       #ff6491 !default;
$danger-states:        #ec250d !default;
$black-states:         #052F5F !default;
```
（`$success-states`/`$warning-states`/`$danger-states` 保持不變——這三個是既有的語意色 hover 變體，本次不動。）

- [ ] **Step 4: 修改卡片圓角（第893行）**

把：
```scss
$card-border-radius:                $border-radius-sm !default;
```
改成：
```scss
$card-border-radius:                1.25rem !default;
```

- [ ] **Step 5: 編譯驗證**

Run:
```bash
npx sass --no-source-map src/assets/scss/black-dashboard-react.scss /tmp/task1-check.css
```
Expected: 無錯誤輸出、exit code 0。

再跑一次確認舊顏色完全消失、新顏色出現：
```bash
grep -c "#55555a\|#2a2a2e\|#00f2c3\|#ff8d72\|#fd5d93" /tmp/task1-check.css
grep -c "#052F5F\|#5893AD\|#10B981\|#F59E0B\|#EF4444" /tmp/task1-check.css
rm /tmp/task1-check.css
```
Expected: 第一個 `grep -c` 結果為 `0`；第二個結果大於 `0`。

- [ ] **Step 6: Commit**

```bash
git add src/assets/scss/black-dashboard-react/custom/_variables.scss
git commit -m "style: switch brand palette to navy/teal/emerald per reference design"
```

---

### Task 2: 側邊欄改回深色（撤銷稍早的淺色側邊欄覆寫）

**Files:**
- Modify: `src/assets/scss/black-dashboard-react/custom/_white-content.scss:33-107`

**Interfaces:**
- Consumes: Task 1 已更新的 `$primary`（`#052F5F`）與 `$primary-states`（`#0A192F`）——側邊欄底色的漸層 `@include linear-gradient($primary-states, $primary)` 定義在 `src/assets/scss/black-dashboard-react/custom/_sidebar-and-main-panel.scss` 的基礎（非 `.white-content` 限定）規則裡，不需要在這個 task 裡改動，只要移除本 task 要刪除的淺色覆寫，底色就會自動變回深藍漸層。
- Produces: 側邊欄恢復成深色背景＋白色導覽文字（參考設計的樣子），主內容區的淺色背景不受影響。

現況（`_white-content.scss` 第33~107行，這是稍早對話為了「側邊欄改淺色＋黑字」新增的覆寫區塊）：

```scss
  .sidebar{
    @include linear-gradient($light-bg, $white);
    box-shadow: 0 2px 22px 0 rgba(0,0,0,.1), 0 4px 20px 0 rgba(0,0,0,.15);

    p{
      color: $black-states;
    }

    .logo:after{
      background: rgba($black-states, 0.1);
    }

    .nav{
      i{
        color: rgba($black-states, 0.7);
      }

      .sidebar-normal,
      .sidebar-mini-icon{
        color: rgba($black-states, 0.7);
      }

      li > a{
        color: $black-states;
      }

      li:hover:not(.active) > a,
      li:focus:not(.active) > a{
        p, i{
          color: $black-states;
        }
      }

      li:hover:not(.active) > a i,
      li:focus:not(.active) > a i{
        color: $black-states;
      }

      li.active > a:not([data-toggle="collapse"]){
        i, p{
          color: $black-states;
        }
        &:before{
          background: $black-states;
        }
      }

      li.active > a[data-toggle="collapse"]{
        color: $black-states;

        i{
          color: $black-states;
        }

        & + div .nav .active a{
          .sidebar-mini-icon, .sidebar-normal{
            color: $black-states;
          }
          &:before{
            background: $black-states;
          }
        }

        &:before{
          background: rgba($black-states, 0.6);
        }
      }

      [data-toggle="collapse"] ~ div > ul > li:hover > a{
        .sidebar-mini-icon, .sidebar-normal{
          color: $black-states;
        }
      }
    }
  }
```

- [ ] **Step 1: 把整個區塊縮回原本的最小版本**

改成：
```scss
  .sidebar{
    box-shadow: 0 2px 22px 0 rgba(0,0,0,.1), 0 4px 20px 0 rgba(0,0,0,.15);
    p{
      color: $opacity-8;
    }
  }
```

這樣側邊欄不再被 `.white-content` 特別覆寫，會 fallback 回 `_sidebar-and-main-panel.scss` 裡的基礎規則：底色是 `@include linear-gradient($primary-states, $primary)`（Task 1 後就是深藍漸層），導覽文字/圖示是寫死的 `$white`／`rgba(255,255,255,.8)`（白字），跟參考設計一致。

- [ ] **Step 2: 編譯驗證**

Run:
```bash
npx sass --no-source-map src/assets/scss/black-dashboard-react.scss /tmp/task2-check.css
```
Expected: 無錯誤輸出、exit code 0。

確認側邊欄的深色漸層規則存在且使用新色碼：
```bash
grep -A2 "^\.sidebar,$" /tmp/task2-check.css | head -5
rm /tmp/task2-check.css
```
Expected: 能看到 `.sidebar, .off-canvas-sidebar { background: linear-gradient(#0A192F, #052F5F); ... }`（顏色代碼可能是編譯後的小寫或大寫十六進位，實際比對顏色數值即可，不用完全比對大小寫格式）。

- [ ] **Step 3: Commit**

```bash
git add src/assets/scss/black-dashboard-react/custom/_white-content.scss
git commit -m "style: revert sidebar to dark navy gradient with white text per reference design"
```

---

### Task 3: 更新卡片邊框與陰影

**Files:**
- Modify: `src/assets/scss/black-dashboard-react/custom/_white-content.scss:232-234`（實際行號可能因 Task 2 刪除內容而往前移動，以下用內容比對而非行號）

**Interfaces:**
- Consumes: 無新變數（直接寫死參考設計提供的邊框色/陰影色，跟 Task 1 的 `$default`/`$primary` 系列無關，因為參考設計這裡本來就是寫死的 rgba 值，不是走變數）。
- Produces: 卡片視覺上有一圈淡藍灰邊框＋深藍色調的陰影，取代原本的純白無邊框、灰階陰影。

現況：
```scss
  .card:not(.card-white){
    background: $white;
    box-shadow: 0 1px 15px 0 rgba(123, 123, 123, 0.05);
```

- [ ] **Step 1: 加上邊框、改陰影色**

改成：
```scss
  .card:not(.card-white){
    background: $white;
    border: 1px solid rgba(88, 147, 173, 0.25);
    box-shadow: 0 4px 20px -2px rgba(5, 47, 95, 0.05);
```

（只加這兩行/改這一行，這個規則底下原本的 `.card-header{...}` 等巢狀規則不動。）

- [ ] **Step 2: 編譯驗證**

Run:
```bash
npx sass --no-source-map src/assets/scss/black-dashboard-react.scss /tmp/task3-check.css
```
Expected: 無錯誤輸出、exit code 0。

```bash
grep -c "rgba(88, 147, 173, 0.25)" /tmp/task3-check.css
rm /tmp/task3-check.css
```
Expected: 大於 `0`。

- [ ] **Step 3: Commit**

```bash
git add src/assets/scss/black-dashboard-react/custom/_white-content.scss
git commit -m "style: give white-theme cards a subtle navy-tinted border and shadow"
```

---

### Task 4: 換字型（Inter + JetBrains Mono）並讓數字類文字使用等寬字

**Files:**
- Modify: `public/index.html:54-58`
- Modify: `src/assets/scss/black-dashboard-react/custom/_variables.scss:379`（`$font-family-base`）
- Modify: `src/assets/scss/black-dashboard-react/custom/_card.scss`（新增 `$font-family-monospace` 變數的使用與 `.numbers h3` 規則）

**Interfaces:**
- Produces: 全站基礎字型改成 Inter；所有 `card-stats` 卡片裡的數字（`<div className="numbers"><CardTitle tag="h3">...</CardTitle></div>` 這個既有 JSX 結構，遍布 `MonitorDashboard.js` 全部 stat 卡片）自動套用 JetBrains Mono 等寬字，不需要修改任何 `.js` 檔案。

- [ ] **Step 1: 把 Google Fonts 連結從 Poppins 換成 Inter + JetBrains Mono**

在 `public/index.html` 把（第54~58行）：
```html
    <!--     Fonts and icons     -->
    <link
      href="https://fonts.googleapis.com/css?family=Poppins:200,300,400,600,700,800"
      rel="stylesheet"
    />
```
改成：
```html
    <!--     Fonts and icons     -->
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap"
      rel="stylesheet"
    />
```

- [ ] **Step 2: 把基礎字型變數改成 Inter**

在 `_variables.scss` 把（第379行）：
```scss
$font-family-base:            'Poppins', sans-serif !default;
```
改成：
```scss
$font-family-base:            'Inter', sans-serif !default;
```

- [ ] **Step 3: 新增等寬字型變數並套用到卡片數字**

在 `_variables.scss` 的 `$font-family-base` 那一行後面，新增一行：
```scss
$font-family-base:            'Inter', sans-serif !default;
$font-family-monospace:       'JetBrains Mono', monospace !default;
```

然後在 `_card.scss` 裡（緊接在稍早新增的 `.info-icon{...}` 區塊後面，`.card-body{ padding: $card-spacer-y; }` 之前）新增：
```scss
.numbers h3{
  font-family: $font-family-monospace;
}
```

這個選擇器會比對到 `MonitorDashboard.js` 裡所有 `<div className="numbers"><CardTitle tag="h3">...</CardTitle></div>` 結構（`CardTitle` 在 reactstrap 裡預設渲染成 `<h3>`），涵蓋 WASTE PROCESSED、ENVIRONMENTAL SENSORS、ENERGY MONITORING、REDUCTION 等所有 stat 卡片的數字顯示，不需要逐一修改 JSX。

- [ ] **Step 4: 編譯驗證**

Run:
```bash
npx sass --no-source-map src/assets/scss/black-dashboard-react.scss /tmp/task4-check.css
```
Expected: 無錯誤輸出、exit code 0。

```bash
grep -c '"Inter", sans-serif' /tmp/task4-check.css
grep -A1 "^\.numbers h3 {" /tmp/task4-check.css
rm /tmp/task4-check.css
```
Expected: 第一個指令結果大於 `0`（注意：Dart Sass 編譯後字型名稱的引號會從單引號變成雙引號，所以要找 `"Inter", sans-serif` 不是 `Inter, sans-serif`）；第二個指令能看到 `font-family: "JetBrains Mono", monospace;`。

- [ ] **Step 5: 手動瀏覽器驗證（此專案沒有前端自動化測試，比照本次對話稍早的作法用啟動 dev server 確認）**

Run:
```bash
npm start
```
在瀏覽器打開 dashboard，確認：
- 側邊欄是深藍漸層＋白字（不是之前的淺色＋黑字）
- 主內容區（navbar、卡片、表格）維持淺色背景，卡片有淡藍灰邊框
- 標題／內文文字是深藍色（不是純黑）
- 所有 stat 卡片的數字（例如 WASTE PROCESSED 底下的公斤數）是等寬字體（JetBrains Mono），跟旁邊的標籤文字字體不同
- 整體字型明顯換成 Inter（跟原本的 Poppins 不同）

- [ ] **Step 6: Commit**

```bash
git add public/index.html src/assets/scss/black-dashboard-react/custom/_variables.scss src/assets/scss/black-dashboard-react/custom/_card.scss
git commit -m "style: switch base font to Inter and use JetBrains Mono for stat card numbers"
```
