# @deepseek-ai/dsh-electron

English | [中文](README.zh.md)

The Electron surface bundle. It rides over `@deepseek-ai/dsh-web-app` and swaps the HTTP carrier for an inert `webServer`-shaped stub (`@deepseek-ai/dsh-host-electron`), so a profile can compose the full Web surface — client modules, connection, api gateway, presets, and every UI plugin — without a listening socket. The Electron main process owns all transport through the `dsh://` protocol, and the renderer loads the built frontend over `file://`.

The bundle patch disables the `webserver` row, inserts the inert carrier under its own id, and sets the web runtime's `printUrl`, `surfaceContext`, and `serveFrontend` off: there is no port to print, no browser page to orient the model toward, and no SPA dist server over a fallback seat.

## Model Experience

Indirectly, through the composed web-app and base rows; this bundle itself registers no prompt, tool, or schema and only reconfigures carrier and surface rows owned by other packages.

#### KV Cache effect

None directly; the surface rows it reconfigures are stable boot facts that do not vary per turn.

## Known Limitations and Deferred Work

- **No carrier of its own** — transport is owned entirely by the Electron main process; this bundle only makes the shared Web rows composable without a socket.
- **Nominal carrier values** — the inert carrier's `host`/`port` answer composition-time reads but describe no bound address.
