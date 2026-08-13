/**
 * Build the Electron desktop shell into a Windows portable executable.
 *
 * The host is plugin-composed: `runProfile('electron')` resolves its bundle
 * and plugin packages by bare name at runtime, so the packaged app must carry
 * the whole dependency closure as a symlink-free, flat node_modules tree. We
 * reuse the repo's `pnpm deploy` closure-materialization approach (see
 * scripts/build-exe-for-python-sdk.ts) and then package with electron-builder,
 * which supports Windows (unlike @yao-pkg/pkg).
 *
 * `asar: false` is load-bearing: the host's `healProfilesModuleFallback`
 * creates junction symlinks under `$DSH_HOME/profiles/node_modules` and the
 * loader resolves packages with `createRequire`, both of which need real
 * filesystem paths — an asar virtual filesystem would break them.
 */

import { spawn } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { cp, lstat, readdir, realpath, rm } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const DEPLOY_FILTER = '@deepseek-ai/dsh-electron-app'
const STAGING = join(root, 'apps', 'electron', '.electron-stage')

/** Run a pnpm command via npx, pinned to the workspace's pnpm version (matches the interactive invocation). */
async function runPnpm(label: string, args: string[]): Promise<void> {
  await run(label, process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--yes', 'pnpm@11.7.0', ...args])
}

/** The electron-builder bin shim under apps/electron's own node_modules. */
function electronBuilderBin(): string {
  const base = join(root, 'apps', 'electron', 'node_modules', '.bin', 'electron-builder')
  return process.platform === 'win32' ? `${base}.CMD` : base
}

/** Run one child process to completion, inheriting stdio. */
async function run(label: string, cmd: string, args: string[], cwd = root): Promise<void> {
  console.log(`build-electron-exe: ${label}`)
  // CI=true keeps pnpm from prompting to purge node_modules (no TTY in this
  // scripted build); electron-builder behaves fine under it too.
  // pnpm_config_verify_deps_before_run=false skips pnpm's pre-command
  // dependency-status check (`pnpm exec`/`pnpm run` would otherwise try to
  // run `install --production` when the lockfile was just refreshed, which
  // fails without a TTY).
  const child = spawn(cmd, args, {
    stdio: 'inherit',
    cwd,
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      CI: 'true',
      pnpm_config_verify_deps_before_run: 'false',
    },
  })
  const code = await new Promise<number | null>((resolve) => { child.on('exit', resolve) })
  if (code !== 0) throw new Error(`build-electron-exe: ${label} failed with exit code ${String(code)}`)
}

/** Locate the installed Electron dist so electron-builder does not re-download it. */
function findElectronDist(): string {
  const store = join(root, 'node_modules', '.pnpm')
  const electronBinary = process.platform === 'win32' ? 'electron.exe' : 'electron'
  for (const entry of readdirSync(store)) {
    if (!entry.startsWith('electron@')) continue
    const dist = join(store, entry, 'node_modules', 'electron', 'dist')
    if (existsSync(join(dist, electronBinary))) return dist
  }
  throw new Error('build-electron-exe: electron dist not found; run pnpm install first')
}

/** Return the first symbolic link below a directory, if one exists. */
async function findSymlink(directory: string): Promise<string | undefined> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    const metadata = await lstat(path)
    if (metadata.isSymbolicLink()) return path
    if (metadata.isDirectory()) {
      const nested = await findSymlink(path)
      if (nested !== undefined) return nested
    }
  }
  return undefined
}

/** Replace any deploy-time package links with real files (defensive; --legacy hoist is usually flat). */
async function materializeStagedLinks(staging: string): Promise<void> {
  const nodeModules = join(staging, 'node_modules')
  let remaining = await findSymlink(nodeModules)
  while (remaining !== undefined) {
    const segments = remaining.slice(nodeModules.length + 1).split(sep)
    const binIndex = segments.lastIndexOf('.bin')
    if (binIndex >= 0) {
      await rm(join(nodeModules, ...segments.slice(0, binIndex + 1)), { recursive: true, force: true })
      remaining = await findSymlink(nodeModules)
      continue
    }
    const destination = remaining
    const source = await realpath(destination)
    const nestedNodeModules = join(source, 'node_modules')
    await rm(destination, { recursive: true, force: true })
    await cp(source, destination, {
      recursive: true,
      dereference: true,
      filter: path => path !== nestedNodeModules && !path.startsWith(nestedNodeModules + sep),
    })
    remaining = await findSymlink(nodeModules)
  }
}

/** Fail loud if a load-bearing host artifact did not survive deploy. */
function assertStaged(path: string, label: string): void {
  if (!existsSync(path)) {
    throw new Error(`build-electron-exe: ${label} missing after deploy: ${path}`)
  }
}

/** Verify the staged payload has everything the host and renderer need. */
function verifyStaged(): void {
  assertStaged(join(STAGING, 'package.json'), 'app manifest')
  assertStaged(join(STAGING, 'dist', 'main.js'), 'main entry')
  assertStaged(join(STAGING, 'dist', 'preload.cjs'), 'preload bridge')
  assertStaged(join(STAGING, 'dist', 'renderer', 'index.html'), 'renderer index')
  const nm = join(STAGING, 'node_modules', '@deepseek-ai')
  assertStaged(join(nm, 'dsh', 'lib', 'index.js'), '@deepseek-ai/dsh lib')
  assertStaged(join(nm, 'dsh', 'config', 'agent-presets', 'standard'), 'agent presets')
  for (const bundle of ['dsh-base', 'dsh-web-app', 'dsh-electron']) {
    assertStaged(join(nm, bundle, 'cordis.patch.yml'), `${bundle} bundle patch`)
  }
  console.log('build-electron-exe: staged payload verified')
}

async function main(): Promise<void> {
  if (STAGING === root || root.startsWith(STAGING + sep)) {
    throw new Error(`build-electron-exe: refusing to clear staging dir ${STAGING}: it contains the repo root.`)
  }
  await rm(STAGING, { recursive: true, force: true })
  await runPnpm('deploy closure', [
    '--filter', DEPLOY_FILTER, 'deploy', '--legacy', '--prod',
    '--config.node-linker=hoisted', '--config.auto-install-peers=false',
    '--config.link-workspace-packages=true',
    '--config.confirm-modules-purge=false',
    STAGING,
  ])
  await materializeStagedLinks(STAGING)
  verifyStaged()
  await run('electron-builder', electronBuilderBin(), [
    '--win',
    '--publish', 'never',
    '--projectDir', STAGING,
    '--config.electronDist', findElectronDist(),
  ])
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
