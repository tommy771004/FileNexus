import { GoogleGenAI } from '@google/genai';

/**
 * LLM Service for AI-driven text generation.
 * 
 * 💡 TIPS: 如果您想要串接本地端的 LLM (例如 Ollama, LM Studio), 
 * 您可以輕鬆將這個 Function 替換為呼叫 `http://localhost:11434/api/generate` (Ollama)
 * 或 `http://localhost:1234/v1/chat/completions` (LM Studio)。
 * 
 * 在此預覽環境中，我們使用內建的 Gemini API 來展示功能。
 */
export async function generateCommitMessage(content: string, filePath: string, oldContent?: string): Promise<string> {
  // --- 以下為預設使用 Gemini API 的實作 ---
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const prompt = `
# Professional Developer Commit AI
Role: Senior Staff Software Engineer
Goal: Generate a concise, high-quality conventional commit message for a code change.

## Context
File Path: \`${filePath}\`
${oldContent ? 'Note: This is an UPDATE to existing code.' : 'Note: This is a NEW file.'}

## Rules
1. Use Conventional Commits format (e.g., feat, fix, docs, style, refactor, perf, test, chore).
2. The summary must be under 50 characters.
3. Use imperative mood (e.g., "add", "fix", "improve", not "added" or "fixing").
4. Return ONLY the commit message. No quotes, no markdown, no conversational filler.

${oldContent ? `
## Previous Version (Snippet):
\`\`\`
${oldContent.substring(0, 1500)}
\`\`\`
` : ''}

## Current Version (Snippet):
\`\`\`
${content.substring(0, 3000)}
\`\`\`

## Decision Tree:
- Changing behavior? -> feat:
- Fixing a bug? -> fix:
- Style/Formatting only? -> style:
- Internal refactor? -> refactor:
- Content update for docs? -> docs:

Response:`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const text = response.text?.trim();
    // Fallback in case AI returns an empty string
    return text || `更新 ${filePath}`;
  } catch (error) {
    console.error("LLM 摘要生成失敗:", error);
    return `更新 ${filePath} (自動替代方案)`;
  }
}

/**
 * AI Batch Summary Generation
 * Follows Vercel-style structured agent reasoning to summarize multiple changes.
 */
export async function generateBatchCommitMessage(files: { path: string; content: string }[]): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    // Construct a list of files for the prompt
    const fileList = files.map(f => `- ${f.path}: ${f.content.substring(0, 300)}...`).join('\n');
    
    const prompt = `
# Batch Commit AI
Role: Technical Lead / Architect
Goal: Generate a professional high-level commit message for a bulk upload.

## Changes:
${fileList}

## Rules
1. Use Conventional Commits.
2. Focus on the combined semantic meaning of the changes (e.g., "feat: setup core authentication and logging infrastructure").
3. Be descriptive but avoid exhaustive listing.
4. Return ONLY the commit message.

Response:`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text?.trim() || `批次同步: 更新了 ${files.length} 個檔案`;
  } catch (error) {
    console.error("Batch LLM summary failed:", error);
    return `批次上傳: 更新了 ${files.length} 個檔案`;
  }
}
