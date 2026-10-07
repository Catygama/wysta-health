self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : {};
  const data = payload.data || {};
  event.waitUntil(
    self.registration.showNotification(payload.title || 'Wysta', {
      body: payload.body || '',
      icon: '/favicon.ico',
      tag: data.conversationId,
      data,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const id = event.notification.data && event.notification.data.conversationId;
  const url = id ? `/conversations/${id}` : '/conversations';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((w) => 'focus' in w);
      if (existing) {
        return existing.navigate(url).then((w) => (w || existing).focus());
      }
      return self.clients.openWindow(url);
    })
  );
});
