---
name: aws-amplify-react
description: 使用 React + AWS Amplify 開發 web 應用程式。涉及元件、頁面、API、Auth、Storage、Hosting 等任何 Amplify 或 React 開發工作時套用此 skill。
argument-hint: "[feature-name] [description]"
---

# AWS Amplify + React 開發規範

## 技術棧

- **前端：** React
- **UI Library：** MUI (Material UI)
- **後端：** AWS Amplify
- **API：** REST API (API Gateway via Amplify)
- **Auth：** AWS Cognito（Amplify 預設設定）

---

## 目錄結構

```
src/
├── pages/          # 頁面元件（對應路由）
├── components/     # 可重用 UI 元件
├── api/            # API 呼叫函式（Amplify API.get / API.post）
├── hooks/          # Custom React hooks
```

---

## 命名慣例

- 元件與頁面檔名：**PascalCase**（`UserCard.jsx`、`LoginPage.jsx`）
- Hook 檔名：**camelCase + use 前綴**（`useAuth.js`、`useUserData.js`）
- API 函式：**camelCase**（`getUsers()`、`createOrder()`）

---

## 建立新頁面

1. 在 `src/pages/` 建立 `FeatureName.jsx`
2. 使用 MUI 元件排版（`Box`、`Container`、`Grid`）

```jsx
// src/pages/Dashboard.jsx
import { Container, Box, Typography } from '@mui/material';

export default function Dashboard() {
  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4 }}>
        <Typography variant="h4">Dashboard</Typography>
      </Box>
    </Container>
  );
}
```

---

## 建立可重用元件

1. 在 `src/components/` 建立 `ComponentName.jsx`
2. 不放業務邏輯，只負責 UI 呈現
3. 資料透過 props 傳入

---

## API 呼叫（Amplify REST API）

所有 API 呼叫集中在 `src/api/`，不在元件內直接呼叫。

API 名稱在 `amplify add api` 設定時命名，並與 `aws-exports.js` 保持一致。

```js
// src/api/users.js
import { API } from 'aws-amplify';

const API_NAME = 'yourApiName'; // 對應 aws-exports.js 中的 API 名稱

export async function getUsers() {
  return API.get(API_NAME, '/users', {});
}

export async function createUser(data) {
  return API.post(API_NAME, '/users', { body: data });
}
```

---

## Auth（Cognito）

使用 Amplify 預設 Cognito 設定：

```js
import { Auth } from 'aws-amplify';

// 取得目前登入用戶
const user = await Auth.currentAuthenticatedUser();

// 登出
await Auth.signOut();
```

需要保護的頁面用 `withAuthenticator` HOC 包裹：

```jsx
import { withAuthenticator } from '@aws-amplify/ui-react';

function ProtectedPage() { ... }

export default withAuthenticator(ProtectedPage);
```

---

## Amplify 設定流程

新增功能的標準指令：

```bash
amplify add api       # 新增 REST API (API Gateway)
amplify add auth      # 新增 Cognito Auth
amplify add storage   # 新增 S3 Storage
amplify add hosting   # 新增 Amplify Hosting
amplify push          # 部署後端至 AWS
amplify publish       # 部署前端 + 後端至 Amplify Hosting
```

---

## 注意事項

- `amplify push` 前確認 `amplify/backend/` 設定正確
- API 呼叫的 API 名稱必須與 `aws-exports.js` 中的名稱完全一致
- MUI 使用 `sx` prop 做 inline style，避免混用其他 CSS 方式
- 每個功能的 API 函式獨立一個檔案放在 `src/api/`（如 `src/api/users.js`、`src/api/orders.js`）
