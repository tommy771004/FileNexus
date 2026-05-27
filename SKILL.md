# FileNexus Agent Skill

## Description
This skill enables an AI agent to synchronize local code and configuration to GitHub repositories via the GitHub REST API. It supports intelligent routing, automatic language detection, real-time validation, and diff-aware commit message generation.

## Core Capabilities
- **Single File Sync**: Targeted upload of a specific file to a specific path.
- **Batch Sync**: Simultaneous upload of multiple files with automatic directory tree reconstruction.
- **Smart Routing**: Heuristic detection of project types (Next.js, Prisma, Docker) to suggest optimal repository paths.
- **AI Summary**: Generates high-quality Conventional Commit messages based on file diffs or batch contents.

## Guidelines for AI Interaction
1. **Always Validate**: Before syncing, verify the code using the `validationService`.
2. **Context-Aware Commits**: When generating commit messages, prioritize the *intent* of the change (e.g., "fix" vs "feat").
3. **Implicit Routing**: If the user doesn't provide a path, use `getSmartRoute` to suggest the most likely location in a standard project structure.
4. **Error Resilience**: Handle common GitHub API errors (401, 404, 409) with friendly, actionable instructions.

## Data Invariants
- `repoName` must be in the format `owner/repo`.
- `filePath` should be relative to the repository root.
- `github_pat` must be stored securely via `storeService`.

## Example Usage
- **Scenario**: User pastes a React component.
- **Action**: Detect as `tsx`, suggest path `src/components/ComponentName.tsx`, generate summary `feat: implement ComponentName UI`.
