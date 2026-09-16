/* Service Worker de notificações push do Açaí Boca Roxa.
   Responsabilidade única: receber pushes do servidor e exibir a notificação
   do sistema, mesmo com a tela bloqueada/apagada ou o app em segundo plano.
   Não intercepta fetch, então não afeta cache nem o funcionamento do site. */

const DEFAULT_TITLE = "Novo pedido no Açaí Boca Roxa";
const DEFAULT_BODY = "Toque para abrir o painel.";
const DEFAULT_URL = "/painelbocaroxa";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || DEFAULT_TITLE;
  const options = {
    body: data.body || DEFAULT_BODY,
    tag: data.tag || "novo-pedido",
    renotify: true,
    requireInteraction: false,
    data: { url: data.url || DEFAULT_URL },
    icon: data.icon || "/favicon.svg",
    badge: data.badge || "/favicon.svg",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || DEFAULT_URL;

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of clientList) {
        if (client.url.includes("/painelbocaroxa") && "focus" in client) {
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })()
  );
});
