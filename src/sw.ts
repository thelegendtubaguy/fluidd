/// <reference lib="WebWorker" />

import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { StaleWhileRevalidate } from 'workbox-strategies'
import { warmStrategyCache } from 'workbox-recipes'

declare let self: ServiceWorkerGlobalScope

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// An installed update takes over at once and reloads the Fluidd tabs it now controls, so tabs never keep an old
// build behind the update prompt or until a hard refresh. The reloads are not held in waitUntil: their requests wait
// for activation to finish.
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', () => {
  self.clients.matchAll({ type: 'window' })
    .then(clients => clients.forEach(client => client.navigate(client.url).catch(() => undefined)))
})

precacheAndRoute(self.__WB_MANIFEST)

cleanupOutdatedCaches()

const configPathname = new URL('config.json', self.location.href).pathname

const configStrategy = new StaleWhileRevalidate({
  cacheName: 'config',
  fetchOptions: {
    cache: 'no-cache'
  }
})

warmStrategyCache({
  urls: [
    configPathname
  ],
  strategy: configStrategy
})

registerRoute(configPathname, configStrategy, 'GET')

const denylist = import.meta.env.DEV
  ? undefined
  : [
      /\/websocket/,
      /\/(printer|api|access|machine|server)\//,
      /\/webcam[2-4]?\//
    ]

const allowlist = import.meta.env.DEV
  ? [/^\/$/]
  : undefined

registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    allowlist,
    denylist
  })
)
