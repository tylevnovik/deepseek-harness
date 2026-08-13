# @deepseek-ai/dsh-host-electron

English | [中文](README.zh.md)

Electron carrier stub for the shared Web composition. It provides a `webServer`-shaped service (`ElectronCarrier`) that binds **no** socket: the Electron main process serves the renderer through the `dsh://` protocol, so the HTTP route registry, upgrade sockets, and fallback seat are inert. The stub exists to keep the shared rows (`dsh-client-modules`, `dsh-client-connection`, `dsh-web-app`) composable under a profile that mounts no `dsh-host-webserver` — they inject `webServer`, so the carrier answers their `register`/`registerUpgrade`/`registerFallback`/`tapIndex` calls and their `host`/`port` reads while every request is carried over the protocol bridge instead.

Registrations are recorded (and their disposers remove them) so the modules node half can still observe the composition, but nothing is ever dispatched through this service. `applyIndexTaps` runs the recorded index transforms for symmetry with the HTTP carrier, although no index response is produced here.

## Model Experience

None, as the package is an inert carrier stub; no request or route ever reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **No dispatch** — the carrier is intentionally request-free; the `dsh://` protocol in the Electron main process owns all transport.
- **Nominal `host`/`port`** — the values answer composition-time reads but describe no bound socket.
