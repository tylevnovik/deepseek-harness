/**
 * Programmatic entry for embedding dsh surfaces. The CLI `bin` is the process
 * entry; this module exposes the same profile boot the launcher dispatches to,
 * so an embedder (e.g. the Electron main process) can compose a profile
 * in-process and own the resulting context and shutdown controller directly.
 * @module @deepseek-ai/dsh
 */

export { runProfile } from './profile-boot.ts'
export { loadLayeredEnv } from '@deepseek-ai/dsh-app-boot'
