// Prueba del recorrido de colegio sin Supabase (todo en memoria):
// el motorista marca paradas, sale en la mañana, manda su GPS, y la familia ve el micro con su enlace.
// Correr: npm test
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

delete process.env.SUPABASE_URL;
delete process.env.BUS_API_KEY;
const store = require("../src/store");
const { hashKey } = require("../src/middleware/auth");

const BUS = "U-TEST01";
const CLAVE = "go503_clave_de_prueba";
const TOKEN = "token-de-familia";
store.units[BUS] = { busId: BUS, companyId: "empresa-1", name: "Micro Lupita", type: "microbus", routeId: null,
  apiKeyHash: hashKey(CLAVE), odometerKm: 0, engineHours: 0, oilIntervalKm: 5000 };
store.familyLinks.set(hashKey(TOKEN), { id: 1, busId: BUS, label: "Familia López", createdAt: new Date().toISOString() });

// Tres casas y el colegio, en línea recta hacia el este (~500 m entre cada una)
const PARADAS = [
  ["Esquina Col. Escalón", 13.7000, -89.2400],
  ["Pasaje Las Rosas", 13.7000, -89.2354],
  ["Redondel Masferrer", 13.7000, -89.2308],
  ["Colegio", 13.7000, -89.2262],
];

let base;
let server;
test.before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/telemetry", require("../src/routes/telemetry"));
  app.use("/api/buses", require("../src/routes/telemetry"));
  app.use("/api/rutas", require("../src/routes/rutas"));
  app.use("/api/motorista", require("../src/routes/motorista"));
  app.use("/api/familia", require("../src/routes/familia"));
  await new Promise((ok) => { server = app.listen(0, ok); });
  base = `http://localhost:${server.address().port}`;
});
test.after(() => server.close());

const motorista = (path, body = {}, clave = CLAVE) => fetch(`${base}/api/motorista/${path}`, {
  method: "POST", headers: { "Content-Type": "application/json", "x-api-key": clave },
  body: JSON.stringify({ busId: BUS, ...body }),
});
const gps = (lat, lng) => fetch(`${base}/api/telemetry`, {
  method: "POST", headers: { "Content-Type": "application/json", "x-api-key": CLAVE },
  body: JSON.stringify({ busId: BUS, lat, lng }),
});
const familia = (token = TOKEN) => fetch(`${base}/api/familia`, { headers: { "x-familia": token } });

test("sin la clave correcta el motorista no entra", async () => {
  assert.equal((await motorista("estado", {}, "otra")).status, 401);
});

test("no puede salir sin paradas", async () => {
  const res = await motorista("viaje", { accion: "salir", sentido: "ida" });
  assert.equal(res.status, 400);
});

test("marca las paradas y crea su recorrido privado", async () => {
  for (const [nombre, lat, lng] of PARADAS) {
    const res = await motorista("parada", { nombre, lat, lng });
    assert.equal(res.status, 201, await res.clone().text());
  }
  const dup = await motorista("parada", { nombre: "Repetida", lat: 13.7, lng: -89.24 });
  assert.equal(dup.status, 400);

  const estado = await (await motorista("estado")).json();
  assert.deepEqual(estado.paradas.map((p) => p.nombre), PARADAS.map((p) => p[0]));
  assert.match(store.units[BUS].routeId, /^C-/);
});

test("el recorrido de colegio no sale en el mapa público", async () => {
  const rutas = await (await fetch(`${base}/api/rutas`)).json();
  assert.ok(!rutas.some((r) => r.ruta === store.units[BUS].routeId));
  const priv = await fetch(`${base}/api/rutas/${store.units[BUS].routeId}`);
  assert.equal(priv.status, 404);
});

test("fuera de viaje la familia no ve dónde está el micro", async () => {
  await gps(13.7000, -89.2400);
  const d = await (await familia()).json();
  assert.equal(d.enServicio, false);
  assert.equal(d.bus, undefined);
  assert.equal(d.paradas.length, 4);
});

test("viaje de la mañana: la familia ve el micro y cuánto falta", async () => {
  const salir = await (await motorista("viaje", { accion: "salir", sentido: "ida" })).json();
  assert.equal(salir.enServicio, true);
  assert.equal(salir.turno, "mañana");

  await gps(13.7000, -89.2380);
  await gps(13.7000, -89.2354); // llega a la segunda parada
  await gps(13.7000, -89.2340);

  const d = await (await familia()).json();
  assert.equal(d.enServicio, true);
  assert.equal(d.turno, "mañana");
  assert.equal(d.llego, false);
  assert.deepEqual(d.bus, { lat: 13.7, lng: -89.234 });
  assert.ok(d.paradas[1].pasoA, "ya pasó por la segunda parada");
  assert.ok(d.paradas[3].etaA, "hora estimada al colegio");

  const publicos = await (await fetch(`${base}/api/buses`)).json();
  assert.ok(!publicos.some((b) => b.busId === BUS), "no sale en /api/buses");
});

test("llega al colegio y luego toca Llegué", async () => {
  await gps(13.7000, -89.2308);
  await gps(13.7000, -89.2262);
  let d = await (await familia()).json();
  assert.equal(d.llego, true);
  assert.ok(d.paradas[3].pasoA);

  await motorista("viaje", { accion: "llegue" });
  d = await (await familia()).json();
  assert.equal(d.enServicio, false);
  assert.equal(d.bus, undefined);
});

test("la tarde va del colegio a las casas", async () => {
  const salir = await (await motorista("viaje", { accion: "salir", sentido: "regreso" })).json();
  assert.equal(salir.turno, "tarde");
  const d = await (await familia()).json();
  assert.equal(d.paradas[0].nombre, "Colegio");
  assert.equal(d.paradas.at(-1).nombre, "Esquina Col. Escalón");
  await motorista("viaje", { accion: "llegue" });
});

test("un enlace que no existe no ve nada", async () => {
  assert.equal((await familia("inventado")).status, 401);
});
