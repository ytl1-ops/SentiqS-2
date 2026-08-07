// Service worker minimal pour les notifications push SentiqS.
// Ne fait AUCUNE mise en cache applicative — son seul rôle est de recevoir
// les push du navigateur et de les afficher, y compris quand l'app n'est
// pas ouverte (écran de verrouillage sur Android).

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = { title: 'SentiqS', body: 'Nouvelle alerte sécuritaire', url: '/dashboard/alerts' };
  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch {
    // payload non-JSON — on garde les valeurs par défaut
  }

  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    tag: 'sentiqs-critical-alert',
    renotify: true,
    requireInteraction: true,
    data: { url: data.url || '/dashboard/alerts' },
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/dashboard/alerts';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clientList.length > 0 && 'focus' in clientList[0]) {
        clientList[0].navigate(targetUrl);
        return clientList[0].focus();
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
