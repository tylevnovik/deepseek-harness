/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-host-electron`.
 * @module @deepseek-ai/dsh-host-electron/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-host-electron'

/** Cordis companion plugin name. */
export const name = 'host-electron-invariant'
/** Service required before the companion can register. */
export const inject = ['invariants']

/**
 * Owned relation: the inert carrier's route/upgrade/fallback/tap registrations
 * must stay symmetric with their disposers — after the owning fiber unloads,
 * a second registration of the same path must succeed (no stale entry left).
 * The shared web rows register and dispose through this stub, so the check
 * mirrors `dsh-host-webserver`'s on the inert surface.
 */
const install: InvariantInstaller = (ctx, fail) => {
  ctx.on('internal/plugin', () => {
    const server = ctx.get('webServer') as
      | {
        register(route: { kind: 'exact'; path: string; handler: () => void }): () => void
        registerUpgrade(route: { path: string; handler: () => void }): () => void
      }
      | undefined
    if (server === undefined) return // no carrier row in this composition
    const probe = { kind: 'exact' as const, path: '/__dsh_electron_invariant_probe__', handler: () => {} }
    try {
      server.register(probe)()
      server.register(probe)()
      const upgradeProbe = { path: '/__dsh_electron_invariant_upgrade_probe__', handler: () => {} }
      server.registerUpgrade(upgradeProbe)()
      server.registerUpgrade(upgradeProbe)()
    } catch {
      fail('webServer route disposer left a route registered — the inert carrier registries and fiber lifecycles diverged')
    }
  }, { global: true })
}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
