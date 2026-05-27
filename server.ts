import express from 'express';
import { createServer as createViteServer } from 'vite';
import { HttpsProxyAgent } from 'https-proxy-agent';
import axios from 'axios';
import path from 'path';
import dotenv from 'dotenv';
import { Octokit } from '@octokit/rest';
import { google } from 'googleapis';
import stream from 'stream';

// 載入可能存在的 .env 變數
dotenv.config();

// 移除 multer，嚴格遵循專案規範：上傳檔案不使用 conventional form-data，一律改用 JSON + Base64 封裝

const app = express();
// 提高 JSON 解析大小上限，因為我們將使用 JSON 的 Base64 來「模擬複製貼上」，避開檔案上傳的 multipart/form-data
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ----------------------------------------------------
// 0. 純文本/JSON 模擬上傳 API (針對嚴格防火牆) & GitHub 匯入
// ----------------------------------------------------

app.post('/api/sync/github-tree', async (req, res) => {
  try {
    const { githubToken, githubOwner, githubRepo, branch = 'main' } = req.body;
    const token = githubToken || process.env.GITHUB_TOKEN;
    const owner = githubOwner || process.env.GITHUB_OWNER;
    const repo = githubRepo || process.env.GITHUB_REPO;

    if (!token || !owner || !repo) {
       return res.status(400).json({ error: '未提供正確的 GitHub 憑證 (需要 TOKEN, OWNER, REPO)' });
    }

    const octokit = new Octokit({ auth: token });
    const branchRes = await octokit.rest.repos.getBranch({ owner, repo, branch });
    const treeRes = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: branchRes.data.commit.commit.tree.sha,
      recursive: 'true'
    });

    res.json({ success: true, tree: treeRes.data.tree });
  } catch (error: any) {
    console.error('[GitHub Tree Error]:', error);
    res.status(500).json({ error: '獲取 GitHub 儲存庫結構失敗', details: error.message });
  }
});

app.post('/api/sync/github-blob', async (req, res) => {
  try {
    const { githubToken, githubOwner, githubRepo, sha } = req.body;
    const token = githubToken || process.env.GITHUB_TOKEN;
    const owner = githubOwner || process.env.GITHUB_OWNER;
    const repo = githubRepo || process.env.GITHUB_REPO;

    if (!token || !owner || !repo || !sha) {
       return res.status(400).json({ error: '缺少必要參數' });
    }

    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.rest.git.getBlob({ owner, repo, file_sha: sha });
    
    // 返回 base64 編碼的內容
    res.json({ success: true, contentBase64: data.content });
  } catch (error: any) {
    res.status(500).json({ error: '獲取檔案內容失敗', details: error.message });
  }
});

app.post('/api/sync/github-json', async (req, res) => {
  try {
    const { filename, contentBase64, githubToken, githubOwner, githubRepo, githubFolder } = req.body;
    if (!filename || !contentBase64) {
      return res.status(400).json({ error: '缺漏檔名或內容' });
    }
    
    const token = githubToken || process.env.GITHUB_TOKEN;
    const owner = githubOwner || process.env.GITHUB_OWNER;
    const repo = githubRepo || process.env.GITHUB_REPO;
    const folder = githubFolder || 'uploads';

    if (!token || !owner || !repo) {
      return res.status(500).json({ error: '未提供正確的 GitHub 憑證 (需要 TOKEN, OWNER, REPO)' });
    }

    const octokit = new Octokit({ auth: token });
    const filePath = folder ? `${folder}/${Date.now()}-${filename}` : `${Date.now()}-${filename}`;
    
    // 這裡我們直接收來自前端的 Base64 字串，不涉及檔案系統的 buffer，完美模擬 JSON call (類似複製貼上動作)
    const gitRes = await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filePath,
      message: `繞過檢測自動同步: ${filename} via FileNexus`,
      content: contentBase64,
    });

    res.json({ 
      success: true, 
      message: '純文本模式同步成功 (已繞過檔案上傳防火牆)', 
      data: {
        path: gitRes.data.content?.path,
        url: gitRes.data.content?.html_url
      }
    });
  } catch (error: any) {
    console.error('[GitHub JSON Sync Error]:', error);
    res.status(500).json({ error: '同步至 GitHub 失敗', details: error.message });
  }
});

// ----------------------------------------------------
// 1. Google Drive 上傳 API (無 Form-Data 純 JSON 的 Base64 API 實作)
// ----------------------------------------------------
app.post('/api/upload/gdrive', async (req, res) => {
  try {
    const { filename, contentBase64, mimeType, gdriveJson } = req.body;
    
    if (!filename || !contentBase64) return res.status(400).json({ error: '缺漏檔名或內容' });
    
    const gdriveJsonStr = gdriveJson || process.env.GDRIVE_CREDENTIALS_JSON;
    if (!gdriveJsonStr) {
      return res.status(500).json({ error: '未提供 Google Drive Credentials JSON' });
    }

    const credentials = JSON.parse(gdriveJsonStr);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file']
    });
    
    const drive = google.drive({ version: 'v3', auth });
    
    // 從 Base64 轉換回 Buffer
    const fileBuffer = Buffer.from(contentBase64, 'base64');
    const bufferStream = new stream.PassThrough();
    bufferStream.end(fileBuffer);

    const driveRes = await drive.files.create({
      requestBody: { name: filename },
      media: {
        mimeType: mimeType || 'text/plain',
        body: bufferStream,
      },
      fields: 'id, webViewLink, name',
    });

    res.json({ success: true, message: '純文本模式同步至 Google Drive 成功', data: driveRes.data });
  } catch (error: any) {
    console.error('[GDrive Upload Error]:', error);
    res.status(500).json({ error: '同步至 Google Drive 失敗', details: error.message });
  }
});

// ----------------------------------------------------
// 2. GitHub 單一檔案上傳 (無 Form-Data 純 JSON 的 Base64 API 實作)
// ----------------------------------------------------
app.post('/api/upload/github', async (req, res) => {
  try {
    const { filename, contentBase64, githubToken, githubOwner, githubRepo, githubFolder } = req.body;
    
    if (!filename || !contentBase64) return res.status(400).json({ error: '缺漏檔名或內容' });
    
    const token = githubToken || process.env.GITHUB_TOKEN;
    const owner = githubOwner || process.env.GITHUB_OWNER;
    const repo = githubRepo || process.env.GITHUB_REPO;
    const folder = githubFolder || 'uploads';

    if (!token || !owner || !repo) {
      return res.status(500).json({ error: '未提供正確的 GitHub 憑證 (需要 TOKEN, OWNER, REPO)' });
    }

    const octokit = new Octokit({ auth: token });
    const filePath = folder ? `${folder}/${Date.now()}-${filename}` : `${Date.now()}-${filename}`;

    const gitRes = await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filePath,
      message: `自動上傳: ${filename} via FileNexus`,
      content: contentBase64,
    });

    res.json({ 
      success: true, 
      message: '純文本模式同步至 GitHub 成功', 
      data: {
        path: gitRes.data.content?.path,
        url: gitRes.data.content?.html_url
      }
    });
  } catch (error: any) {
    console.error('[GitHub Upload Error]:', error);
    res.status(500).json({ error: '上傳至 GitHub 失敗', details: error.message });
  }
});

// 新增：GitHub 批次上傳 (單一 Commit，無 Form-Data 純 JSON API)
app.post('/api/upload/github-bulk', async (req, res) => {
  try {
    const { files, githubToken, githubOwner, githubRepo, githubFolder, branch = 'main' } = req.body;
    // files expects: [{ filename: string, contentBase64: string }]
    
    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: '沒有提供有效的檔案列表 (需為 Base64 陣列)' });
    }
    
    const token = githubToken || process.env.GITHUB_TOKEN;
    const owner = githubOwner || process.env.GITHUB_OWNER;
    const repo = githubRepo || process.env.GITHUB_REPO;
    const folder = githubFolder || 'uploads';

    if (!token || !owner || !repo) {
      return res.status(500).json({ error: '未提供正確的 GitHub 憑證' });
    }

    const octokit = new Octokit({ auth: token });
    const timestamp = Date.now();

    // 1. 獲取目前分支的最新 Commit
    const { data: refData } = await octokit.rest.git.getRef({ owner, repo, ref: `heads/${branch}` });
    const currentCommitSha = refData.object.sha;
    const { data: commitData } = await octokit.rest.git.getCommit({ owner, repo, commit_sha: currentCommitSha });
    const parentTreeSha = commitData.tree.sha;

    // 2. 建立 Blobs (為每個檔案建立物件)
    const treeItems = await Promise.all(files.map(async (file: { filename: string, contentBase64: string }) => {
      const { data: blobData } = await octokit.rest.git.createBlob({
        owner,
        repo,
        content: file.contentBase64,
        encoding: 'base64',
      });
      
      const filePath = folder ? `${folder}/${timestamp}-${file.filename}` : `${timestamp}-${file.filename}`;
      return {
        path: filePath,
        mode: '100644' as const,
        type: 'blob' as const,
        sha: blobData.sha,
      };
    }));

    // 3. 建立新的 Tree
    const { data: newTreeData } = await octokit.rest.git.createTree({
      owner,
      repo,
      base_tree: parentTreeSha,
      tree: treeItems,
    });

    // 4. 建立新的 Commit
    const { data: newCommitData } = await octokit.rest.git.createCommit({
      owner,
      repo,
      message: `純文本批次同步上傳 (${files.length} 個檔案) via FileNexus`,
      tree: newTreeData.sha,
      parents: [currentCommitSha],
    });

    // 5. 更新分支指向新的 Commit
    await octokit.rest.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: newCommitData.sha,
    });

    res.json({ 
      success: true, 
      message: `完成純文本批次同步，共 ${files.length} 個檔案已提交至 GitHub。`,
      data: {
        commitSha: newCommitData.sha,
        url: `https://github.com/${owner}/${repo}/commit/${newCommitData.sha}`
      }
    });
  } catch (error: any) {
    console.error('[GitHub Bulk Upload Error]:', error);
    res.status(500).json({ error: '批次上傳至 GitHub 失敗', details: error.message });
  }
});

// ----------------------------------------------------
// 3. 一般 Proxy 上傳保留 (純 JSON Base64 實作)
// ----------------------------------------------------
app.post('/api/proxy-upload', async (req, res) => {
  try {
    const { filename, contentBase64, mimeType } = req.body;
    if (!filename || !contentBase64) return res.status(400).json({ error: '缺漏檔名或內容' });

    const proxyUrl = process.env.CORPORATE_PROXY_URL;
    const targetUrl = process.env.EXTERNAL_UPLOAD_TARGET || 'https://httpbin.org/post';

    const axiosConfig: any = {
      headers: {
        'Content-Type': mimeType || 'application/octet-stream',
        'X-File-Name': encodeURIComponent(filename)
      }
    };
    if (proxyUrl) {
      axiosConfig.httpsAgent = new HttpsProxyAgent(proxyUrl);
      axiosConfig.proxy = false;
    }

    const fileBuffer = Buffer.from(contentBase64, 'base64');
    const response = await axios.post(targetUrl, fileBuffer, axiosConfig);
    res.json({ success: true, message: 'Proxy 轉發成功', stats: { targetUrl, usedProxy: !!proxyUrl, proxyUrl: proxyUrl || '直連' }, externalResponse: response.data });
  } catch (error: any) {
    res.status(500).json({ error: '中繼轉發失敗', details: error.message });
  }
});

// ----------------------------------------------------
// Vite 前端整合與伺服器啟動 (支援 Vercel)
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (!process.env.VERCEL) {
    // 只有在非 Vercel 生產環境下才自己靜態託管 dist
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  // 避免 Vercel 執行緒中呼叫 listen
  if (!process.env.VERCEL) {
    const PORT: number = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 伺服器運行中: http://localhost:${PORT}`);
    });
  }
}

startServer();

// 將 Express App 匯出，供 Vercel Serverless 使用
export default app;
