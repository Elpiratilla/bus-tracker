// Formulario "Pedir el sensor" de la portada: guarda a la persona interesada en la tabla leads.
// Público, con límite por IP y un campo trampa para bots.
const router = require("express").Router();
const { db } = require("../db");
const { rateLimit } = require("../middleware/empresa");
const { text } = require("../texto");

// Campo opcional: vacío = null; si trae algo, tiene que cumplir el largo (undefined si no)
const opcional = (v, max) => (v == null || String(v).trim() === "" ? null : text(v, 1, max) ?? undefined);

router.post("/", rateLimit(5, 10 * 60 * 1000), async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: "El formulario no está disponible ahora. Escríbenos por WhatsApp." });
    const b = req.body || {};
    // Campo escondido: una persona no lo ve ni lo llena; un bot sí
    if (b.sitio) return res.status(201).json({ ok: true });

    const lead = {
      name: text(b.nombre, 2, 80),
      company: opcional(b.empresa, 80),
      phone: text(b.telefono, 7, 30),
      email: opcional(b.correo, 120),
      city: opcional(b.ciudad, 80),
      message: opcional(b.mensaje, 600),
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
