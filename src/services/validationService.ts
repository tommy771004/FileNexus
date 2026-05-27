/**
 * Validation Service
 * Handles real-time syntax and structural validation for various languages.
 */

export interface ValidationError {
  message: string;
  severity: 'error' | 'warning';
  line?: number;
}

export const validateContent = (code: string, language: string): ValidationError[] => {
  const errors: ValidationError[] = [];
  const lines = code.split('\n');

  if (!code.trim()) return [];

  switch (language) {
    case 'json':
      try {
        JSON.parse(code);
      } catch (e: any) {
        // Try to extract line number from message: "Unexpected token p in JSON at position 12"
        // or "Unexpected end of JSON input"
        errors.push({
          message: `JSON 解析錯誤: ${e.message}`,
          severity: 'error'
        });
      }
      break;

    case 'plaintext':
      // Check for extremely long lines that might break GitHub UI
      lines.forEach((line, index) => {
        if (line.length > 5000) {
          errors.push({
            message: `行 ${index + 1} 過長 (超過 5000 字元)，可能會影響 GitHub 顯示性能。`,
            severity: 'warning',
            line: index + 1
          });
        }
      });
      break;

    case 'typescript':
    case 'javascript':
      // Basic balanced braces check
      const stack: string[] = [];
      for (let i = 0; i < code.length; i++) {
        if (code[i] === '{') stack.push('{');
        else if (code[i] === '}') {
          if (stack.length === 0) {
            errors.push({ message: '發現多出的右大括號 "}"', severity: 'error' });
          } else {
            stack.pop();
          }
        }
      }
      if (stack.length > 0) {
        errors.push({ message: `未閉合的大括號 (缺少 ${stack.length} 個 "}")`, severity: 'error' });
      }
      
      // Check for common typo: 'import { ... } from "react' (missing closing quote)
      if (/import\s+.*\s+from\s+['"][^'"]*$/.test(code)) {
        errors.push({ message: 'Import 語句缺少結束引號', severity: 'error' });
      }
      break;

    case 'rust':
      if (code.includes('fn main') && !code.includes('println!')) {
        errors.push({ message: '提醒：main 函數通常包含輸出語句', severity: 'warning' });
      }
      break;

    default:
      // Heuristic for Dockerfile if detected as plaintext but looks like Docker
      if (/^FROM\s/m.test(code) || /Dockerfile/.test(code)) {
        if (!/^FROM\s/m.test(code)) {
          errors.push({ message: 'Dockerfile 必須以 FROM 指令開始', severity: 'error' });
        }
      }
      break;
  }

  // Cross-language: Check for potential secrets (naive)
  if (/(?:api_key|secret|password|token)\s*[:=]\s*['"][a-zA-Z0-9_\-]{16,}['"]/i.test(code)) {
    errors.push({
      message: '偵測到可能的機敏資訊 (API Key/Secret)。請避免將金鑰直接寫在代碼中。',
      severity: 'warning'
    });
  }

  return errors;
};
