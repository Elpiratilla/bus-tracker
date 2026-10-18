// Recorridos: por dónde pasa de verdad cada ruta.
// 1) Trazo aprobado (store.shapes): lo dibuja un admin en el panel o sale de una vuelta GPS.
// 2) Vueltas grabadas: mientras un bus hace una vuelta completa (de la primera a la última parada
//    de su sentido) se guardan sus puntos GPS; al llegar al final queda como grabación para escoger.
const { shapes, recordings, trips, units } = require("./store");
const { distanceM } = require("./geo");
const { persist } = require("./db");

const MIN_STEP_M = 15;      // puntos más juntos que esto no agregan forma
const SIMPLIFY_M = 6;       // al terminar: quita puntos que se desvían menos de esto de la línea
const MAX_POINTS = 6000;    // una vuelta de 3 h a un punto cada 5 s cabe de sobra
const KEEP_IN_MEMORY = 10;  // grabaciones por ruta y sentido (sin Supabase)

const grabando = new Map(); // `${busId}:${routeId}` -> { trip, dir, startAt, points }

const round6 = (n) => Math.round(n * 1e6) / 1e6;
const pt = (p) => ({ lat: p[0], lng: p[1] });

// Douglas-Peucker en metros (aproxima con un plano local, suficiente para una ciudad)
function simplify(points, tol = SIMPLIFY_M) {
  if (points.length < 3) return points;
  const lat0 = (points[0][0] * Math.PI) / 180;
  const xy = points.map(([la, ln]) => [ln * 111320 * Math.cos(lat0), la * 110540]);
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = xy[a], [bx, by] = xy[b];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    let far = -1, dmax = 0;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((bx - ax) * (ay - xy[i][1]) - (ax - xy[i][0]) * (by - ay)) / len;
      if (d > dmax) { dmax = d; far = i; }
    }
    if (dmax > tol) { keep[far] = 1; stack.push([a, far], [far, b]); }
  }
  return points.filter((_, i) => keep[i]);
}

// Se llama con cada posición GPS, después de actualizar la vuelta del bus (src/tracking.js)
function track(busId, route, point, now) {
  const key = `${busId}:${route.id}`;
  const trip = trips[key];
  // solo unidades registradas: el bus de la demo (simulador) no anda por calles de verdad
  if (!trip || !units[busId]) return void grabando.delete(key);

  const stops = route.directions[trip.dir];
  const first = stops[0].id;
  const last = stops.at(-1).id;
  let g = grabando.get(key);
  // Vuelta nueva (o cambió de sentido): se graba solo si arrancó en la primera parada
  if (!g || g.trip !== trip) {
    if (!trip.passes[first]) return void grabando.delete(key);
    g = { trip, dir: trip.dir, startAt: trip.passes[first], points: [[stops[0].lat, stops[0].lng]] };
    grabando.set(key, g);
  }
  if (g.done) return;

  const p = [round6(point.lat), round6(point.lng)];
  const prev = g.points.at(-1);
  if (distanceM(pt(prev), point) >= MIN_STEP_M && g.points.length < MAX_POINTS) g.points.push(p);

  // Llegó a la última parada: la vuelta está completa
  if (trip.lastStopId === last && trip.passes[last]) {
    g.done = true;
    const end = stops.at(-1);
    g.points.push([end.lat, end.lng]);
    saveRecording({ routeId: route.id, dir: g.dir, busId, startedAt: g.startAt, endedAt: trip.passes[last] || now,
      points: simplify(g.points) });
  }
}

function saveRecording(rec) {
  const same = (r) => r.routeId === rec.routeId && r.dir === rec.dir;
  recordings.push(rec);
  if (recordings.filter(same).length > KEEP_IN_MEMORY) recordings.splice(recordings.findIndex(same), 1);
  persist("grabación", (db) => db.from("route_recordings").insert({ route_id: rec.routeId, direction: rec.dir,
    bus_id: rec.busId, started_at: new Date(rec.startedAt).toISOString(), ended_at: new Date(rec.endedAt).toISOString(),
    points: rec.points }));
}

// Puntos que manda el panel: [[lat, lng], ...] dentro de El Salvador (con margen)
function validPoints(points) {
  if (!Array.isArray(points) || points.length < 2 || points.length > 4000) return null;
  const out = [];
  for (const p of points) {
    if (!Array.isArray(p) || p.length !== 2) return null;
    const [lat, lng] = p.map(Number);
    if (!(lat > 12.5 && lat < 15 && lng > -91 && lng < -87)) return null;
    out.push([round6(lat), round6(lng)]);
  }
  return out;
}

function setShape(routeId, dir, points, source) {
  shapes[`${routeId}:${dir}`] = { points, source, updatedAt: Date.now() };
  persist("recorrido", (db) => db.from("route_shapes").upsert({ route_id: routeId, direction: dir, points, source,
    updated_at: new Date().toISOString() }), `shape:${routeId}:${dir}`);
}

function deleteShape(routeId, dir) {
  delete shapes[`${routeId}:${dir}`];
  persist("recorrido", (db) => db.from("route_shapes").delete().eq("route_id", routeId).eq("direction", dir),
    `shape:${routeId}:${dir}`);
}

module.exports = { track, simplify, validPoints, setShape, deleteShape };
