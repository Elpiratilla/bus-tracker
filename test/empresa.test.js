// Prueba de que cada empresa solo ve y toca sus unidades: la empresa B no puede editar, borrar
// ni sacar la clave de un bus de la empresa A. Supabase falso (solo lo que pide el inicio de sesión). Correr: npm test
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

process.env.SUPABASE_URL = "http://localhost:1";
process.env.SUPABASE_SECRET_KEY = "prueba";
const store = require("../src/store");
const { db } = require("../src/db");

// El token es el id del usuario; cada usuario es dueño de una empresa
const empresas = { "user-a": { id: "empresa-a", name: "A", is_admin: false }, "user-b": { id: "empresa-b", name: "B", is_admin: false } };
db.auth.getUser = async (token) => ({ data: { user: { id: token } } });
// Las escrituras (rutas nuevas, paradas) responden bien y no guardan nada: lo que importa es la memoria
db.from = () => ({ select() { return this; }, eq(_k, v) { this.v = v; return this; },
  insert() { return this; }, update() { return this; }, upsert() { return this; }, delete() { return this; },
  then(ok) { ok({ data: [], error: null }); },
  maybeSingle() { return Promise.resolve({ data: empresas[this.v] || null }); } });

store.units["U-AAAAAA"] = { busId: "U-AAAAAA", companyId: "empresa-a", name: "Bus de A", routeId: "101", odometerKm: 0, engineHours: 0 };

let base;
let server;
test.before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/empresa", require("../src/routes/empresa"));
  await new Promise((ok) => { server = app.listen(0, ok); });
  base = `http://localhost:${server.address().port}`;
});
test.after(() => server.close());

const como = (user) => (method, path, body) => fetch(`${base}/api/empresa${path}`, {
  method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${user}` }, body: body && JSON.stringify(body),
});
const comoA = como("user-a");
const comoB = como("user-b");

test("la empresa B no ve el bus de la empresa A en su flota", async () => {
  const flota = await (await comoB("GET", "/flota")).json();
  assert.deepEqual(flota, []);
});

test("la empresa B no puede editar, sacar la clave ni borrar el bus de A", async () => {
  assert.equal((await comoB("PATCH", "/unidades/U-AAAAAA", { nombre: "Mío" })).status, 404);
  assert.equal((await comoB("POST", "/unidades/U-AAAAAA/clave")).status, 404);
  assert.equal((await comoB("DELETE", "/unidades/U-AAAAAA")).status, 404);
  assert.equal(store.units["U-AAAAAA"].name, "Bus de A");
});

const IDA = [{ nombre: "Terminal Norte", lat: 13.74, lng: -89.21 }, { nombre: "Parque Central", lat: 13.70, lng: -89.19 }];

test("la empresa A crea su ruta con paradas; el regreso puede ser la ida al revés", async () => {
  const res = await comoA("POST", "/rutas", { numero: "15 a", nombre: "Ruta 15-A", tipo: "microbus", ida: IDA, regreso: "al-reves" });
  assert.equal(res.status, 201);
  const ruta = store.routes.find((r) => r.id === "15A");
  assert.equal(ruta.companyId, "empresa-a");
  assert.deepEqual(ruta.directions.regreso.map((s) => s.name), ["Parque Central", "Terminal Norte"]);
  assert.equal((await comoA("POST", "/rutas", { numero: "101", ida: IDA, regreso: "al-reves" })).status, 409);
});

test("la empresa B no ve, no edita ni usa las rutas de A ni las de go503", async () => {
  const rutas = await (await comoB("GET", "/rutas")).json();
  assert.deepEqual(rutas, []);
  assert.equal((await comoB("PUT", "/rutas/15A", { nombre: "Mía" })).status, 404);
  assert.equal((await comoB("PUT", "/rutas/101", { ida: IDA, regreso: "al-reves" })).status, 404);
  assert.equal((await comoB("PUT", "/rutas/15A/ida/recorrido", { puntos: [[13.7, -89.2], [13.71, -89.21]] })).status, 404);
  assert.equal((await comoB("DELETE", "/rutas/15A")).status, 404);
  assert.equal((await comoB("POST", "/unidades", { nombre: "X", ruta: "15A", tipo: "autobus" })).status, 400);
  assert.equal((await comoB("POST", "/unidades", { nombre: "X", ruta: "101", tipo: "autobus" })).status, 400);
  assert.equal(store.routes.find((r) => r.id === "15A").name, "Ruta 15-A");
});

test("una ruta que usa una unidad no se borra; sin unidades sí", async () => {
  store.units["U-AAAAAA"].routeId = "15A";
  assert.equal((await comoA("DELETE", "/rutas/15A")).status, 409);
  store.units["U-AAAAAA"].routeId = "101";
  assert.equal((await comoA("DELETE", "/rutas/15A")).status, 204);
  assert.ok(!store.routes.some((r) => r.id === "15A"));
});
