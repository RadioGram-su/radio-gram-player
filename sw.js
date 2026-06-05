const CACHE_NAME = 'radio-gram-v5';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/zen-horizon.css',
  '/189405_morze_zachod_slonca.jpg'
];

// Установка Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Кэш открыт');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.log('Ошибка кэширования:', error);
      })
  );
  self.skipWaiting();
});

// Активация Service Worker
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Удаление старого кэша:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Обработка запросов
self.addEventListener('fetch', event => {
  // Для потокового аудио и внешних ресурсов - сеть без кэша
  if (event.request.url.includes('stream.') || 
      event.request.url.includes('zeno.fm') ||
      event.request.url.includes('radiogram')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Для index.html всегда используем сеть сначала, затем кэш
  if (event.request.url === self.location.origin + '/' || 
      event.request.url === self.location.origin + '/index.html' ||
      event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Клонируем ответ для кэширования
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
          return response;
        })
        .catch(() => {
          // Если офлайн - возвращаем из кэша
          return caches.match(event.request);
        })
    );
    return;
  }

  // Для остальных ресурсов - стратегия "кэш, затем сеть"
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Если есть в кэше - возвращаем из кэша
        if (response) {
          return response;
        }
        // Иначе загружаем из сети
        return fetch(event.request)
          .then(response => {
            // Не кэшируем ошибки и не-GET запросы
            if (!response || response.status !== 200 || event.request.method !== 'GET') {
              return response;
            }
            // Клонируем ответ для кэширования
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            return response;
          });
      })
      .catch(error => {
        console.log('Ошибка загрузки:', error);
        // Если офлайн и ресурс не в кэше - показываем офлайн страницу
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      })
  );
});

// Обработка push-уведомлений (опционально)
self.addEventListener('push', event => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || 'Новое уведомление',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: 1
      }
    };
    event.waitUntil(
      self.registration.showNotification(data.title || 'Radio Gram', options)
    );
  }
});

// Обработка клика по уведомлению
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});
