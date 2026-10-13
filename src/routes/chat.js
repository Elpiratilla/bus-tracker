// Chat "¿Qué ruta me lleva?": entiende preguntas sencillas y busca rutas directas o con un transbordo.
// No usa IA: reconoce los nombres de las paradas (y algunos apodos) dentro del mensaje.
// POST /api/chat { mensaje, lang?: "es"|"en", lat?, lng? } → { texto, rutas: [{ruta, sentido, texto}], sugerencias: [] }
const router = require("express").Router();
const { routes } = require("../store");
const { routeStatus } = require("../eta");
const { distanceM } = require("../geo");
const { rateLimit } = require("../middleware/empresa");

const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

// Otros nombres con que la gente llama a cada parada (por id de parada)
const APODOS = {
  "t-ori": ["terminal de oriente", "terminal oriente", "la terminal", "oriente"],
  centro: ["centro historico", "el centro", "centro", "catedral", "plaza libertad", "palacio nacional", "downtown"],
  "p-inf": ["parque infantil"],
  metro: ["metrocentro", "metro centro", "metro"],
  "z-rosa": ["zona rosa", "san benito"],
  ues: ["universidad de el salvador", "universidad nacional", "la nacional", "ues", "universidad", "university"],
  escalon: ["colonia escalon", "escalon"],
  "a-cusc": ["antiguo cuscatlan", "antiguo", "multiplaza", "gran via"],
  rosales: ["hospital rosales", "rosales", "hospital"],
  soya: ["soyapango", "soya"],
  merliot: ["ciudad merliot", "merliot"],
};

// Todas las paradas (sin repetir) con sus nombres buscables, del más largo al más corto
function lugares() {
  const porId = new Map();
  for (const r of routes) for (const s of r.stops) if (!porId.has(s.id)) porId.set(s.id, s);
  const nombres = [];
  for (const [id, stop] of porId) {
    for (const n of new Set([norm(stop.name), ...(APODOS[id] || [])])) nombres.push({ n, stop });
  }
  return { porId, nombres: nombres.sort((a, b) => b.n.length - a.n.length) };
}

// Busca paradas en el mensaje y marca cuál es el origen (de/desde/from) y cuál el destino
function leer(msg) {
  const { nombres } = lugares();
  let texto = ` ${norm(msg)} `;
  const hallados = [];
  for (const { n, stop } of nombres) {
    const i = texto.indexOf(` ${n} `);
    if (i < 0 || hallados.some((h) => h.stop.id === stop.id)) continue;
    const antes = texto.slice(0, i).trim().split(" ").slice(-2).join(" ");
    hallados.push({ stop, i, origen: /(^| )(de|desde|del|from)$/.test(antes) });
    texto = texto.slice(0, i + 1) + "#".repeat(n.length) + texto.slice(i + 1 + n.length); // no volver a encontrarlo
  }
  hallados.sort((a, b) => a.i - b.i);
  let origen = null, destino = null;
  if (hallados.length >= 2) {
    const o = hallados.find((h) => h.origen) || hallados[0];
    origen = o.stop;
    destino = hallados.find((h) => h !== o).stop;
  } else if (hallados.length === 1) {
    if (hallados[0].origen) origen = hallados[0].stop; else destino = hallados[0].stop;
  }
  const t = norm(msg);
  const ruta = routes.find((r) => new RegExp(`(^| )${r.id}( |$)`).test(t));
  return { origen, destino, ruta, t };
}

// Cuándo llega el próximo bus de esa ruta y sentido a una parada (minutos o null)
function llega(route, dir, stopId, now = Date.now()) {
  const { stops, lastIdx, times } = routeStatus(route, dir, now);
  const i = stops.findIndex((s) => s.id === stopId);
  const t = i > lastIdx ? times[i] : null;
  return t && t > now - 60 * 1000 ? Math.max(0, Math.round((t - now) / 60000)) : null;
}

// Minutos de viaje entre dos paradas del mismo sentido (con los tiempos medidos)
function viaje(route, dir, a, b) {
  const { legs } = routeStatus(route, dir);
  let s = 0;
  for (let i = a + 1; i <= b; i++) s += legs[i] || 0;
  return Math.max(1, Math.round(s / 60));
}

// Todos los tramos directos: ruta + sentido que pasan por A y después por B
function directos(a, b) {
  const out = [];
  for (const route of routes) for (const dir of ["ida", "regreso"]) {
    const stops = route.directions[dir];
    const ia = stops.findIndex((s) => s.id === a.id), ib = stops.findIndex((s) => s.id === b.id);
    if (ia >= 0 && ib > ia) out.push({ route, dir, ia, ib, paradas: ib - ia, hacia: stops.at(-1).name });
  }
  return out.sort((x, y) => x.paradas - y.paradas);
}

// Con un transbordo: A → T1 en una ruta, T1 → B en otra. Si T1 y T2 son paradas distintas
// a menos de 900 m, se camina de una a otra (por ejemplo, de Zona Rosa a Colonia Escalón).
const CAMINAR_M = 900;
function conTransbordo(a, b) {
  const { porId } = lugares();
  const todas = [...porId.values()];
  let mejor = null;
  for (const t1 of todas) {
    // t1 = a: se empieza caminando, sin bus antes
    const p1 = t1.id === a.id ? null : directos(a, t1)[0];
    if (!p1 && t1.id !== a.id) continue;
    for (const t2 of todas) {
      const m = t1.id === t2.id ? 0 : distanceM(t1, t2);
      if (m > CAMINAR_M || (!p1 && m === 0)) continue;
      const p2 = t2.id === b.id ? null : directos(t2, b)[0];
      if (t2.id !== b.id && (!p2 || p2.route === p1?.route)) continue;
      if (t2.id === b.id && (m === 0 || !p1)) continue;
      const total = (p1 ? p1.paradas : 0) + (p2 ? p2.paradas : 0) + m / 500;
      if (!mejor || total < mejor.total) mejor = { t: t1, t2, camina: Math.max(1, Math.round(m / 80)), p1, p2, total };
    }
  }
  return mejor;
}

const TXT = {
  es: {
    hola: "Hola. Dime a dónde vas y te digo qué ruta tomar. Por ejemplo: «¿Cómo llego a Metrocentro?» o «de Soyapango a la UES».",
    noLugar: "No encontré ese lugar en las rutas que tenemos. Por ahora cubrimos estas paradas:",
    mismo: "El origen y el destino son la misma parada.",
    directo: (o, d, p) => `De ${o} a ${d} toma la ruta ${p.route.id} hacia ${p.hacia}. Son ${p.paradas} ${p.paradas === 1 ? "parada" : "paradas"}, unos ${p.min} min de viaje.`,
    llega: (r, o, m) => m === 0 ? `La ${r} ya está llegando a ${o}.` : `La próxima ${r} pasa por ${o} en ${m} min.`,
    sinBus: (r) => `Ahorita no hay un bus de la ${r} reportando en ese sentido.`,
    transbordo: (o, d, x) => "No hay una ruta directa."
      + (x.p1 ? (x.p1.hacia === x.t.name ? ` Toma la ${x.p1.route.id} hasta ${x.t.name}.` : ` Toma la ${x.p1.route.id} hacia ${x.p1.hacia} y bájate en ${x.t.name}.`) : "")
      + (x.t2.id !== x.t.id ? ` Camina unos ${x.camina} min hasta ${x.t2.name}.` : "")
      + (x.p2 ? (x.p2.hacia === d ? ` Ahí toma la ${x.p2.route.id} hasta ${d}.` : ` Ahí toma la ${x.p2.route.id} hacia ${x.p2.hacia} y bájate en ${d}.`) : ""),
    nada: (o, d) => `No encontré cómo ir de ${o} a ${d} con las rutas que tenemos, ni con un transbordo.`,
    aDestino: (d) => `A ${d} te llevan:`,
    linea: (p, sube) => `la ${p.route.id} hacia ${p.hacia}: súbete en ${sube}.`,
    o: " o ",
    desdeOrigen: (o) => `De ${o} salen:`,
    lineaSale: (p, pasa) => `la ${p.route.id} hacia ${p.hacia}, pasa por ${pasa}.`,
    cerca: (s, m) => `La parada más cerca de ti es ${s} (a ${m} min caminando).`,
    rutaInfo: (r, a, b, c) => `La ${r} va de ${a} a ${b}, pasando por ${c}.`,
    rutaAhora: (r, h, s, m) => `La ${r} hacia ${h} llega a ${s} en ${m} min.`,
    rutaSinBus: (r) => `Ahorita no hay buses de la ${r} reportando.`,
    ver: (r, h) => `Ver la ${r} hacia ${h}`,
    sug: ["¿Cómo llego a Metrocentro?", "De Soyapango a la UES", "¿Cuándo pasa la 101?", "Usar mi ubicación"],
    destinoPara: (n) => `¿Cómo llego a ${n}?`,
  },
  en: {
    hola: "Hi. Tell me where you're going and I'll tell you which route to take. For example: “How do I get to Metrocentro?” or “from Soyapango to the UES”.",
    noLugar: "I couldn't find that place on our routes. For now we cover these stops:",
    mismo: "The start and destination are the same stop.",
    directo: (o, d, p) => `From ${o} to ${d}, take route ${p.route.id} toward ${p.hacia}. It's ${p.paradas} ${p.paradas === 1 ? "stop" : "stops"}, about ${p.min} min.`,
    llega: (r, o, m) => m === 0 ? `The ${r} is arriving at ${o} now.` : `The next ${r} reaches ${o} in ${m} min.`,
    sinBus: (r) => `No ${r} bus is reporting in that direction right now.`,
    transbordo: (o, d, x) => "There's no direct route."
      + (x.p1 ? (x.p1.hacia === x.t.name ? ` Take the ${x.p1.route.id} to ${x.t.name}.` : ` Take the ${x.p1.route.id} toward ${x.p1.hacia} and get off at ${x.t.name}.`) : "")
      + (x.t2.id !== x.t.id ? ` Walk about ${x.camina} min to ${x.t2.name}.` : "")
      + (x.p2 ? (x.p2.hacia === d ? ` Then take the ${x.p2.route.id} to ${d}.` : ` Then take the ${x.p2.route.id} toward ${x.p2.hacia} and get off at ${d}.`) : ""),
    nada: (o, d) => `I couldn't find a way from ${o} to ${d} on our routes, even with one transfer.`,
    aDestino: (d) => `To get to ${d}:`,
    linea: (p, sube) => `the ${p.route.id} toward ${p.hacia}: board at ${sube}.`,
    o: " or ",
    desdeOrigen: (o) => `From ${o} you can take:`,
    lineaSale: (p, pasa) => `the ${p.route.id} toward ${p.hacia}, stopping at ${pasa}.`,
    cerca: (s, m) => `Your closest stop is ${s} (${m} min walk).`,
    rutaInfo: (r, a, b, c) => `The ${r} runs from ${a} to ${b}, through ${c}.`,
    rutaAhora: (r, h, s, m) => `The ${r} toward ${h} reaches ${s} in ${m} min.`,
    rutaSinBus: (r) => `No ${r} buses are reporting right now.`,
    ver: (r, h) => `See the ${r} toward ${h}`,
    sug: ["How do I get to Metrocentro?", "From Soyapango to the UES", "When does the 101 come?", "Use my location"],
    destinoPara: (n) => `How do I get to ${n}?`,
  },
};

const lista = (xs, o) => xs.length > 1 ? `${xs.slice(0, -1).join(", ")}${o}${xs.at(-1)}` : xs[0];

function responder({ mensaje, lang, lat, lng }) {
  const T = TXT[lang] || TXT.es;
  const { origen: o0, destino, ruta, t } = leer(mensaje);
  let origen = o0;
  const lineas = [];
  const botones = [];
  const boton = (route, dir) => {
    if (!botones.some((b) => b.ruta === route.id && b.sentido === dir)) {
      botones.push({ ruta: route.id, sentido: dir, texto: T.ver(route.id, route.directions[dir].at(-1).name) });
    }
  };

  // Sin origen pero con ubicación: salir de la parada más cercana (hasta 1.5 km)
  const aqui = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  if (!origen && aqui) {
    const { porId } = lugares();
    let best = null;
    for (const s of porId.values()) { const d = distanceM(aqui, s); if (!best || d < best.d) best = { s, d }; }
    if (best && best.d <= 1500 && (!destino || best.s.id !== destino.id)) {
      origen = best.s;
      lineas.push(T.cerca(best.s.name, Math.max(1, Math.round(best.d / 80))));
    }
  }

  if (origen && destino) {
    if (origen.id === destino.id) return { texto: T.mismo, rutas: [], sugerencias: T.sug };
    const ds = directos(origen, destino);
    if (ds.length) {
      const p = ds[0];
      p.min = viaje(p.route, p.dir, p.ia, p.ib);
      lineas.push(T.directo(origen.name, destino.name, p));
      const m = llega(p.route, p.dir, origen.id);
      lineas.push(m == null ? T.sinBus(p.route.id) : T.llega(p.route.id, origen.name, m));
      ds.forEach((d) => boton(d.route, d.dir));
    } else {
      const x = conTransbordo(origen, destino);
      if (x) { lineas.push(T.transbordo(origen.name, destino.name, x)); if (x.p1) boton(x.p1.route, x.p1.dir); if (x.p2) boton(x.p2.route, x.p2.dir); }
      else lineas.push(T.nada(origen.name, destino.name));
    }
  } else if (destino) {
    const llegan = [];
    for (const route of routes) for (const dir of ["ida", "regreso"]) {
      const stops = route.directions[dir];
      const i = stops.findIndex((s) => s.id === destino.id);
      if (i > 0) { llegan.push(T.linea({ route, hacia: stops.at(-1).name }, lista(stops.slice(0, i).map((s) => s.name), T.o))); boton(route, dir); }
    }
    lineas.push(T.aDestino(destino.name), ...llegan.map((l) => `• ${l}`));
  } else if (origen) {
    lineas.push(T.desdeOrigen(origen.name));
    for (const route of routes) for (const dir of ["ida", "regreso"]) {
      const stops = route.directions[dir];
      const i = stops.findIndex((s) => s.id === origen.id);
      if (i >= 0 && i < stops.length - 1) { lineas.push(`• ${T.lineaSale({ route, hacia: stops.at(-1).name }, lista(stops.slice(i + 1).map((s) => s.name), ", "))}`); boton(route, dir); }
    }
  } else if (ruta) {
    const s = ruta.stops;
    lineas.push(T.rutaInfo(ruta.id, s[0].name, s.at(-1).name, lista(s.slice(1, -1).map((x) => x.name), ", ")));
    let alguno = false;
    for (const dir of ["ida", "regreso"]) {
      const { stops, lastIdx, times } = routeStatus(ruta, dir);
      const next = lastIdx >= 0 && lastIdx < stops.length - 1 ? lastIdx + 1 : -1;
      const tt = next >= 0 ? times[next] : null;
      if (tt && tt > Date.now() - 60000) {
        alguno = true;
        lineas.push(T.rutaAhora(ruta.id, stops.at(-1).name, stops[next].name, Math.max(0, Math.round((tt - Date.now()) / 60000))));
      }
      boton(ruta, dir);
    }
    if (!alguno) lineas.push(T.rutaSinBus(ruta.id));
  } else if (!t || /^(hola|buenas|buenos dias|buenas tardes|buenas noches|hi|hello|hey|ayuda|help)( |$)/.test(t)) {
    return { texto: T.hola, rutas: [], sugerencias: T.sug };
  } else {
    const { porId } = lugares();
    return { texto: T.noLugar, rutas: [], sugerencias: [...porId.values()].map((s) => T.destinoPara(s.name)) };
  }
  return { texto: lineas.join("\n"), rutas: botones.slice(0, 4), sugerencias: [] };
}

router.post("/", rateLimit(30, 60 * 1000), (req, res) => {
  const b = req.body || {};
  const mensaje = typeof b.mensaje === "string" ? b.mensaje.slice(0, 300) : "";
  const lat = b.lat == null ? NaN : Number(b.lat), lng = b.lng == null ? NaN : Number(b.lng);
  res.json(responder({ mensaje, lang: b.lang === "en" ? "en" : "es", lat, lng }));
});

module.exports = router;
module.exports.responder = responder;
