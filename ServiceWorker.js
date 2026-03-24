// service-worker.js
const CACHE_NAME = 'offline-cache-v2'; // تغيير الإصدار لتحديث الكاش القديم
const urlsToCache = [
  '/',
  '/index.html',
  '/main.html',
  '/solar-designer.html',
  '/splash.mp4'
];

// قائمة الدومينات الخارجية التي لا نريد تخزينها
const EXTERNAL_DOMAINS = [
  'trinasolar.com',
  'aikosolar.com',
  'googleapis.com',
  'gstatic.com',
  'cloudflare.com',
  'fontawesome.com'
];

// الملفات التي نريد استخدام Cache First لها (أولوية للكاش)
const CACHE_FIRST_FILES = [
  '/splash.mp4',
  'splash.mp4',
  '.mp4',
  '.jpg',
  '.png',
  '.webp',
  '.svg'
];

// التحقق مما إذا كان الملف يجب أن يكون Cache First
function shouldUseCacheFirst(request) {
  const url = request.url;
  
  // التحقق من splash.mp4 مباشرة
  if (url.includes('splash.mp4')) {
    return true;
  }
  
  // التحقق من امتدادات الملفات
  return CACHE_FIRST_FILES.some(ext => url.includes(ext));
}

// التحقق مما إذا كان الطلب يجب تخزينه أم لا
function shouldCache(request) {
  const url = request.url;
  const method = request.method;
  
  // لا تخزن طلبات POST أو PUT أو DELETE
  if (method !== 'GET') return false;
  
  // لا تخزن طلبات API الخارجية
  if (EXTERNAL_DOMAINS.some(domain => url.includes(domain))) return false;
  
  // لا تخزن طلبات API المحلية
  if (url.includes('/api/')) return false;
  
  // تخزين splash.mp4 دائماً
  if (url.includes('splash.mp4')) return true;
  
  return true;
}

// التحقق مما إذا كان الطلب للصفحات الرئيسية (HTML)
function isNavigationRequest(request) {
  return request.mode === 'navigate' || 
         request.destination === 'document' ||
         (request.url.endsWith('.html') && !request.url.includes('/api/'));
}

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
        return self.skipWaiting(); // تفعيل Service Worker فوراً
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
      return self.clients.claim(); // السيطرة على جميع الصفحات المفتوحة فوراً
    })
  );
});

// استراتيجية جديدة: Network First للصفحات، Cache First للملفات الثابتة و splash.mp4
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const requestUrl = new URL(request.url);
  
  // ==================== الاستثناءات ====================
  // لا تتعامل مع طلبات الخارجية (نتركها للمتصفح)
  if (EXTERNAL_DOMAINS.some(domain => requestUrl.hostname.includes(domain))) {
    console.log('Service Worker: Skipping external domain', requestUrl.hostname);
    return; // لا نتدخل في الطلبات الخارجية
  }
  
  // طلبات API المحلية - استخدم Network First
  if (requestUrl.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }
  
  // ==================== splash.mp4 وملفات الوسائط ====================
  // استراتيجية: Cache First (أولوية للكاش)
  if (shouldUseCacheFirst(request)) {
    console.log('Service Worker: Cache First for media file', request.url);
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            console.log('Service Worker: Serving splash.mp4 from cache', request.url);
            return cachedResponse;
          }
          
          // إذا لم يوجد في الكاش، حمله من الشبكة
          console.log('Service Worker: Fetching splash.mp4 from network', request.url);
          return fetch(request)
            .then((networkResponse) => {
              // تخزينه للاستخدام المستقبلي
              if (networkResponse && networkResponse.ok) {
                const responseClone = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, responseClone);
                  console.log('Service Worker: Cached splash.mp4 for future use');
                });
              }
              return networkResponse;
            })
            .catch((error) => {
              console.error('Service Worker: Failed to fetch splash.mp4', error);
              // في حالة الفشل، يمكن إرجاع placeholder أو nothing
              return new Response('Video not available', {
                status: 404,
                statusText: 'Not Found'
              });
            });
        })
    );
    return;
  }
  
  // ==================== الصفحات (HTML) ====================
  // استراتيجية: Network First مع Cache Fallback
  if (isNavigationRequest(request)) {
    console.log('Service Worker: Navigation request (Network First)', request.url);
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // إذا نجح الطلب، قم بتخزين النسخة الجديدة في الخلفية
          if (networkResponse && networkResponse.ok && shouldCache(request)) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
              console.log('Service Worker: Updated cache for', request.url);
            });
          }
          return networkResponse;
        })
        .catch(async (error) => {
          // إذا فشلت الشبكة، استخدم الكاش
          console.log('Service Worker: Network failed, trying cache for', request.url);
          const cachedResponse = await caches.match(request);
          
          if (cachedResponse) {
            console.log('Service Worker: Serving from cache', request.url);
            return cachedResponse;
          }
          
          // إذا لم يوجد في الكاش، اعرض صفحة الخطأ
          console.error('Service Worker: No cache available', error);
          return caches.match('/main.html') || new Response('Offline - Page not available', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/html'
            })
          });
        })
    );
    return;
  }
  
  // ==================== الملفات الثابتة (CSS, JS, Images) ====================
  // استراتيجية: Cache First مع تحديث الخلفية (Stale-While-Revalidate)
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        // طلب الشبكة في الخلفية لتحديث الكاش
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.ok && shouldCache(request)) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
                console.log('Service Worker: Background cache update for', request.url);
              });
            }
            return networkResponse;
          })
          .catch((error) => {
            console.log('Service Worker: Background fetch failed for', request.url, error);
            return null;
          });
        
        // إرجاع النسخة المخزنة فوراً (إذا وجدت)
        if (cachedResponse) {
          console.log('Service Worker: Serving from cache (with background update)', request.url);
          return cachedResponse;
        }
        
        // إذا لم توجد نسخة مخزنة، انتظر نتيجة الشبكة
        console.log('Service Worker: No cache, fetching from network', request.url);
        return fetchPromise;
      })
  );
});

// استراتيجية Network First للـ API
async function networkFirst(request) {
  const timeout = 10000; // 10 ثواني timeout
  
  try {
    // محاولة الشبكة مع timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const networkResponse = await fetch(request, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return networkResponse;
    
  } catch (error) {
    console.log('Service Worker: Network first failed for API', request.url, error);
    
    // محاولة الكاش
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('Service Worker: Serving API from cache', request.url);
      return cachedResponse;
    }
    
    // إذا فشل كل شيء
    return new Response(JSON.stringify({
      error: 'Network error',
      message: 'Unable to reach the server'
    }), {
      status: 408,
      statusText: 'Network Error',
      headers: new Headers({
        'Content-Type': 'application/json'
      })
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
      urlsToCache.map(async (url) => {
        try {
          const response = await fetch(url, {
            cache: 'no-cache',
            headers: {
              'Cache-Control': 'no-cache'
            }
          });
          return { url, response };
        } catch (error) {
          console.error(`Failed to fetch ${url}:`, error);
          return { url, response: null };
        }
      })
    );
    
    responses.forEach(({ url, response }) => {
      if (response && response.ok) {
        cache.put(url, response);
        console.log(`Service Worker: Cache updated for ${url}`);
      }
    });
  } catch (error) {
    console.error('Service Worker: Cache update failed', error);
  }
}

// إرسال رسالة إلى الصفحة عند توفر تحديث
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});

// التحقق من التحديثات في الخلفية كل ساعة
setInterval(() => {
  console.log('Service Worker: Checking for updates...');
  updateCache();
}, 60 * 60 * 1000); // كل ساعة