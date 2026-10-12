// Crea (o promueve) una cuenta administradora del panel de go503.
//   npm run admin                       -> crea admin@go503.test con contraseña aleatoria (se guarda en .env)
//   npm run admin -- correo@ejemplo.com -> si ya tiene cuenta, la vuelve administradora
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("Faltan SUPABASE_URL y SUPABASE_SECRET_KEY en .env");
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const email = (process.argv[2] || "admin@go503.test").trim().toLowerCase();
const ENV = path.join(__dirname, "..", ".env");

async function findUser() {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data.users.find((x) => x.email === email);
    if (u || data.users.length < 200) return u || null;
  }
  return null;
}

// Guarda (o reemplaza) una variable en .env
function saveEnv(key, value) {
  let text = fs.existsSync(ENV) ? fs.readFileSync(ENV, "utf8") : "";
  const line = `${key}=${value}`;
  text = new RegExp(`^${key}=.*$`, "m").test(text) ? text.replace(new RegExp(`^${key}=.*$`, "m"), line) : `${text.trimEnd()}\n${line}\n`;
  fs.writeFileSync(ENV, text);
}

(async () => {
  let user = await findUser();
  if (!user) {
    if (process.argv[2]) {
      console.error(`${email} no tiene cuenta. Que se registre primero en /empresa/ o usa: npm run admin`);
      process.exit(1);
    }
    const password = crypto.randomBytes(12).toString("base64url");
    const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    user = data.user;
    saveEnv("ADMIN_EMAIL", email);
    saveEnv("ADMIN_PASSWORD", password);
    console.log(`Cuenta creada: ${email}. La contraseña quedó en .env (ADMIN_PASSWORD).`);
  }

  const { data: company } = await db.from("companies").select("id, name").eq("owner_id", user.id).maybeSingle();
  if (company) {
    await db.from("companies").update({ is_admin: true }).eq("id", company.id);
    console.log(`${company.name} ahora es administradora.`);
  } else {
    const { error } = await db.from("companies").insert({ name: "go503", owner_id: user.id, is_admin: true });
    if (error) throw error;
    console.log(`Empresa "go503" creada como administradora para ${email}.`);
  }
  console.log("Entra en http://localhost:3000/empresa/");
})().catch((err) => {
  console.error(`No se pudo: ${err.message}`);
  process.exit(1);
});
