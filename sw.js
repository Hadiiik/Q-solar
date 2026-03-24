// service-worker.js
const CACHE_NAME = 'offline-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/main.html',
  '/solar-designer.html', // صفحة بديلة في حالة عدم توفر الصفحة المطلوبة
];

// تثبيت Service Worker وتحميل الملفات مسبقاً
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching files...');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: Installation complete');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Installation failed', error);
      })
  );
});

// تفعيل Service Worker وتنظيف الكاش القديم
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Activation complete');
      return self.clients.claim();
    })
  );
});

// استراتيجية: Cache First with Network Fallback
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  
  // استثناء طلبات API (إذا كان لديك)
  if (requestUrl.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(event.request));
    return;
  }
  
  // للصفحات والملفات الثابتة، استخدام استراتيجية Cache First
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // إذا وجد الملف في الكاش، أرسله
        if (response) {
          console.log('Service Worker: Serving from cache', event.request.url);
          return response;
        }
        
        // إذا لم يوجد، قم بتحميله من الشبكة
        console.log('Service Worker: Fetching from network', event.request.url);
        return fetch(event.request)
          .then((networkResponse) => {
            // تخزين الملف الجديد في الكاش للمرة القادمة
            return caches.open(CACHE_NAME)
              .then((cache) => {
                // لا نخزن استجابات API أو الملفات غير الثابتة
                if (event.request.method === 'GET' && 
                    !event.request.url.includes('/api/')) {
                  cache.put(event.request, networkResponse.clone());
                }
                return networkResponse;
              });
          })
          .catch((error) => {
            console.error('Service Worker: Fetch failed', error);
            // في حالة عدم وجود اتصال بالإنترنت، نعرض صفحة الخطأ
            if (event.request.mode === 'navigate') {
              return caches.match('/main.html');
            }
            return new Response('Network error occurred', {
              status: 408,
              statusText: 'Network Error',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});

// استراتيجية Network First للـ API
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    return new Response('Network error occurred', {
      status: 408,
      statusText: 'Network Error'
    });
  }
}

// تحديث الكاش في الخلفية (Background Sync)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-cache') {
    event.waitUntil(updateCache());
  }
});

async function updateCache() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const responses = await Promise.all(
      urlsToCache.map(url => 
        fetch(url).catch(error => {
          console.error(`Failed to fetch ${url}:`, error);
          return null;
        })
      )
    );
    
    responses.forEach((response, index) => {
      if (response && response.ok) {
        cache.put(urlsToCache[index], response);
      }
    });
  } catch (error) {
    console.error('Service Worker: Cache update failed', error);
  }
}