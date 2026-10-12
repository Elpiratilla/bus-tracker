// go503 empresas: entrar, crear cuenta (con código) y recuperar contraseña
const { supa, authMessage, $, showMsg } = window.go503;

const msg = $("#msg");
const VIEWS = ["v-entrar", "v-crear", "v-olvide", "v-nueva", "v-correo"];

function show(view) {
  VIEWS.forEach((id) => { $(`#${id}`).hidden = id !== view; });
  $("#tabs").hidden = !["v-entrar", "v-crear"].includes(view);
  $("#tab-entrar").setAttribute("aria-selected", String(view === "v-entrar"));
  $("#tab-crear").setAttribute("aria-selected", String(view === "v-crear"));
  showMsg(msg, "");
  $(`#${view} input`)?.focus();
}

// Mientras se envía: botón desactivado y con texto de espera
async function busy(form, label, fn) {
  const btn = form.querySelector('button[type="submit"]');
  const text = btn.textContent;
  btn.disabled = true;
  btn.textContent = label;
  try { await fn(); } finally { btn.disabled = false; btn.textContent = text; }
}

$("#tab-entrar").addEventListener("click", () => show("v-entrar"));
$("#tab-crear").addEventListener("click", () => show("v-crear"));
$("#go-olvide").addEventListener("click", () => show("v-olvide"));
document.querySelectorAll("[data-back]").forEach((b) => b.addEventListener("click", () => show("v-entrar")));

// Flechas izquierda/derecha entre pestañas
$("#tabs").addEventListener("keydown", (e) => {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  const next = $("#tab-entrar").getAttribute("aria-selected") === "true" ? "crear" : "entrar";
  show(`v-${next}`);
  $(`#tab-${next}`).focus();
});

// ---------- Entrar ----------
$("#f-entrar").addEventListener("submit", (e) => {
  e.preventDefault();
  const email = $("#e-email").value.trim();
  const password = $("#e-pass").value;
  if (!email || !password) return showMsg(msg, "Escribe tu correo y tu contraseña.");
  busy(e.target, "Entrando…", async () => {
    const sb = await supa();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return showMsg(msg, authMessage(error));
    location.replace("panel.html");
  });
});

// ---------- Crear cuenta ----------
$("#f-crear").addEventListener("submit", (e) => {
  e.preventDefault();
  const codigo = $("#c-codigo").value.trim().toUpperCase();
  const empresa = $("#c-empresa").value.trim();
  const email = $("#c-email").value.trim();
  const password = $("#c-pass").value;
  $("#c-codigo").removeAttribute("aria-invalid");

  if (!codigo) return showMsg(msg, "Escribe tu código de invitación.");
  if (empresa.length < 2) return showMsg(msg, "Escribe el nombre de tu empresa.");
  if (!email) return showMsg(msg, "Escribe tu correo.");
  if (password.length < 8) return showMsg(msg, "La contraseña debe tener al menos 8 caracteres.");

  busy(e.target, "Creando cuenta…", async () => {
    // 1. El código debe existir y estar libre antes de crear la cuenta
    const check = await fetch("/api/empresa/codigo", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ codigo }),
    }).then((r) => r.json()).catch(() => ({ error: "No hay conexión. Revisa tu internet." }));
    if (check.error) return showMsg(msg, check.error);
    if (!check.valido) {
      $("#c-codigo").setAttribute("aria-invalid", "true");
      return showMsg(msg, "Ese código no existe o ya fue usado. Revísalo o pide uno nuevo.");
    }

    // 2. Crear la cuenta. La empresa se activa con el código al entrar por primera vez.
    const sb = await supa();
    const { data, error } = await sb.auth.signUp({
      email, password,
      options: { data: { empresa, codigo }, emailRedirectTo: `${location.origin}/empresa/panel.html` },
    });
    if (error) return showMsg(msg, authMessage(error));
    if (data.session) return location.replace("panel.html"); // sin confirmación de correo
    $("#correo-texto").textContent = `Te enviamos un enlace a ${email}. Ábrelo para confirmar tu cuenta y activar ${empresa}.`;
    show("v-correo");
  });
});

// ---------- Olvidé mi contraseña ----------
$("#f-olvide").addEventListener("submit", (e) => {
  e.preventDefault();
  const email = $("#o-email").value.trim();
  if (!email) return showMsg(msg, "Escribe tu correo.");
  busy(e.target, "Enviando…", async () => {
    const sb = await supa();
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/empresa/` });
    if (error) return showMsg(msg, authMessage(error));
    showMsg(msg, `Si ${email} tiene cuenta, te llegará un enlace en unos minutos.`, "ok");
  });
});

// ---------- Nueva contraseña ----------
$("#f-nueva").addEventListener("submit", (e) => {
  e.preventDefault();
  const password = $("#n-pass").value;
  if (password.length < 8) return showMsg(msg, "La contraseña debe tener al menos 8 caracteres.");
  busy(e.target, "Guardando…", async () => {
    const sb = await supa();
    const { error } = await sb.auth.updateUser({ password });
    if (error) return showMsg(msg, authMessage(error));
    location.replace("panel.html");
  });
});

// ---------- Al abrir la página ----------
(async () => {
  try {
    const sb = await supa();
    // Llegó desde el enlace de "olvidé mi contraseña"
    sb.auth.onAuthStateChange((event) => { if (event === "PASSWORD_RECOVERY") show("v-nueva"); });
    if (location.hash.includes("type=recovery")) return show("v-nueva");
    // Ya tiene sesión: directo al panel
    const { data: { session } } = await sb.auth.getSession();
    if (session) location.replace("panel.html");
  } catch (err) {
    showMsg(msg, err.message);
  }
})();
