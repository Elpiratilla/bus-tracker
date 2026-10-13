// Formulario "Pedir el sensor" de la portada: guarda a la persona interesada en la tabla leads.
// Público, con límite por IP y un campo trampa para bots.
const router = require("express").Router();
const { db } = require("../db");
const { rateLimit } = require("../middleware/empresa");

function text(v, min, max) {
  if (v == null || v === "") return min === 0 ? null : undefined;
  if (typeof v !== "string") return undefined;
  const t = v.trim().replace(/\s+/g, " ");
  if (!t && min === 0) return null;
  return t.length >= min && t.length <= max ? t : undefined;
}

router.post("/", rateLimit(5, 10 * 60 * 1000), async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: "El formulario no está disponible ahora. Escríbenos por WhatsApp." });
    const b = req.body || {};
    // Campo escondido: una persona no lo ve ni lo llena; un bot sí
    if (b.sitio) return res.status(201).json({ ok: true });

    const lead = {
      name: text(b.nombre, 2, 80),
      company: text(b.empresa, 0, 80),
      phone: text(b.telefono, 7, 30),
      email: text(b.correo, 0, 120),
      city: text(b.ciudad, 0, 80),
      message: text(b.mensaje, 0, 600),
      units: b.unidades == null || b.unidades === "" ? null : Number(b.unidades),
    };
    if (!lead.name) return res.status(400).json({ error: "Escribe tu nombre", campo: "nombre" });
    if (!lead.phone || !/^[+\d][\d\s-]{6,}$/.test(lead.phone)) return res.status(400).json({ error: "Escribe un teléfono válido, por ejemplo 7123-4567", campo: "telefono" });
    if (lead.email === undefined || (lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email))) return res.status(400).json({ error: "Revisa el correo", campo: "correo" });
    if (lead.units !== null && !(Number.isInteger(lead.units) && lead.units >= 1 && lead.units <= 5000)) return res.status(400).json({ error: "Las unidades van de 1 a 5000", campo: "unidades" });
    for (const k of ["company", "city", "message"]) {
      if (lead[k] === undefined) return res.status(400).json({ error: "Uno de los campos es demasiado largo" });
    }

    const { error } = await db.from("leads").insert(lead);
    if (error) throw new Error(error.message);
    res.status(201).json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
