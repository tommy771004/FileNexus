/**
 * GitHub API Service
 * Handles communication with GitHub REST API for file sync operations.
 */

export async function syncFileToGitHub(
  repository: string, // format: "owner/repo"
  path: string,
  message: string,
  content: string,
  customToken?: string,
  isBase64: boolean = false,
  branch?: string
) {
  // Use provided token or fallback to environment variables
  const token = customToken || (import.meta as any).env.VITE_GITHUB_TOKEN;
  
  if (!token) {
    throw new Error("GitHub 設定錯誤：缺少 Personal Access Token 授權碼。請在 UI 中設定或將其指定為 VITE_GITHUB_TOKEN 環境變數。");
  }

  const [owner, repo] = repository.split('/');
  if (!owner || !repo) {
    throw new Error("儲存庫格式無效。請使用 'owner/repo-name' 格式。");
  }

  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  let url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  if (branch) {
    url += `?ref=${encodeURIComponent(branch)}`;
  }

  // 1. Convert plaintext content to UTF-8 safe Base64 if not already Base64
  let base64Content = "";
  if (isBase64) {
    base64Content = content;
  } else {
    const utf8Bytes = new TextEncoder().encode(content);
    const binString = Array.from(utf8Bytes, (byte) => String.fromCharCode(byte)).join("");
    base64Content = btoa(binString);
  }

  // 2. GET request to check if file already exists and grab its SHA value
  let fileSha: string | undefined = undefined;
  
  try {
    const getRes = await fetch(url, { method: 'GET', headers });
    if (getRes.ok) {
      const getData = await getRes.json();
      fileSha = getData.sha;
    } else if (getRes.status !== 404) {
      // 404 is expected if the file is new. Other errors should be caught.
      const errorData = await getRes.json().catch(() => ({}));
      throw new Error(`無法 GET 取得檔案狀態: ${errorData.message || getRes.statusText}`);
    }
  } catch (err: any) {
    if (!err.message.includes('404')) {
      throw err;
    }
  }

  // 3. PUT request to create or update the file
  const putUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const payload = {
    message: message,
    content: base64Content,
    ...(fileSha && { sha: fileSha }), // Only include sha if updating
    ...(branch && { branch: branch })
  };

  const putRes = await fetch(putUrl, {
    method: 'PUT',
    headers,
    body: JSON.stringify(payload),
  });

  if (!putRes.ok) {
    const errorData = await putRes.json().catch(() => ({}));
    throw new Error(`GitHub API 錯誤: ${errorData.message || putRes.statusText}`);
  }

  return await putRes.json();
}

/**
 * Fetches content of a file from GitHub.
 */
export async function getFileContentFromGitHub(
  repository: string,
  path: string,
  customToken?: string,
  branch?: string
): Promise<string | null> {
  const token = customToken || (import.meta as any).env.VITE_GITHUB_TOKEN;
  const [owner, repo] = repository.split('/');
  
  if (!owner || !repo || !path || !token) return null;

  let url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  if (branch) {
    url += `?ref=${encodeURIComponent(branch)}`;
  }
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'Authorization': `Bearer ${token}`,
  };

  try {
    const res = await fetch(url, { method: 'GET', headers });
    if (res.ok) {
      const data = await res.json();
      if (data.content) {
        // GitHub returns content in base64 with newlines
        const cleanedBase64 = data.content.replace(/\n/g, '');
        const binString = atob(cleanedBase64);
        const utf8Bytes = new Uint8Array(binString.length);
        for (let i = 0; i < binString.length; i++) {
          utf8Bytes[i] = binString.charCodeAt(i);
        }
        return new TextDecoder().decode(utf8Bytes);
      }
    }
    return null;
  } catch (err) {
    console.error('Failed to fetch file content:', err);
    return null;
  }
}

/**
 * Fetches the repository tree from GitHub.
 */
export async function getRepoTree(
  repository: string,
  branch: string,
  customToken?: string
) {
  const token = customToken || (import.meta as any).env.VITE_GITHUB_TOKEN;
  const [owner, repo] = repository.split('/');
  
  if (!owner || !repo || !token) return [];

  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'Authorization': `Bearer ${token}`,
  };

  try {
    const branchRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`, { headers });
    if (!branchRes.ok) return [];
    const branchData = await branchRes.json();
    const commitSha = branchData.object.sha;

    const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${commitSha}?recursive=1`, { headers });
    if (!treeRes.ok) return [];
    const treeData = await treeRes.json();
    
    return treeData.tree.filter((t: any) => t.type === 'blob');
  } catch (err) {
    console.error('Failed to fetch repo tree:', err);
    return [];
  }
}

/**
 * Executes a sequential file upload matching the single-file API.
 * This circumvents strict fine-grained PAT permissions that block direct POST /git/blobs.
 */
export async function syncMultipleFilesViaGitDatabase(
  repository: string, // format: "owner/repo"
  branch: string,
  message: string,
  files: { path: string; content: string; isBase64: boolean }[],
  customToken?: string,
  onProgress?: (message: string) => void,
  isAborted?: () => boolean
) {
  const notify = (msg: string) => onProgress && onProgress(msg);

  try {
    const totalFiles = files.length;
    notify(`開始批次上傳 ${totalFiles} 個檔案 (使用單檔模式以符合 GitHub Token 權限)...`);

    let lastRes = null;

    for (let i = 0; i < totalFiles; i++) {
      if (isAborted && isAborted()) {
        notify(`[Cancel] 同步已被使用者手動取消。`);
        throw new Error('同步處理已由使用者取消。');
      }

      const file = files[i];
      notify(`[${i + 1}/${totalFiles}] 正在同步: ${file.path} ...`);
      
      lastRes = await syncFileToGitHub(
        repository,
        file.path,
        `[Batch] ${message} - ${file.path}`,
        file.content,
        customToken,
        file.isBase64,
        branch
      );
      
      notify(`[${i + 1}/${totalFiles}] ✅ ${file.path} 同步成功`);
      
      // Optional: Add a tiny delay to avoid hitting abuse rate limits if there are many files
      if (i < totalFiles - 1) {
        if (isAborted && isAborted()) {
          notify(`[Cancel] 同步已被使用者手動取消。`);
          throw new Error('同步處理已由使用者取消。');
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    notify(`所有 ${totalFiles} 個檔案同步完成！`);

    return { 
      success: true, 
      html_url: lastRes?.commit?.html_url || '', 
      commitSha: lastRes?.commit?.sha || '' 
    };

  } catch (error: any) {
    notify(`[Error] 批次同步中止: ${error.message}`);
    throw error;
  }
}
