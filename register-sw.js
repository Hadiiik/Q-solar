// register-sw.js
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then((registration) => {
                console.log('Service Worker registered successfully:', registration);
                
                // التحقق من التحديثات
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    console.log('Service Worker update found!');
                    
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log('New update available, reloading...');
                            // عرض رسالة للمستخدم لإعادة التحميل
                            // showUpdateNotification();
                        }
                    });
                });
            })
            .catch((error) => {
                console.error('Service Worker registration failed:', error);
            });
        
        // التحقق من حالة الاتصال
        window.addEventListener('online', () => {
            console.log('Back online!');
            location.reload();
        });
        
        window.addEventListener('offline', () => {
            console.log('Offline mode activated');
            // showOfflineNotification();
        });
    });
}

function showUpdateNotification() {
    const notification = document.createElement('div');
    notification.innerHTML = `
        <div style="position: fixed; bottom: 20px; right: 20px; background: #4CAF50; color: white; padding: 15px; border-radius: 8px; z-index: 9999; box-shadow: 0 2px 10px rgba(0,0,0,0.2);">
           有新版本可用！<button onclick="location.reload()" style="margin-right: 10px; background: white; color: #4CAF50; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer;">تحديث</button>
        </div>
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 10000);
}

function showOfflineNotification() {
    const notification = document.createElement('div');
    notification.innerHTML = `
        <div style="position: fixed; bottom: 20px; right: 20px; background: #ff9800; color: white; padding: 15px; border-radius: 8px; z-index: 9999; box-shadow: 0 2px 10px rgba(0,0,0,0.2);">
           ⚠️ أنت غير متصل بالإنترنت. يتم عرض المحتوى المحفوظ مسبقاً.
        </div>
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
}