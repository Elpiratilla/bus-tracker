// Prueba de lo que recibe /api/telemetry, sin Supabase: mensajes atrasados, campos desconocidos
// y relojes adelantados no deben mover ni romper el bus en el mapa. Correr: npm test
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

delete process.env.SUPABASE_URL;
delete process.env.BUS_API_KEY;
const store = require("../src/store");

const BUS = "SIM-1";
let base;
let server;
test.before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/telemetry", require("../src/routes/telemetry"));
  await new Promise((ok) => { server = app.listen(0, ok); });
  base = `http://localhost:${server.address().port}`;
});
test.after(() => server.close());

const send = (body) => fetch(`${base}/api/telemetry`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ busId: BUS, routeId: "101", ...body }),
}).then((r) => r.json());
const hace = (min) => new Date(Date.now() - min * 60000).toISOString();

test("un mensaje atrasado (de la cola sin señal) no mueve el bus", async () => {
  await send({ lat: 13.7059, lng: -89.2123, ts: hace(0) });       // ahora, en Metrocentro
  const r = await send({ lat: 13.6989, lng: -89.1914, ts: hace(20) }); // hace 20 min, en el Centro
  assert.equal(r.atrasado, true);
  assert.equal(store.buses[BUS].lat, 13.7059);
});

test("solo se guardan los campos que conoce el servidor", async () => {
  await send({ lat: 13.7059, lng: -89.2123, speed: 22, enServicio: true, basura: "x".repeat(50) });
  assert.equal(store.buses[BUS].speed, 22);
  assert.equal(store.buses[BUS].enServicio, undefined);
  assert.equal(store.buses[BUS].basura, undefined);
});

test("una hora en el futuro (reloj malo) se cambia por la de ahora", async () => {
  await send({ lat: 13.7059, lng: -89.2123, ts: new Date(Date.now() + 86400000).toISOString() });
  assert.ok(store.buses[BUS].updatedAt <= Date.now());
});
