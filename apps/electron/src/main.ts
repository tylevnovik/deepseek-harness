/**
 * Electron main process for the DeepSeek Harness desktop shell. It boots the
 * `electron` profile in-process (no listening socket) and carries every
 * renderer request over the `dsh://` protocol: `/api/*` routes to the shared
 * connection fetch handler (interceptors + the ApiProxy fallback), and
 * `/plugins/*` serves client-plugin bundles read from the modules registry.
 * @module @deepseek-ai/dsh-electron-app
 */

import { app, BrowserWindow, ipcMain, protocol, session } from 'electron'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadLayeredEnv, runProfile } from '@deepseek-ai/dsh'
import { toFetchHandler } from '@deepseek-ai/dsh-host-apiproxy'
import type { Context } from '@deepseek-ai/cordis'

/** Custom scheme carrying the renderer→host bridge; `host` is a stable fake authority. */
const SCHEME = 'dsh'

/** Register the custom scheme as standard/secure so fetch and script loading work over it. */
protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
    },
  },
])

/**
 * The `ctx.connection` host service shape this app consumes (the runtime is
 * `@deepseek-ai/dsh-client-connection`'s `HostConnectionService`). Kept
 * structural so the main process imports only host-plane packages.
 */
interface ConnectionService {
  createSharedFetchHandler(channel: '/api', fallback: { fetch: typeof fetch }): { fetch: (request: Request) => Promise<Response> }
}

/**
 * The `ctx.clientModules` host service shape (the runtime is
 * `@deepseek-ai/dsh-client-modules`' `ClientModuleRegistry`).
 */
interface ClientModuleRegistry {
  graph(): { rev: string; entries: readonly unknown[] }
  clientPath(id: string): string | undefined
}

/** The `dsh://` request handler factory: `pathname` owns the dispatch. */
function protocolHandler(ctx: Context): (request: Request) => Promise<Response> | Response {
  const apiProxy = ctx.get('apiProxy')
  const connection = ctx.get('connection') as ConnectionService | undefined
  const clientModules = ctx.get('clientModules') as ClientModuleRegistry | undefined
  if (apiProxy === undefined || connection === undefined || clientModules === undefined) {
    throw new Error('electron: host composition missing apiProxy/connection/clientModules')
  }
  // The shared fetch handler reproduces the Web `/api` route exactly: the
  // api-gateway Remote interceptor first, then the ApiProxy fallback (unary,
  // SSE event streams, session export, respond). No HTTP trust fence — the
  // renderer is the host's own trusted surface.
  const sharedFetch = connection.createSharedFetchHandler('/api', toFetchHandler(apiProxy))

  return (request) => {
    const pathname = new URL(request.url).pathname
    if (pathname.startsWith('/api/')) return sharedFetch.fetch(request)
    if (pathname.startsWith('/plugins/')) return servePluginBundle(request, clientModules)
    return new Response('not found', { status: 404 })
  }
}

/** Serve one client-plugin bundle (or its source map) read from the modules registry. */
async function servePluginBundle(request: Request, clientModules: ClientModuleRegistry): Promise<Response> {
  const pathname = new URL(request.url).pathname
  const prefix = '/plugins/'
  const bundleSuffix = '/client.js'
  const mapSuffix = '/client.js.map'
  const isSourceMap = pathname.endsWith(mapSuffix)
  const suffix = isSourceMap ? mapSuffix : bundleSuffix
  if (!pathname.startsWith(prefix) || !pathname.endsWith(suffix)) {
    return new Response('not found', { status: 404 })
  }
  const id = pathname.slice(prefix.length, -suffix.length)
  const clientPath = clientModules.clientPath(id)
  if (clientPath === undefined) return new Response('not found', { status: 404 })
  try {
    const body = await readFile(`${clientPath}${isSourceMap ? '.map' : ''}`)
    return new Response(body, {
      headers: {
        'content-type': isSourceMap ? 'application/json; charset=utf-8' : 'text/javascript; charset=utf-8',
        'cache-control': 'no-cache',
      },
    })
  } catch {
    return new Response('not found', { status: 404 })
  }
}

/** Main entry: boot the host, wire the protocol bridge, open the window. */
async function main(): Promise<void> {
  const { ctx, shutdown } = await runProfile({
    environment: loadLayeredEnv('dsh'),
    profile: 'electron',
    patchFiles: [],
    args: [],
  })

  const handle = protocolHandler(ctx)
  session.defaultSession.protocol.handle(SCHEME, handle)

  // The boot graph is handed to the renderer synchronously through preload, so
  // the shell can compose `window.__DSH_BOOT__` before any client script runs.
  ipcMain.on('dsh:boot-graph', (event) => {
    const clientModules = ctx.get('clientModules') as ClientModuleRegistry | undefined
    event.returnValue = clientModules?.graph() ?? { rev: '', entries: [] }
  })

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: join(dirname(fileURLToPath(import.meta.url)), 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })
  await win.loadFile(join(dirname(fileURLToPath(import.meta.url)), 'renderer', 'index.html'))

  // Dispose the host tree on quit so persistence and signal handlers unwind.
  app.on('will-quit', () => {
    void shutdown.shutdown(0)
  })
}

void app.whenReady().then(main)
