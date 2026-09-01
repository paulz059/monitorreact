# 部署與常用指令教學 (Deployment & Common Commands)

本文檔整理這個專案（Amplify Gen1，App ID `d17bp1mbnkflf`，env `dev`，region `ap-southeast-2`）實際會用到的部署與維護指令。

## 1. 部署後端變更（Lambda / API / DynamoDB）

```bash
amplify push
```

- **什麼時候要跑**：改了 `amplify/backend/function/...` 底下任何 Lambda 程式碼（例如 `timestreamProcessor`、`monitorreact4d35ba0f`）、改了 API Gateway 設定、改了 DynamoDB 資料表結構（例如 TTL）。
- **會做什麼**：比對 CloudFormation 差異，只重新部署有變動的資源，不會重建整個 stack。
- 執行前建議先確認 `git status` 沒有漏掉要一起部署的檔案。

## 2. 更新網頁（前端正式環境）

```bash
amplify publish
```

- 這個專案的 Hosting 類型是 **`manual`**（不是接 git 自動部署的模式），所以前端程式碼改完、想讓正式網站看到最新畫面，**一定要手動跑這個指令**，光是 `git push` 不會讓網站更新。
- `amplify publish` 實際上做的事：
  1. 先跑一次 `amplify push`（部署後端變動，如果有的話）
  2. 再執行 `npm run build` 打包前端
  3. 把打包結果上傳到 Amplify Hosting
- 如果只想部署後端、還不想讓前端上線，改用 `amplify push` 就好，不要跑 `publish`。

## 3. 本機開發（測試用）

```bash
npm start
```

在本機啟動 dev server，瀏覽器打開 `http://localhost:3000` 看即時效果（改 SCSS/JS 會自動熱更新）。

> 若本機出現「找不到 `src/aws-exports.js`」的錯誤：這個檔案是 Amplify 自動產生、故意不進 git 版控的設定檔（裡面是 Cognito/API 的連線資訊）。需要執行 `amplify pull` 重新產生，或從你原本能正常跑起來的機器複製一份過來。

## 4. 本機打包確認（不部署，純粹檢查有沒有編譯錯誤）

```bash
npm run build
```

## 5. SCSS 語法快速檢查（不需要整個啟動 dev server）

```bash
npx sass --no-source-map src/assets/scss/black-dashboard-react.scss /tmp/check.css
```

改完 `_variables.scss`、`_card.scss` 這類樣式檔案，想快速確認沒有語法錯誤、顏色有沒有改對，可以用這個指令直接編譯出一份 CSS 來檢查，不用真的啟動網頁。

## 6. Python Lambda 相關（`timestreamProcessor` / `monitorreact4d35ba0f`）

- 兩支 function 的 Lambda Runtime 都是 **`python3.12`**，本機 `Pipfile` 裡的 `python_version` 要跟這個對應，不然會出現版本不符的警告。
- 如果改動 `Pipfile`（例如新增依賴、改 Python 版本）之後 `amplify push` 出現 `pipenv lock` 相關錯誤，需要在**有安裝 pipenv 的機器**（例如你的 Windows 環境）上，到該 function 資料夾底下重新產生鎖定檔：

```bash
cd amplify/backend/function/<function名稱>/src
pipenv lock
```

- 如果同一個 `src/` 資料夾裡新增了第二個以上的 `.py` 模組檔案（例如 `value_parsing.py`），可能會遇到 setuptools 的 `Multiple top-level modules discovered in a flat-layout` 錯誤，需要在該資料夾的 `setup.py` 裡明確指定 `py_modules=[...]`。

## 7. Git 常用指令

```bash
git status                    # 看目前有哪些檔案改動
git add <檔案路徑>              # 加入要提交的檔案
git commit -m "說明文字"        # 提交
git push                      # 推到遠端 GitHub
git log --oneline -10         # 看最近的提交紀錄
```

> 注意：這個專案的網頁**不是**靠 `git push` 自動部署（Hosting 是 manual 模式），`git push` 只是備份/同步程式碼，真正要讓網站更新還是要跑第 2 點的 `amplify publish`。

## 8. 部署後檢查清單

- **CloudWatch Logs**：部署 Lambda 後，第一時間看有沒有 `ModuleNotFoundError` 之類的錯誤（尤其是新增了模組檔案、或改了 import 路徑之後）。
- **DynamoDB Console**：確認寫入的資料型別、TTL 是否符合預期（例如 GPS 應該是 String 型別、weight1/weight2 應該還是 Number 型別）。
- **實際打開網站**：瀏覽器硬重新整理（Cmd+Shift+R），確認畫面、顏色、資料都正確。

## 常見問題排除

| 現象 | 可能原因 |
|---|---|
| 本機 `npm start` 找不到 `aws-exports.js` | 該檔案不進版控，需 `amplify pull` 或手動複製 |
| `amplify push` 卡在 pipenv lock 錯誤 | 見第 6 點，需在裝有 pipenv 的機器上重新 lock |
| 網頁程式碼改了、`git push` 了，但正式網站沒變 | Hosting 是 manual 模式，需要另外跑 `amplify publish` |
| 改了顏色/樣式，畫面卻沒變 | 先確認是不是瀏覽器快取（硬重新整理），或用第 5 點的指令直接編譯檢查有沒有被其他 CSS 規則覆蓋 |
