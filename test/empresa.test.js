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
db.from = () => ({ select() { return this; }, eq(_k, v) { this.v = v; return this; },
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

const comoB = (method, path, body) => fetch(`${base}/api/empresa${path}`, {
  method, headers: { "Content-Type": "application/json", Authorization: "Bearer user-b" }, body: body && JSON.stringify(body),
});

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
