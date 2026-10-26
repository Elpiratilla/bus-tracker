// Texto limpio dentro de un largo permitido (null si no cumple)
function text(v, min, max) {
  if (typeof v !== "string") return null;
  const t = v.trim().replace(/\s+/g, " ");
  return t.length >= min && t.length <= max ? t : null;
}

module.exports = { text };
