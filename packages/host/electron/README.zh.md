# @deepseek-ai/dsh-host-electron

[English](README.md) | 中文

共享 Web 组合的 Electron 载体桩（stub）。它提供一个 `webServer` 形状的服务（`ElectronCarrier`），**不绑定**任何 socket：Electron 主进程通过 `dsh://` 协议服务渲染层，因此 HTTP route 注册表、upgrade socket 与 fallback 席位全部保持惰性。该桩的存在，是为了让不挂载 `dsh-host-webserver` 的 profile 仍能组合那些共享行（`dsh-client-modules`、`dsh-client-connection`、`dsh-web-app`）——它们注入 `webServer`，所以载体应答它们的 `register`／`registerUpgrade`／`registerFallback`／`tapIndex` 调用以及 `host`／`port` 读取，而所有请求实际都走协议桥接。

注册会被记录（其 disposer 会移除它们），以便 modules 节点半区仍能观察组合；但该服务从不真正分发任何请求。`applyIndexTaps` 按顺序运行已记录的 index 转换，仅为了与 HTTP 载体保持对称——这里并不产生任何 index 响应。

## 模型体验

无。该包是一个惰性载体桩，任何请求或 route 都不会进入模型请求。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

## 已知限制与暂缓事项

- **不进行分发**——载体有意地不处理请求；Electron 主进程中的 `dsh://` 协议拥有全部传输。
- **名义上的 `host`／`port`**——这些值用于应答组合期读取，但并不描述任何已绑定的 socket。
