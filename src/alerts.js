// Notificaciones "tu bus está cerca" (Web Push), como el aviso de Uber.
// Cada CHECK_MS revisa las alertas y avisa una sola vez cuando faltan ALERT_MIN minutos.
const webpush = require("web-push");
const { routes, alerts } = require("./store");
const { routeStatus } = require("./eta");
const { persist } = require("./db");

const ALERT_MIN = 5;                     // avisar cuando falten 5 min o menos
const CHECK_MS = 10 * 1000;              // cada cuánto se revisan las alertas
const EXPIRE_MS = 3 * 60 * 60 * 1000;    // una alerta sin usar se borra a las 3 h

// Solo se aceptan suscripciones de servicios de push reales
const PUSH_HOSTS = [".googleapis.com", ".mozilla.com", ".push.apple.com", ".notify.windows.com"];

const enabled = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
if (enabled) {
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
} else {
  console.warn("Notificaciones desactivadas: faltan VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY en .env");
}

function validSubscription(sub) {
  try {
    const url = new URL(sub.endpoint);
    return url.protocol === "https:" && PUSH_HOSTS.some((h) => url.hostname.endsWith(h))
      && typeof sub.keys?.p256dh === "string" && typeof sub.keys?.auth === "string";
  } catch {
    return false;
  }
}

const alertKey = (endpoint, routeId, dir, stopId) => `${endpoint}|${routeId}|${dir}|${stopId}`;

// Borra la alerta de memoria y de Supabase
function dropAlert(key, alert) {
  alerts.delete(key);
  persist("borrar alerta", (db) => db.from("alerts").delete()
    .match({ endpoint: alert.subscription.endpoint, route_id: alert.routeId, direction: alert.dir, stop_id: alert.stopId }), key);
}

// Minutos que faltan para que el bus llegue a la parada (null si no viene ninguno)
function minutesTo(status, stopId, now) {
  const idx = status.stops.findIndex((s) => s.id === stopId);
  if (status.signalLost || status.lastIdx < 0 || idx <= status.lastIdx || status.times[idx] == null) return null;
  return (status.times[idx] - now) / 60000;
}

async function send(alert, route, stop, mins) {
  const payload = JSON.stringify({
    title: `Tu ${route.id} hacia ${route.directions[alert.dir].at(-1).name} está cerca`,
    body: mins < 1 ? `Está llegando a ${stop.name}` : `Llega a ${stop.name} en ${Math.ceil(mins)} min`,
    tag: `go503-${route.id}-${stop.id}`,
    url: `/mapa.html?ruta=${encodeURIComponent(route.id)}&sentido=${alert.dir}`,
  });
  try {
    await webpush.sendNotification(alert.subscription, payload, { TTL: 120 });
  } catch (err) {
    console.error(`No se pudo notificar (${err.statusCode || err.message})`);
  }
}

async function checkAlerts() {
  if (!enabled || !alerts.size) return;
  const now = Date.now();
  const statuses = new Map(); // un cálculo por ruta, no uno por alerta

  for (const [key, alert] of alerts) {
    if (now - alert.createdAt > EXPIRE_MS) { dropAlert(key, alert); continue; }
    const route = routes.find((r) => r.id === alert.routeId);
    if (!route) { dropAlert(key, alert); continue; }
    const sk = `${route.id}|${alert.dir}`;
    if (!statuses.has(sk)) statuses.set(sk, routeStatus(route, alert.dir, now));

    const mins = minutesTo(statuses.get(sk), alert.stopId, now);
    if (mins === null || mins > ALERT_MIN) continue;

    dropAlert(key, alert); // se avisa una sola vez
    send(alert, route, route.stops.find((s) => s.id === alert.stopId), mins);
  }
}

function addAlert(subscription, routeId, dir, stopId) {
  const createdAt = Date.now();
  const key = alertKey(subscription.endpoint, routeId, dir, stopId);
  alerts.set(key, { subscription, routeId, dir, stopId, createdAt });
  persist("alerta", (db) => db.from("alerts").upsert({ endpoint: subscription.endpoint, subscription,
    route_id: routeId, direction: dir, stop_id: stopId, created_at: new Date(createdAt).toISOString() },
  { onConflict: "endpoint,route_id,direction,stop_id" }), key); // misma cola que el borrado: van en orden
  checkAlerts(); // si el bus ya está a menos de 5 min, avisa de una vez
}

function removeAlert(endpoint, routeId, dir, stopId) {
  const key = alertKey(endpoint, routeId, dir, stopId);
  const alert = alerts.get(key);
  if (!alert) return false;
  dropAlert(key, alert);
  return true;
}

const listAlerts = (endpoint) => [...alerts.values()]
  .filter((a) => a.subscription.endpoint === endpoint)
  .map((a) => ({ ruta: a.routeId, sentido: a.dir, parada: a.stopId }));

function startAlerts() {
  setInterval(checkAlerts, CHECK_MS);
}

module.exports = { enabled, ALERT_MIN, validSubscription, addAlert, removeAlert, listAlerts, startAlerts };
