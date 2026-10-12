const { lastPass, segments, geofence } = require("./store");
const { nearestStop } = require("./geo");

// Qué tan cerca (en metros) debe estar el bus para contar que pasó por la parada
const STOP_RADIUS_M = Number(process.env.STOP_RADIUS_M) || 50;

// Hora del evento: la del sensor si es válida, si no la del servidor
function toTime(ts) {
  const t = ts ? new Date(ts).getTime() : NaN;
  return Number.isFinite(t) ? t : Date.now();
}

// Registra que un bus pasó por una parada y guarda el tiempo del tramo
function registerPass(busId, route, stopId, now) {
  const key = `${busId}:${route.id}`;
  const prev = lastPass[key];
  const order = (id) => route.stops.findIndex((s) => s.id === id);

  // Solo cuenta tramos consecutivos (parada N -> N+1)
  if (prev && order(stopId) === order(prev.stopId) + 1) {
    segments.push({ busId, routeId: route.id, from: prev.stopId, to: stopId,
      seconds: Math.round((now - prev.ts) / 1000), ts: now });
  }
  lastPass[key] = { stopId, ts: now };
}

// Recibe una posición GPS y detecta si el bus acaba de entrar a una parada.
// Solo cuenta la entrada: mientras siga dentro del radio no se vuelve a registrar.
function handlePosition(busId, route, point, now) {
  const near = nearestStop(route, point);
  const inside = near.distance <= STOP_RADIUS_M ? near.stop.id : null;
  const key = `${busId}:${route.id}`;
  const entered = inside && inside !== geofence[key];

  geofence[key] = inside;
  if (entered) registerPass(busId, route, inside, now);

  return { atStop: inside, nearestStop: near.stop.id,
    distanceM: Math.round(near.distance), entered: Boolean(entered) };
}

module.exports = { registerPass, handlePosition, toTime, STOP_RADIUS_M };
