/**
 * Routing and Heuristics Service
 * Handles language detection and smart routing logic.
 */

export interface SmartRouteResult {
  repoName?: string;
  filePath?: string;
  detectedType?: string;
}

/**
 * Heuristic Language Detection
 */
export const detectLanguage = (code: string): string => {
  if (!code.trim()) return 'plaintext';
  
  try {
    JSON.parse(code);
    return 'json';
  } catch (e) {}
  
  if (/fn \w+\s*\(|let mut |pub struct |use std::|println!/.test(code)) return 'rust';
  if (/using System|namespace \w+|public class |Console\.WriteLine/.test(code)) return 'csharp';
  if (/const |let |function |=>|import |export |console\.log/.test(code)) return 'javascript';
  if (/import.*['"]react['"]|className=|<[A-Z]/.test(code)) return 'typescript'; // Defaulting UI to TS
  
  return 'plaintext';
};

/**
 * Smart Routing Logic
 */
export const getSmartRoute = (
  text: string, 
  owner: string, 
  currentRepo: string, 
  currentPath: string
): SmartRouteResult | null => {
  let newRepo = '';
  let newPath = '';
  let detectedType = '';

  if (text.includes('generator client') || /model [A-Z]\w+ \{/.test(text)) {
    newRepo = owner ? `${owner}/backend-repo` : 'backend-repo';
    newPath = `prisma/schema.prisma`;
    detectedType = 'Prisma Schema \u2192 Backend';
  } else if (/^FROM\s/m.test(text) || /RUN apt-get/.test(text) || /docker-compose/.test(text)) {
    newRepo = owner ? `${owner}/infra-repo` : 'infra-repo';
    newPath = `Dockerfile`;
    detectedType = 'Docker Config \u2192 Infra';
  } else if (/import.*['"]react['"]/.test(text) || /className=/.test(text) || /export default function [A-Z]\w+/.test(text)) {
    newRepo = owner ? `${owner}/frontend-repo` : 'frontend-repo';
    const match = text.match(/export (?:default )?(?:function|const|class) ([A-Z]\w+)/);
    const compName = match ? match[1] : 'NewComponent';
    const ext = (/interface\s/.test(text) || /type\s/.test(text)) ? 'tsx' : 'jsx';
    newPath = `src/components/${compName}.${ext}`;
    detectedType = `React UI Component (${compName}) \u2192 Frontend`;
  }

  if (!detectedType) return null;

  // Heuristic for whether we should override
  const isRepoOverrideable = !currentRepo || currentRepo === `${owner}/` || currentRepo.endsWith('-repo');
  const isPathOverrideable = !currentPath || currentPath.startsWith('snippet_') || /^src\/components\/|prisma\/|Dockerfile/.test(currentPath);

  const result: SmartRouteResult = {};
  let changed = false;

  if (isRepoOverrideable && currentRepo !== newRepo) {
    result.repoName = newRepo;
    changed = true;
  }
  if (isPathOverrideable && currentPath !== newPath) {
    result.filePath = newPath;
    changed = true;
  }

  if (changed) {
    result.detectedType = detectedType;
    return result;
  }

  return null;
};
