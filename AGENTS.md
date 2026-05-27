# FileNexus 專案開發指南 (Project Guidelines)

## 核心架構約束

*   **雲端檔案上傳模式 (Cloud Upload Policy)**：
    系統中的「上傳檔案」功能（如上傳至 GitHub 或 Google Drive）**並非採用傳統的真實檔案上傳通道 (如 multipart/form-data 直傳外部)**。
    為了繞過嚴格的企業網路或防火牆上傳限制，上傳的本質是「虛擬的複製貼上」：先透過 API 在雲端建立物件或樹狀結構，再提取本地檔案的內容（轉換為 Base64 等），包裝在 JSON 或 API payload 中寫入該雲端檔案。後續實作任何上傳與同步功能時，都必須嚴格遵守此代理與資料傳遞模式。
