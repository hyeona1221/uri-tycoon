// 우리집 자산관리(주) 서비스 워커: 앱 화면 파일만 저장해서 빠르게 열고, 돈 데이터(Supabase)는 저장하지 않음
const VERSION = 'v22';
const CACHE = 'uri-tycoon-' + VERSION;
const SHELL = [
  './', './index.html', './style.css', './app.js', './config.js', './manifest.json',
  './assets/office.webp', './assets/choa_sleep.png', './assets/choa_lie.png', './assets/choa_sit.png',
  './assets/chansol_crawl.png', './assets/chansol_sit.png', './assets/chansol_sleep.png',
  './icons/icon-192.png', './icons/icon-512.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isLib = url.hostname === 'cdn.jsdelivr.net' || url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com');
  if (!sameOrigin && !isLib) return; // Supabase 등 데이터 요청은 건드리지 않음
  const isImage = /\.(png|webp|jpg|svg)$/.test(url.pathname) || url.hostname.endsWith('fonts.gstatic.com');
  if (isImage) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })));
    return;
  }
  // 화면 파일과 라이브러리: 새 버전을 먼저 받고, 인터넷이 안 되면 저장본 사용
  e.respondWith(fetch(sameOrigin ? new Request(req, { cache: 'no-cache' }) : req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; })
    .catch(() => caches.match(req).then(hit => hit || caches.match('./index.html'))));
});
