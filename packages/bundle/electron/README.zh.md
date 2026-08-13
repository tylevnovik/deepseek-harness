# @deepseek-ai/dsh-electron

[English](README.md) | 中文

Electron 界面 bundle。它叠加在 `@deepseek-ai/dsh-web-app` 之上，把 HTTP 载体替换为一个惰性的 `webServer` 形状桩（`@deepseek-ai/dsh-host-electron`），使一个 profile 无需监听 socket 就能组合完整的 Web 界面——客户端模块、connection、API 网关、preset 以及每一个 UI 插件。Electron 主进程通过 `dsh://` 协议拥有全部传输，渲染层则通过 `file://` 加载构建后的前端。

该 bundle patch 会禁用 `webserver` 行，用独立 id 插入惰性载体，并关闭 web runtime 的 `printUrl`、`surfaceContext` 与 `serveFrontend`：没有端口可打印，没有浏览器页面需要引导模型，也没有 fallback 席位上的 SPA dist 服务器。

## 模型体验

间接地经由组合进来的 web-app 与 base 行生效；本 bundle 本身不注册任何 prompt、工具或 schema，只重新配置其他包拥有的载体与界面行。

#### KV Cache 影响

无直接影响；它重新配置的界面行是稳定的启动期事实，不随轮次变化。

## 已知限制与暂缓事项

- **不拥有任何载体**——传输完全由 Electron 主进程拥有；本 bundle 只是让共享的 Web 行在没有 socket 的情况下仍可组合。
- **名义上的载体值**——惰性载体的 `host`／`port` 用于应答组合期读取，但并不描述任何已绑定地址。
