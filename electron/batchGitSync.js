const fs = require('fs');
const path = require('path');

/**
 * 透過 GitHub Git Database API (Trees, Commits, Refs) 
 * 以「繞過 API 頻繁限制」與「精確模擬提交」的方式進行多檔案批次上傳。
 * 
 * @param {string[]} localFilePaths - 本地檔案的絕對路徑陣列
 * @param {string} owner - GitHub Repository 擁有者
 * @param {string} repo - GitHub Repository 名稱
 * @param {string} branch - 要同步的目標分支名稱 (e.g. 'main' or 'master')
 * @param {string} commitMessage - Commit 訊息
 * @param {string} token - GitHub Personal Access Token (PAT)
 * @returns {Promise<{success: boolean, commitUrl: string, newCommitSha: string}>}
 */
async function batchUploadToGitHub(localFilePaths, owner, repo, branch, commitMessage, token) {
  const baseUrl = `https://api.github.com/repos/${owner}/${repo}`;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };

  try {
    console.log(`[Batch Sync] Starting Git Database API sync for ${localFilePaths.length} files...`);

    // ==========================================
    // Step 1: 取得目前分支的最頂端 Commit SHA
    // ==========================================
    console.log('[Step 1] Fetching latest commit ref for branch:', branch);
    let refRes = await fetch(`${baseUrl}/git/refs/heads/${branch}`, { headers });
    
    // 如果主分支找不到，可以加入一個常見的 master 容錯
    if (refRes.status === 404 && branch === 'main') {
      console.log('Branch "main" not found, falling back to "master"...');
      branch = 'master';
      refRes = await fetch(`${baseUrl}/git/refs/heads/${branch}`, { headers });
    }

    if (!refRes.ok) throw new Error(`[Step 1] Failed to get branch ref: ${await refRes.text()}`);
    const refData = await refRes.json();
    const latestCommitSha = refData.object.sha;

    // ==========================================
    // Step 2: 取得該 Commit 對應的 Base Tree SHA
    // ==========================================
    console.log('[Step 2] Fetching base tree for commit:', latestCommitSha);
    const commitRes = await fetch(`${baseUrl}/git/commits/${latestCommitSha}`, { headers });
    if (!commitRes.ok) throw new Error(`[Step 2] Failed to get latest commit: ${await commitRes.text()}`);
    const commitData = await commitRes.json();
    const baseTreeSha = commitData.tree.sha;

    // ==========================================
    // Step 3: 將本地檔案上傳為 Blobs
    // ==========================================
    console.log('[Step 3] Uploading local files as blobs...');
    const treeItems = [];
    
    for (const localPath of localFilePaths) {
      if (!fs.existsSync(localPath)) {
         throw new Error(`[Step 3] Local file does not exist: ${localPath}`);
      }

      // 讀取本地檔案，此處以 utf8 示範。
      // (若為二進位檔如圖片，讀取 base64 後 payload 的 encoding 需帶 'base64')
      const content = fs.readFileSync(localPath, 'utf8');
      const fileName = path.basename(localPath); // 若需要遞迴目錄結構，可以從 base path 推導

      const blobRes = await fetch(`${baseUrl}/git/blobs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content: content,
          encoding: 'utf-8' 
        })
      });

      if (!blobRes.ok) throw new Error(`[Step 3] Failed to create blob for ${localPath}: ${await blobRes.text()}`);
      const blobData = await blobRes.json();
      console.log(`         -> Blob created for ${fileName} (SHA: ${blobData.sha})`);

      treeItems.push({
        path: fileName,
        mode: '100644',
        type: 'blob',
        sha: blobData.sha
      });
    }

    // ==========================================
    // Step 4: 建立新的 Tree (包含新增與修改的檔案)
    // ==========================================
    console.log('[Step 4] Creating new tree with updated blobs...');
    const treeRes = await fetch(`${baseUrl}/git/trees`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: treeItems
      })
    });
    if (!treeRes.ok) throw new Error(`[Step 4] Failed to create tree: ${await treeRes.text()}`);
    const treeData = await treeRes.json();
    const newTreeSha = treeData.sha;

    // ==========================================
    // Step 5: 建立新的 Commit
    // ==========================================
    console.log('[Step 5] Creating new commit...');
    const newCommitRes = await fetch(`${baseUrl}/git/commits`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: commitMessage,
        tree: newTreeSha,
        parents: [latestCommitSha]
      })
    });
    if (!newCommitRes.ok) throw new Error(`[Step 5] Failed to create commit: ${await newCommitRes.text()}`);
    const newCommitData = await newCommitRes.json();
    const newCommitSha = newCommitData.sha;

    // ==========================================
    // Step 6: 更新分支的 Reference (模擬遠端 Push)
    // ==========================================
    console.log('[Step 6] Updating branch reference...');
    const updateRefRes = await fetch(`${baseUrl}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        sha: newCommitSha
      })
    });
    if (!updateRefRes.ok) throw new Error(`[Step 6] Failed to update ref: ${await updateRefRes.text()}`);
    const updateRefData = await updateRefRes.json();

    console.log('✅ Batch Sync completed successfully!');
    return { 
      success: true, 
      commitUrl: newCommitData.html_url, 
      newCommitSha 
    };

  } catch (error) {
    console.error('❌ Batch Upload Error:', error);
    throw error;
  }
}

module.exports = { batchUploadToGitHub };
