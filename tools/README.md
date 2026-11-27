# 測試腳本

這些腳本原本只在開發用的工作區 `/workspace/prop-hunt/tools`，2026-11-27 一併放進本倉庫，方便接手的人跑回歸測試。不含密鑰，也沒有 `node_modules`。

## 前置

- 用 Python 在網站根目錄開靜態伺服器：`python3 -m http.server 8765`
- 安裝依賴：`cd tools && npm install`（會裝 `playwright-core@1.48` 等；請勿把 `node_modules` 提交上去）
- 系統要有 Google Chrome，腳本預設路徑是 `/usr/bin/google-chrome`（若路徑不同，需改各 e2e 檔裡的 `executablePath`）

## 怎麼跑

在 `tools/` 目錄：

```bash
URL=http://localhost:8765/ node e2e-v17.mjs
```

也可把 `URL` 設成線上地址：`https://sygo770901.github.io/duomaomao-bianshen/`

建議先跑目前版本的 `e2e-v17.mjs`，再依需要一個一個跑舊套件（不要一次平行跑）。細節見倉庫根目錄的 `HANDOFF.md`。
