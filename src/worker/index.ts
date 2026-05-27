// Custom service worker additions — merged into workbox SW by next-pwa
// Handles incoming push events and notification clicks

declare const self: ServiceWorkerGlobalScope

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  const title: string = data.title ?? 'Growwly'
  const body: string  = data.body  ?? 'Time to log your transactions!'
  const icon: string  = data.icon  ?? '/icon.svg'
  const url: string   = data.url   ?? '/transactions'

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: '/icon.svg',
      tag: 'growwly-reminder',
      renotify: true,
      data: { url },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url: string = (event.notification.data?.url as string) ?? '/transactions'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((c) => c.url.includes(url))
        if (existing) return existing.focus()
        return self.clients.openWindow(url)
      })
  )
})
