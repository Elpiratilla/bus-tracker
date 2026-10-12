// Crea un código de invitación para que una empresa se registre en el panel.
// Uso: npm run codigo -- "Transportes Pérez"   (el nombre es solo una nota para ti)
require("dotenv").config();
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("Faltan SUPABASE_URL y SUPABASE_SECRET_KEY en .env");
  process.exit(1);
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const part = () => Array.from({ length: 4 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join("");
const code = `GO503-${part()}-${part()}`;
const note = process.argv.slice(2).join(" ") || null;

createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
  .from("invite_codes").insert({ code, note })
  .then(({ error }) => {
    if (error) { console.error(`No se pudo crear: ${error.message}`); process.exit(1); }
    console.log(`Código de invitación${note ? ` para ${note}` : ""}: ${code}`);
  });
