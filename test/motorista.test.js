// Prueba de la app del motorista con un bus de la 101, sin Supabase (todo en memoria):
// sale hacia Zona Rosa, manda su GPS, sale en el mapa, da la vuelta y termina el trayecto.
// Correr: npm test
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

delete process.env.SUPABASE_URL;
delete process.env.BUS_API_KEY;
const store = require("../src/store");
const { hashKey } = require("../src/middleware/auth");

const BUS = "U-RUTA01";
const CLAVE = "go503_clave_de_prueba";
store.units[BUS] = { busId: BUS, companyId: "empresa-1", name: "Bus 7", type: "autobus", routeId: "101",
  apiKeyHash: hashKey(CLAVE), odometerKm: 0, engineHours: 0, oilIntervalKm: 5000 };
store.units["U-SINRUTA"] = { busId: "U-SINRUTA", companyId: "empresa-1", name: "Sin ruta", type: "autobus",
  routeId: null, apiKeyHash: hashKey(CLAVE), odometerKm: 0, engineHours: 0, oilIntervalKm: 5000 };

let base;
let server;
test.before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/telemetry", require("../src/routes/telemetry"));
  app.use("/api/motorista", require("../src/routes/motorista"));
  await new Promise((ok) => { server = app.listen(0, ok); });
  base = `http://localhost:${server.address().port}`;
});
test.after(() => server.close());

const post = (url, body, clave = CLAVE) => fetch(`${base}${url}`, {
  method: "POST", headers: { "Content-Type": "application/json", "x-api-key": clave },
  body: JSON.stringify({ busId: BUS, ...body }),
}).then(async (r) => ({ status: r.status, body: await r.json() }));
const motorista = (path, body = {}, clave) => post(`/api/motorista/${path}`, body, clave);
const gps = (lat, lng) => post("/api/telemetry", { lat, lng });
// ¿Sale en el mapa público? La misma regla que usan los minutos de llegada (src/enMapa.js)
const enMapa = async () => Boolean(store.buses[BUS]) && require("../src/enMapa").enMapa(store.buses[BUS]);

test("sin la clave correcta el motorista no entra", async () => {
  assert.equal((await motorista("estado", {}, "otra")).status, 401);
});

test("una unidad sin ruta no puede salir", async () => {
  assert.equal((await motorista("estado", { busId: "U-SINRUTA" })).status, 409);
});

test("fuera de servicio: ve sus dos sentidos", async () => {
  const { body } = await motorista("estado");
  assert.equal(body.ruta, "101");
  assert.equal(body.enServicio, false);
  assert.deepEqual(body.sentidos.map((d) => d.destino), ["Zona Rosa", "Terminal de Oriente"]);
});

test("inicia el trayecto hacia Zona Rosa y sale en el mapa", async () => {
  const { body } = await motorista("viaje", { accion: "salir", sentido: "ida" });
  assert.equal(body.enServicio, true);
  assert.equal(body.ultimaParada, "Terminal de Oriente");
  assert.equal(body.siguiente, "Centro Histórico");

  await gps(13.6989, -89.1914); // llega al Centro Histórico
  const { body: e } = await motorista("estado");
  assert.equal(e.ultimaParada, "Centro Histórico");
  assert.equal(e.siguiente, "Parque Infantil");
  assert.deepEqual(e.paradas.map((p) => p.paso), [true, true, false, false, false]);
  assert.ok(await enMapa());
});

test("da la vuelta: ahora va hacia Terminal de Oriente", async () => {
  const { body } = await motorista("viaje", { accion: "salir", sentido: "regreso" });
  assert.equal(body.sentido, "regreso");
  assert.equal(body.ultimaParada, "Zona Rosa");
  assert.equal(body.siguiente, "Metrocentro");
});

test("termina el trayecto y deja de salir en el mapa", async () => {
  const { body } = await motorista("viaje", { accion: "terminar" });
  assert.equal(body.enServicio, false);
  assert.equal(await enMapa(), false);
});
