// go503: recibe los avisos "tu bus está cerca" aunque la página esté cerrada

self.addEventListener("push", (e) => {
  const d = e.data ? e.data.json() : {};
  e.waitUntil(
    self.registration.showNotification(d.title || "go503", {
      body: d.body || "",
      tag: d.tag,              // un aviso por parada: el nuevo reemplaza al anterior
      renotify: true,
      requireInteraction: true, // se queda en pantalla hasta que la toques
      data: { url: d.url || "/" },
    })
  );
});

// Al tocar la notificación: abre go503 en la ruta del aviso
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL(e.notification.data.url, self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const win = list.find((c) => new URL(c.url).origin === self.location.origin);
      if (win) return win.navigate(url).then((c) => (c || win).focus());
      return self.clients.openWindow(url);
    })
  );
});
