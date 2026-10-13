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
  document.querySelector('meta[name="theme-color"]').content = dark ? "#0E1438" : "#F3F5FB";
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

// Animaciones al bajar: se activan cuando la sección aparece en pantalla (una sola vez)
const reveal = document.querySelectorAll("[data-reveal]");
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add("is-visible");
    io.unobserve(e.target);
  }), { threshold: 0.35 });
  reveal.forEach((n) => io.observe(n));
} else {
  reveal.forEach((n) => n.classList.add("is-visible"));
}


// Botones que abren el chat (con una pregunta lista si traen data-chat="…")
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-chat]");
  if (b && window.go503Chat) window.go503Chat.abrir(b.dataset.chat || "");
});
})();
