/**
 * @deepseek-ai/dsh-host-electron — the Electron carrier stub. It provides a
 * `webServer`-shaped service that owns NO listening socket: the Electron main
 * process serves the renderer through the `dsh://` protocol instead. The stub
 * exists so the shared Web composition rows (`client-modules`, `connection`,
 * `web-app`) keep their `webServer` inject satisfied and can compose the boot
 * graph, while every transport is carried over the protocol bridge.
 *
 * The service mirrors the {@link @deepseek-ai/dsh-host-webserver} surface
 * (route/upgrade/fallback/tap registries plus `host`/`port`) but is inert:
 * registrations are recorded so the modules node half can observe the tree,
 * and no request is ever routed through it.
 * @module @deepseek-ai/dsh-host-electron
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Duplex } from 'node:stream'
import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'

/** Route match kind (kept `WebServer`-shaped for composition compatibility). */
export type WebRouteKind = 'exact' | 'prefix'

/** One named route registration (recorded, never dispatched by this carrier). */
export interface WebRoute {
  kind: WebRouteKind
  path: string
  handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
}

/** One exact-path upgrade registration (recorded, never negotiated here). */
export interface WebUpgradeRoute {
  path: string
  handler: (req: IncomingMessage, socket: Duplex, head: Buffer) => void | Promise<void>
}

/** Carrier config: the bind facts the shared Web rows read (the protocol ignores them). */
export interface Config {
  host: '127.0.0.1' | '0.0.0.0'
  port: number
}

/**
 * The inert `webServer` carrier. It accepts the shared Web rows' registrations
 * and answers composition-time reads, but binds nothing and routes nothing —
 * the `dsh://` protocol owns all transport.
 */
export class ElectronCarrier extends Service {
  static Config: z<Config> = z.object({
    host: z.union([z.const('127.0.0.1'), z.const('0.0.0.0')]).default('127.0.0.1'),
    port: z.natural().max(65535).default(3080),
  })

  private readonly exact = new Map<string, WebRoute>()
  private readonly prefixes = new Map<string, WebRoute>()
  private readonly upgrades = new Map<string, WebUpgradeRoute>()
  private readonly indexTaps: ((html: string) => string)[] = []
  private fallback: WebRoute['handler'] | undefined

  constructor(ctx: Context, private readonly config: Config) {
    super(ctx, 'webServer')
  }

  /** The composed port (a nominal value; no socket ever binds). */
  get port(): number {
    return this.config.port
  }

  /** The composed bind host (a nominal value; the protocol ignores it). */
  get host(): Config['host'] {
    return this.config.host
  }

  /** Record a named route (satisfies the modules node half's injection; never dispatched). */
  register(route: WebRoute): () => void {
    const table = route.kind === 'exact' ? this.exact : this.prefixes
    if (table.has(route.path)) {
      throw new Error(`electron-carrier: duplicate ${route.kind} route "${route.path}"`)
    }
    table.set(route.path, route)
    return () => { table.delete(route.path) }
  }

  /** Record an upgrade route (never negotiated by this carrier). */
  registerUpgrade(route: WebUpgradeRoute): () => void {
    if (this.upgrades.has(route.path)) {
      throw new Error(`electron-carrier: duplicate upgrade route "${route.path}"`)
    }
    this.upgrades.set(route.path, route)
    return () => { this.upgrades.delete(route.path) }
  }

  /** Record the fallback seat (never dispatched by this carrier). */
  registerFallback(handler: WebRoute['handler']): () => void {
    if (this.fallback !== undefined) {
      throw new Error('electron-carrier: fallback already registered')
    }
    this.fallback = handler
    return () => { this.fallback = undefined }
  }

  /** Record an index.html transform (never applied by this carrier). */
  tapIndex(transform: (html: string) => string): () => void {
    this.indexTaps.push(transform)
    return () => {
      const at = this.indexTaps.indexOf(transform)
      if (at !== -1) this.indexTaps.splice(at, 1)
    }
  }

  /** Run the recorded index transforms (kept for symmetry with the HTTP carrier). */
  applyIndexTaps(html: string): string {
    let out = html
    for (const transform of this.indexTaps) out = transform(out)
    return out
  }
}

export default ElectronCarrier
