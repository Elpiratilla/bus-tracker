// go503 empresas: sesión con Supabase Auth y llamadas a la API del panel
// (en su propio bloque: los demás scripts lo usan solo a través de window.go503)
(() => {

let client = null;

// Cliente de Supabase con la URL y la clave pública que da el servidor
async function supa() {
  if (client) return client;
  const res = await fetch("/api/config");
  const cfg = await res.json();
  if (!cfg.supabaseUrl || !cfg.supabaseKey) throw new Error("El panel aún no está configurado en el servidor.");
  client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
  return client;
}

// Llamada a /api/empresa con el token de la sesión
async function api(path, { method = "GET", body } = {}) {
  const sb = await supa();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    location.replace("/login.html");
    throw new Error("Sin sesión");
  }
  const res = await fetch(`/api/empresa${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: body && JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    await sb.auth.signOut();
    location.replace("/login.html");
  }
  if (!res.ok) {
    const err = new Error(data.error || `Error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// Mensajes de Supabase Auth, en español y diciendo qué hacer
function authMessage(error) {
  const m = (error && (error.message || error.code || "")).toLowerCase();
  if (m.includes("invalid login")) return "El correo o la contraseña no coinciden.";
  if (m.includes("not confirmed")) return "Confirma tu correo primero: abre el enlace que te enviamos.";
  if (m.includes("already registered") || m.includes("already been registered")) return "Ese correo ya tiene cuenta. Entra con tu contraseña.";
  if (m.includes("password should be") || m.includes("weak")) return "La contraseña debe tener al menos 8 caracteres.";
  if (m.includes("rate limit") || m.includes("security purposes")) return "Hiciste muchos intentos. Espera un momento y vuelve a probar.";
  if (m.includes("email") && m.includes("invalid")) return "Revisa el correo: parece que está mal escrito.";
  if (m.includes("fetch") || m.includes("network")) return "No hay conexión. Revisa tu internet.";
  return error?.message || "Algo falló. Intenta de nuevo.";
}

const $ = (sel, root = document) => root.querySelector(sel);

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function showMsg(node, text, kind = "error") {
  node.textContent = text;
  node.className = `msg msg--${kind}`;
  node.hidden = !text;
}

window.go503 = { supa, api, authMessage, $, el, showMsg };
})();
