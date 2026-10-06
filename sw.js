/* Bolso — service worker
   Guarda o app no aparelho para abrir mesmo sem internet.
   - Página (index): tenta a internet primeiro; sem rede, usa a cópia guardada.
   - Fontes, ícones e bibliotecas: usa a cópia guardada (mais rápido).
   - Banco de dados (Supabase): NUNCA guarda — sempre vai direto na internet. */
const VERSAO = "bolso-v7";
const BASE = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(VERSAO)
      .then(c => Promise.all(BASE.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  /* dados e login: sempre direto, nunca da cópia */
  if (url.hostname.endsWith("supabase.co") || url.hostname.endsWith("supabase.in")) return;

  /* a página do app: internet primeiro, cópia se estiver sem rede */
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then(r => {
          const copia = r.clone();
          caches.open(VERSAO).then(c => c.put("index.html", copia));
          return r;
        })
        .catch(() => caches.match("index.html").then(r => r || caches.match("./")))
    );
    return;
  }

  /* fontes, ícones, bibliotecas: cópia primeiro, atualiza por trás */
  e.respondWith(
    caches.match(req).then(guardada => {
      const daRede = fetch(req)
        .then(r => {
          if (r && (r.ok || r.type === "opaque")) {
            const copia = r.clone();
            caches.open(VERSAO).then(c => c.put(req, copia));
          }
          return r;
        })
        .catch(() => guardada);
      return guardada || daRede;
    })
  );
});
