// go503: lo que comparten la portada, el sensor y las preguntas
(() => {
const $ = (id) => document.getElementById(id);

// Modo claro / oscuro (se guarda igual que en el mapa)
const root = document.documentElement;
const darkQuery = matchMedia("(prefers-color-scheme: dark)");
const isDark = () => (root.dataset.theme ? root.dataset.theme === "dark" : darkQuery.matches);
function applyTheme() {
  const dark = isDark();
  const btn = $("tema");
  btn.setAttribute("aria-checked", String(dark));
  btn.title = dark ? "Pasar a modo claro" : "Pasar a modo oscuro";
  document.querySelector('meta[name="theme-color"]').content = dark ? "#0E1438" : "#F2F0EA";
}
$("tema").addEventListener("click", () => {
  const change = () => {
    root.dataset.theme = isDark() ? "light" : "dark";
    try { localStorage.setItem("go503-tema", root.dataset.theme); } catch {}
    applyTheme();
  };
  // fundido suave entre modos si el navegador lo soporta
  if (document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) document.startViewTransition(change);
  else change();
});
darkQuery.addEventListener("change", () => { if (!root.dataset.theme) applyTheme(); });
applyTheme();

// Menú del teléfono: abre y cierra la lista de enlaces de arriba
const menuBtn = document.querySelector(".top__menu");
if (menuBtn) {
  const nav = menuBtn.closest(".top");
  const setMenu = (open) => {
    nav.classList.toggle("is-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
  };
  menuBtn.addEventListener("click", () => setMenu(!nav.classList.contains("is-open")));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("is-open")) { setMenu(false); menuBtn.focus(); }
  });
  nav.querySelectorAll(".top__links a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
}

// Preguntas: cada una tiene su enlace (preguntas.html#bateria). Al abrirlo, esa pregunta se abre sola.
function abrirPregunta() {
  const d = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (!d || d.tagName !== "DETAILS") return;
  d.open = true;
  d.scrollIntoView({ block: "center" });
  d.querySelector("summary").focus({ preventScroll: true });
}
addEventListener("hashchange", abrirPregunta);
abrirPregunta();
// "Enlace a esta pregunta": se copia; si no se puede copiar, el enlace igual lleva a la pregunta
document.querySelectorAll(".faq__link").forEach((a) => a.addEventListener("click", async (e) => {
  try {
    await navigator.clipboard.writeText(a.href);
    e.preventDefault();
    history.replaceState(null, "", a.hash);
    const antes = a.textContent;
    a.textContent = "Enlace copiado";
    setTimeout(() => { a.textContent = antes; }, 1800);
  } catch {}
}));

// Cifras que ruedan (sensor.html): cada dígito sube hasta su número una vez, al aparecer.
// El número real queda escrito para lectores de pantalla.
document.querySelectorAll("[data-roll]").forEach((n) => {
  const valor = n.textContent.trim();
  const dicho = Object.assign(document.createElement("span"), { className: "sr-only", textContent: valor });
  const visto = Object.assign(document.createElement("span"), { className: "roll__digits" });
  visto.setAttribute("aria-hidden", "true");
  let i = 0;
  for (const ch of valor) {
    if (!/\d/.test(ch)) { visto.append(ch); continue; }
    const col = Object.assign(document.createElement("span"), { className: "roll__col" });
    const tira = Object.assign(document.createElement("span"), { className: "roll__strip" });
    tira.style.setProperty("--d", ch);
    tira.style.setProperty("--i", i++);
    col.append(Object.assign(document.createElement("i"), { textContent: ch }), tira);
    visto.append(col);
  }
  n.classList.add("roll");
  n.replaceChildren(dicho, visto);
});

// Animaciones al bajar: cada parte llega cuando su sección aparece en pantalla (una sola vez).
// En [data-entra] y en las listas, cada hijo lleva su turno (--n) para llegar uno tras otro.
document.querySelectorAll("[data-entra], .salidas, .campos").forEach((n) => {
  [...n.children].forEach((c, i) => c.style.setProperty("--n", Math.min(i, 8)));
});
const reveal = document.querySelectorAll("[data-reveal], [data-entra], [data-cortina], .salidas, .campos, [data-pie], [data-roll]");
const mostrar = (n) => n.classList.add("is-in", "is-visible");
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    mostrar(e.target);
    io.unobserve(e.target);
  }), { rootMargin: "0px 0px -12% 0px", threshold: 0.05 });
  reveal.forEach((n) => io.observe(n));
} else {
  reveal.forEach(mostrar);
}

})();
