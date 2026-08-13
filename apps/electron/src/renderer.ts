/**
 * Electron renderer entry: thin bootstrap over the web shell, like apps/web.
 * The only difference is the `loadBundle` seam — plugin bundles are fetched
 * over the `dsh://` protocol instead of same-origin HTTP, so each relative
 * `/plugins/<id>/client.js` URL is rebased onto the fake `dsh://host` authority.
 */

import { AppWebEntry } from '@deepseek-ai/dsh-client-web'

const el = document.getElementById('root')
if (el === null) throw new Error('electron app: missing #root')

/** Load one client-plugin bundle as a classic script over the custom protocol. */
function loadBundle(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.async = true
    script.src = new URL(url, 'dsh://host').href
    script.addEventListener('load', () => { script.remove(); resolve() }, { once: true })
    script.addEventListener('error', () => {
      script.remove()
      reject(new Error(`client-modules: bundle script ${url} failed to load`))
    }, { once: true })
    document.head.appendChild(script)
  })
}

void new AppWebEntry(el, { loadBundle }).run()
