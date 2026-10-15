// Recorridos de colegio: cada microbús escolar tiene su propia ruta privada (routes.company_id).
// ida = recorrido de la mañana (casas -> colegio), regreso = el de la tarde (colegio -> casas).
// Las paradas las marca el motorista desde su celular (public/motorista.html), en el orden de la
// mañana y el colegio al final. El regreso son las mismas paradas al revés.
const crypto = require("crypto");
const { routes, trips, geofence } = require("./store");
const { persist } = require("./db");
const { distanceM } = require("./geo");

const MAX_STOPS = 40;
const SAME_STOP_M = 30; // otra parada a menos de esto es la misma esquina

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const randomId = (n) => Array.from({ length: n }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join("");

// Recorrido privado de una unidad (o null si usa una ruta pública o aún no tiene)
function schoolRoute(unit) {
  const route = unit && routes.find((r) => r.id === unit.routeId);
  return route?.companyId ? route : null;
}

// El recorrido de la unidad; si no tiene, lo crea vacío y se lo asigna
function ensureSchoolRoute(unit) {
  const found = schoolRoute(unit);
  if (found) return found;
  const route = { id: `C-${randomId(6)}`, name: unit.name || "Recorrido", type: "microbus",
    companyId: unit.companyId, stops: [], directions: { ida: [], regreso: [] } };
  routes.push(route);
  unit.routeId = route.id;
  const queue = `ruta:${route.id}`;
  persist("recorrido", (db) => db.from("routes").insert({ id: route.id, name: route.name, type: "microbus",
    company_id: unit.companyId, sort: 1000 }), queue);
  persist("recorrido", (db) => db.from("buses").update({ route_id: route.id }).eq("id", unit.busId), queue);
  return route;
}

function setStops(route, ida) {
  route.directions.ida = ida;
  route.directions.regreso = [...ida].reverse();
  route.stops = [...ida];
}

// Nueva parada al final del recorrido de la mañana. Devuelve { stop } o { error }
function addStop(unit, name, lat, lng) {
  const route = ensureSchoolRoute(unit);
  const ida = route.directions.ida;
  if (ida.length >= MAX_STOPS) return { error: `El recorrido ya tiene ${MAX_STOPS} paradas` };
  const near = ida.find((s) => distanceM(s, { lat, lng }) < SAME_STOP_M);
  if (near) return { error: `Ya hay una parada aquí: ${near.name}` };

  const stop = { id: `p-${randomId(8).toLowerCase()}`, name, lat, lng };
  const position = ida.length;
  setStops(route, [...ida, stop]);
  const queue = `ruta:${route.id}`;
  persist("parada", (db) => db.from("stops").insert(stop), queue);
  persist("parada", (db) => db.from("route_stops").insert({ route_id: route.id, direction: "ida", position, stop_id: stop.id }), queue);
  return { stop };
}

// Borra todas las paradas para marcarlas de nuevo (ej. cambió de colegio o de niños)
function clearStops(unit) {
  const route = schoolRoute(unit);
  if (!route) return;
  const ids = route.directions.ida.map((s) => s.id);
  setStops(route, []);
  const key = `${unit.busId}:${route.id}`;
  delete trips[key];
  delete geofence[key];
  const queue = `ruta:${route.id}`;
  persist("paradas", (db) => db.from("route_stops").delete().eq("route_id", route.id), queue);
  persist("vuelta", (db) => db.from("bus_trips").delete().eq("route_id", route.id), queue);
  if (ids.length) persist("paradas", (db) => db.from("stops").delete().in("id", ids), queue);
}

// Quita el recorrido de memoria (al eliminar la unidad). Devuelve los ids de sus paradas para borrarlas
function dropSchoolRoute(unit) {
  const route = schoolRoute(unit);
  if (!route) return null;
  routes.splice(routes.indexOf(route), 1);
  return { id: route.id, stopIds: route.directions.ida.map((s) => s.id) };
}

module.exports = { schoolRoute, ensureSchoolRoute, addStop, clearStops, dropSchoolRoute, MAX_STOPS };
