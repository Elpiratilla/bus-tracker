// Panel del empresario: su flota, unidades, mantenimiento y reportes.
// Todas las rutas (menos /codigo) requieren sesión; cada empresa solo ve sus unidades.
const crypto = require("crypto");
const router = require("express").Router();
const { routes, buses, units, retired } = require("../store");
const { db, select, flush, unitFromRow } = require("../db");
const { hashKey } = require("../middleware/auth");
const { requireUser, requireCompany, requireAdmin, forgetToken, rateLimit } = require("../middleware/empresa");

const ONLINE_MS = 60 * 1000; // sin señal en 1 min = fuera de línea
const iso = (t) => (t ? new Date(t).toISOString() : null);
const round1 = (n) => Math.round((n || 0) * 10) / 10;
const stopName = (routeId, stopId) =>
  routes.find((r) => r.id === routeId)?.stops.find((s) => s.id === stopId)?.name ?? null;

// Texto limpio dentro de un largo permitido (null si no cumple)
function text(v, min, max) {
  if (typeof v !== "string") return null;
  const t = v.trim().replace(/\s+/g, " ");
  return t.length >= min && t.length <= max ? t : null;
}
const normCode = (c) => (typeof c === "string" ? c.trim().toUpperCase() : "");

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O ni 1/I para no confundirlos
const randomId = (n) => Array.from({ length: n }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join("");
const newApiKey = () => `go503_${crypto.randomBytes(24).toString("base64url")}`;

// Unidad de la empresa en sesión (o null)
const myUnit = (req) => {
  const u = units[req.params.id];
  return u && u.companyId === req.company.id ? u : null;
};
const myUnits = (req) => Object.values(units).filter((u) => u.companyId === req.company.id);

// ---------- Cuenta ----------

// ¿El código de invitación existe y está libre? (antes de crear la cuenta)
router.post("/codigo", rateLimit(20, 60 * 1000), async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: "Supabase no está configurado en el servidor" });
    const { data } = await db.from("invite_codes").select("code").eq("code", normCode(req.body.codigo))
      .is("used_by", null).maybeSingle();
    res.json({ valido: Boolean(data) });
  } catch (err) { next(err); }
});

// Crea la empresa con el código (se llama al primer inicio de sesión después de registrarse)
router.post("/activar", rateLimit(10, 60 * 1000), requireUser, async (req, res, next) => {
  try {
    if (req.company) return res.status(409).json({ error: "Tu cuenta ya tiene una empresa" });
    const name = text(req.body.empresa, 2, 80);
    if (!name) return res.status(400).json({ error: "Escribe el nombre de tu empresa (2 a 80 letras)" });

    // Reservar el código de forma atómica: solo funciona si nadie lo ha usado
    const { data: claimed } = await db.from("invite_codes")
      .update({ used_by: req.user.id, used_at: new Date().toISOString() })
      .eq("code", normCode(req.body.codigo)).is("used_by", null).select("code");
    if (!claimed?.length) return res.status(400).json({ error: "El código no existe o ya fue usado" });

    const { data: company, error } = await db.from("companies")
      .insert({ name, owner_id: req.user.id }).select("id, name, is_admin").single();
    if (error) {
      await db.from("invite_codes").update({ used_by: null, used_at: null }).eq("code", claimed[0].code);
      throw new Error(error.message);
    }
    forgetToken(req.token);
    res.status(201).json({ empresa: company });
  } catch (err) { next(err); }
});

// ---------- Administración: códigos de invitación ----------

router.get("/admin/codigos", requireAdmin, async (_req, res, next) => {
  try {
    const codes = await select(db.from("invite_codes").select("code, note, used_by, used_at, created_at")
      .order("created_at", { ascending: false }).limit(200));
    const owners = codes.map((c) => c.used_by).filter(Boolean);
    const companies = owners.length ? await select(db.from("companies").select("name, owner_id").in("owner_id", owners)) : [];
    res.json(codes.map((c) => ({
      codigo: c.code, nota: c.note, creado: c.created_at, usado: c.used_at,
      empresa: companies.find((x) => x.owner_id === c.used_by)?.name ?? null,
    })));
  } catch (err) { next(err); }
});

router.post("/admin/codigos", requireAdmin, async (req, res, next) => {
  try {
    const nota = req.body.nota ? text(req.body.nota, 1, 120) : null;
    if (req.body.nota && !nota) return res.status(400).json({ error: "La nota puede tener hasta 120 letras" });
    const codigo = `GO503-${randomId(4)}-${randomId(4)}`;
    await select(db.from("invite_codes").insert({ code: codigo, note: nota }).select("code"));
    res.status(201).json({ codigo });
  } catch (err) { next(err); }
});

router.get("/yo", requireUser, (req, res) =>
  res.json({ usuario: { email: req.user.email }, empresa: req.company }));

// ---------- Flota en vivo ----------

router.get("/flota", requireCompany, (req, res) => {
  const now = Date.now();
  res.json(myUnits(req).map((u) => {
    const live = buses[u.busId] || {};
    return {
      id: u.busId, nombre: u.name, placa: u.plate, tipo: u.type, ruta: u.routeId,
      lat: live.lat ?? null, lng: live.lng ?? null,
      velocidad: live.speed ?? null, rumbo: live.heading ?? null,
      enLinea: Boolean(live.updatedAt && now - live.updatedAt < ONLINE_MS),
      ultimaSenal: iso(live.updatedAt),
      parada: live.atStop ? stopName(live.routeId, live.atStop) : null,
      odometroKm: round1(u.odometerKm), horasMotor: round1(u.engineHours), intervaloAceiteKm: u.oilIntervalKm,
      temperatura: live.engineTemp ?? null, combustible: live.fuel ?? null,
    };
  }));
});

// ---------- Unidades ----------

function validUnitFields(body, partial) {
  const out = {};
  if (!partial || body.nombre !== undefined) {
    out.name = text(body.nombre, 1, 40);
    if (!out.name) return { error: "El nombre de la unidad debe tener de 1 a 40 letras" };
  }
  if (!partial || body.placa !== undefined) {
    out.plate = body.placa ? text(body.placa, 3, 12)?.toUpperCase() : null;
    if (body.placa && !out.plate) return { error: "La placa debe tener de 3 a 12 caracteres" };
  }
  if (!partial || body.ruta !== undefined) {
    out.route_id = body.ruta;
    if (!routes.some((r) => r.id === body.ruta)) return { error: "Escoge una ruta de la lista" };
  }
  if (!partial || body.tipo !== undefined) {
    out.type = body.tipo;
    if (!["autobus", "microbus"].includes(body.tipo)) return { error: "El tipo debe ser autobús o microbús" };
  }
  if (body.intervaloAceiteKm !== undefined) {
    const n = Number(body.intervaloAceiteKm);
    if (!Number.isInteger(n) || n < 500 || n > 50000) return { error: "El intervalo de aceite va de 500 a 50,000 km" };
    out.oil_interval_km = n;
  }
  if (body.odometroKm !== undefined) {
    const n = Number(body.odometroKm);
    if (!Number.isFinite(n) || n < 0 || n > 5000000) return { error: "El kilometraje no es válido" };
    out.odometer_km = n;
  }
  return { fields: out };
}

// Registrar unidad: devuelve la clave del sensor UNA sola vez (solo se guarda su hash)
router.post("/unidades", requireCompany, async (req, res, next) => {
  try {
    const { error, fields } = validUnitFields(req.body, false);
    if (error) return res.status(400).json({ error });
    if (myUnits(req).length >= 200) return res.status(400).json({ error: "Llegaste al límite de 200 unidades" });

    const id = `U-${randomId(6)}`;
    const clave = newApiKey();
    const row = await select(db.from("buses").insert({ id, company_id: req.company.id, ...fields,
      api_key_hash: hashKey(clave), updated_at: new Date().toISOString() }).select("*").single());
    units[id] = unitFromRow(row);
    res.status(201).json({ id, clave });
  } catch (err) { next(err); }
});

router.patch("/unidades/:id", requireCompany, async (req, res, next) => {
  try {
    const unit = myUnit(req);
    if (!unit) return res.status(404).json({ error: "Esa unidad no existe en tu flota" });
    const { error, fields } = validUnitFields(req.body, true);
    if (error) return res.status(400).json({ error });
    const row = await select(db.from("buses").update(fields).eq("id", unit.busId).select("*").single());
    units[unit.busId] = unitFromRow(row);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Nueva clave del sensor (la anterior deja de funcionar)
router.post("/unidades/:id/clave", requireCompany, async (req, res, next) => {
  try {
    const unit = myUnit(req);
    if (!unit) return res.status(404).json({ error: "Esa unidad no existe en tu flota" });
    const clave = newApiKey();
    await select(db.from("buses").update({ api_key_hash: hashKey(clave) }).eq("id", unit.busId).select("id"));
    unit.apiKeyHash = hashKey(clave);
    res.json({ id: unit.busId, clave });
  } catch (err) { next(err); }
});

router.delete("/unidades/:id", requireCompany, async (req, res, next) => {
  try {
    const unit = myUnit(req);
    if (!unit) return res.status(404).json({ error: "Esa unidad no existe en tu flota" });
    // Primero dejar de aceptar su sensor y esperar lo que estaba por guardarse; luego borrar
    retired.add(unit.busId);
    delete units[unit.busId];
    delete buses[unit.busId];
    await flush(`bus:${unit.busId}`);
    await select(db.from("buses").delete().eq("id", unit.busId).select("id"));
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Historial de las últimas horas (para las gráficas de la unidad)
router.get("/unidades/:id/historial", requireCompany, async (req, res, next) => {
  try {
    const unit = myUnit(req);
    if (!unit) return res.status(404).json({ error: "Esa unidad no existe en tu flota" });
    const horas = Math.min(72, Math.max(1, Number(req.query.horas) || 24));
    const rows = await select(db.from("telemetry").select("ts, data").eq("bus_id", unit.busId)
      .gte("ts", new Date(Date.now() - horas * 3600000).toISOString()).order("ts").limit(5000));
    res.json(rows.map((r) => ({ ts: r.ts, velocidad: r.data.speed ?? null, temperatura: r.data.engineTemp ?? null,
      combustible: r.data.fuel ?? null, rpm: r.data.rpm ?? null })));
  } catch (err) { next(err); }
});

// ---------- Mantenimiento ----------

const KINDS = ["aceite", "frenos", "llantas", "general", "otro"];

router.get("/mantenimiento", requireCompany, async (req, res, next) => {
  try {
    const list = myUnits(req);
    const ids = list.map((u) => u.busId);
    const services = ids.length ? await select(db.from("service_records").select("bus_id, kind, odometer_km, done_at")
      .in("bus_id", ids).order("done_at", { ascending: false }).limit(2000)) : [];

    res.json(list.map((u) => {
      const mine = services.filter((s) => s.bus_id === u.busId);
      const oil = mine.find((s) => s.kind === "aceite");
      const desde = u.odometerKm - (oil ? oil.odometer_km : 0);
      const live = buses[u.busId] || {};
      return {
        id: u.busId, nombre: u.name, placa: u.plate,
        odometroKm: round1(u.odometerKm), horasMotor: round1(u.engineHours),
        intervaloAceiteKm: u.oilIntervalKm, kmDesdeAceite: round1(desde),
        estadoAceite: desde >= u.oilIntervalKm ? "vencido" : desde >= u.oilIntervalKm * 0.9 ? "pronto" : "al-dia",
        temperatura: live.engineTemp ?? null, combustible: live.fuel ?? null,
        fallas: Array.isArray(live.dtc) ? live.dtc.slice(0, 10) : [],
        ultimoServicio: mine[0] ? { tipo: mine[0].kind, fecha: mine[0].done_at, km: round1(mine[0].odometer_km) } : null,
      };
    }));
  } catch (err) { next(err); }
});

router.post("/unidades/:id/servicios", requireCompany, async (req, res, next) => {
  try {
    const unit = myUnit(req);
    if (!unit) return res.status(404).json({ error: "Esa unidad no existe en tu flota" });
    if (!KINDS.includes(req.body.tipo)) return res.status(400).json({ error: "Escoge el tipo de servicio" });
    const notas = req.body.notas ? text(req.body.notas, 1, 500) : null;
    if (req.body.notas && !notas) return res.status(400).json({ error: "Las notas pueden tener hasta 500 letras" });
    await select(db.from("service_records").insert({ bus_id: unit.busId, kind: req.body.tipo,
      odometer_km: unit.odometerKm, engine_hours: unit.engineHours, notes: notas }).select("id"));
    res.status(201).json({ ok: true });
  } catch (err) { next(err); }
});

router.get("/unidades/:id/servicios", requireCompany, async (req, res, next) => {
  try {
    const unit = myUnit(req);
    if (!unit) return res.status(404).json({ error: "Esa unidad no existe en tu flota" });
    const rows = await select(db.from("service_records").select("kind, odometer_km, notes, done_at")
      .eq("bus_id", unit.busId).order("done_at", { ascending: false }).limit(50));
    res.json(rows.map((r) => ({ tipo: r.kind, km: round1(r.odometer_km), notas: r.notes, fecha: r.done_at })));
  } catch (err) { next(err); }
});

// ---------- Reportes ----------

router.get("/reportes", requireCompany, async (req, res, next) => {
  try {
    const dias = Math.min(90, Math.max(1, Number(req.query.dias) || 7));
    const since = new Date(Date.now() - dias * 86400000).toISOString();
    const args = { p_company: req.company.id, p_since: since };
    const [legs, trips] = await Promise.all([
      select(db.rpc("report_leg_times", args)),
      select(db.rpc("report_trips_per_day", args)),
    ]);

    // Tramos en el orden de la ruta (ida y luego regreso), con minutos promedio por hora del día
    const tramos = [];
    for (const route of routes) {
      for (const dir of ["ida", "regreso"]) {
        const stops = route.directions[dir];
        stops.slice(1).forEach((stop, i) => {
          const from = stops[i];
          const rows = legs.filter((l) => l.route_id === route.id && l.direction === dir
            && l.from_stop === from.id && l.to_stop === stop.id);
          if (!rows.length) return;
          const viajes = rows.reduce((a, r) => a + r.trips, 0);
          const porHora = Object.fromEntries(rows.map((r) => [r.hour, round1(r.avg_seconds / 60)]));
          const promedio = rows.reduce((a, r) => a + r.avg_seconds * r.trips, 0) / viajes / 60;
          tramos.push({ ruta: route.id, sentido: dir, hacia: stops.at(-1).name, desde: from.name, hasta: stop.name,
            viajes, promedioMin: round1(promedio), porHora });
        });
      }
    }

    const vueltas = myUnits(req).map((u) => ({
      id: u.busId, nombre: u.name,
      porDia: Object.fromEntries(trips.filter((t) => t.bus_id === u.busId).map((t) => [t.day, t.trips])),
    }));
    res.json({ dias, tramos, vueltas });
  } catch (err) { next(err); }
});

module.exports = router;
