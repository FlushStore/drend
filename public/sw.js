// DREND offline: a tela abre mesmo sem internet no iPhone.
// Páginas: rede primeiro, cópia salva se cair. Arquivos com hash (assets/, fonts/): cópia salva primeiro.
const CACHE = "drend-v2";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/", "/manifest.webmanifest"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put("/", copia));
          return res;
        })
        .catch(() => caches.match("/")),
    );
    return;
  }

  if (/^\/(assets|fonts|icons)\//.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then(
        (salvo) =>
          salvo ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copia = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copia));
            }
            return res;
          }),
      ),
    );
  }
});

// Avisos (Web Push): resumo da manhã e compromisso chegando.
self.addEventListener("push", (e) => {
  let a = {};
  try {
    a = e.data ? e.data.json() : {};
  } catch {
    a = { titulo: "DREND", corpo: e.data ? e.data.text() : "" };
  }
  e.waitUntil(self.registration.showNotification(a.titulo || "DREND", { body: a.corpo || "", icon: "/icons/apple-touch-icon.png", badge: "/icons/apple-touch-icon.png", data: { url: a.url || "/" } }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((abertas) => {
      const aberta = abertas.find((c) => new URL(c.url).origin === self.location.origin);
      if (aberta) return aberta.focus().then((c) => c && c.navigate && c.navigate(url));
      return self.clients.openWindow(url);
    }),
  );
});
