/**
 * Preload bridge for the Electron renderer. It exposes the host boot graph and
 * the Electron-carrier flag through contextBridge, so the isolated renderer
 * world sees them without any Node integration. `__DSH_BOOT__` is fetched
 * synchronously from the main process before any client script runs.
 */

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('__DSH_ELECTRON__', true)
contextBridge.exposeInMainWorld('__DSH_BOOT__', ipcRenderer.sendSync('dsh:boot-graph'))
