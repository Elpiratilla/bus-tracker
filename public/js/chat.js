// go503: chat "¿A dónde vas?". Pregunta al servidor (/api/chat) qué ruta tomar.
// Se agrega solo a la página: un botón abajo a la derecha que abre la ventanita.
(() => {
  const idioma = window.go503Idioma?.lang === "en" ? "en" : "es";
  const T = idioma === "en"
    ? { abrir: "Where to?", titulo: "Which bus do I take?", cerrar: "Close chat", ph: "e.g. how do I get to Metrocentro", enviar: "Send",
        ubic: "Use my location", ubicOk: "Got it. I'll start from your closest stop. Where are you going?",
        ubicNo: "I couldn't get your location. Tell me where you're leaving from, e.g. “from Soyapango to Metrocentro”.",
        error: "I couldn't reach the server. Check your internet and try again.", tu: "You", bot: "go503" }
    : { abrir: "¿A dónde vas?", titulo: "¿Qué bus me lleva?", cerrar: "Cerrar el chat", ph: "Ej.: cómo llego a Metrocentro", enviar: "Enviar",
        ubic: "Usar mi ubicación", ubicOk: "Listo. Salgo desde la parada más cerca de ti. ¿A dónde vas?",
        ubicNo: "No pude ver tu ubicación. Dime de dónde sales, por ejemplo «de Soyapango a Metrocentro».",
        error: "No pude conectarme. Revisa tu internet e intenta de nuevo.", tu: "Tú", bot: "go503" };

  let coords = null;
  let primera = true;

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  // translate="no": las respuestas ya llegan en el idioma escogido
  const caja = el("div", "chat notranslate");
  caja.setAttribute("translate", "no");
  caja.innerHTML = `
    <button class="chat__open" type="button" aria-expanded="false" aria-controls="chat-ventana">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M8 10h8M8 13h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      <span></span>
    </button>
    <section class="chat__win" id="chat-ventana" role="dialog" aria-labelledby="chat-titulo" hidden>
      <header class="chat__head">
        <h2 id="chat-titulo"></h2>
        <button class="chat__close" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button>
      </header>
      <ol class="chat__log" aria-live="polite"></ol>
      <div class="chat__sug"></div>
      <form class="chat__form">
        <input name="m" autocomplete="off" maxlength="300" required>
        <button type="submit"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      </form>
    </section>`;
  document.body.append(caja);

  const abrir = caja.querySelector(".chat__open");
  const win = caja.querySelector(".chat__win");
  const log = caja.querySelector(".chat__log");
  const sug = caja.querySelector(".chat__sug");
  const form = caja.querySelector(".chat__form");
  const input = form.elements.m;
  abrir.querySelector("span").textContent = T.abrir;
  caja.querySelector("#chat-titulo").textContent = T.titulo;
  caja.querySelector(".chat__close").setAttribute("aria-label", T.cerrar);
  input.placeholder = T.ph;
  input.setAttribute("aria-label", T.ph);
  form.querySelector("button").setAttribute("aria-label", T.enviar);

  function mostrar(abierto) {
    win.hidden = !abierto;
    abrir.setAttribute("aria-expanded", String(abierto));
    caja.classList.toggle("is-open", abierto);
    if (!abierto) return abrir.focus();
    if (primera) { primera = false; preguntar(""); }
    input.focus();
  }
  abrir.addEventListener("click", () => mostrar(win.hidden));
  caja.querySelector(".chat__close").addEventListener("click", () => mostrar(false));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !win.hidden) mostrar(false); });

  function burbuja(quien, texto) {
    const li = el("li", `chat__msg chat__msg--${quien}`);
    li.append(el("span", "chat__who", quien === "yo" ? T.tu : T.bot));
    texto.split("\n").forEach((linea) => li.append(el("p", null, linea)));
    log.append(li);
    log.scrollTop = log.scrollHeight;
    return li;
  }

  function sugerencias(lista) {
    sug.replaceChildren(...lista.map((s) => {
      const b = el("button", null, s);
      b.type = "button";
      b.addEventListener("click", () => (s === T.ubic ? ubicar() : enviar(s)));
      return b;
    }));
  }

  async function preguntar(mensaje) {
    sugerencias([]);
    const pensando = el("li", "chat__msg chat__msg--bot chat__typing");
    pensando.innerHTML = "<i></i><i></i><i></i>";
    log.append(pensando);
    log.scrollTop = log.scrollHeight;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje, lang: idioma, ...(coords || {}) }),
      });
      if (!res.ok) throw new Error(res.status);
      const r = await res.json();
      pensando.remove();
      const li = burbuja("bot", r.texto);
      if (r.rutas?.length) {
        const links = el("div", "chat__routes");
        r.rutas.forEach((x) => {
          const a = el("a", null, x.texto);
          a.href = `/mapa.html?ruta=${encodeURIComponent(x.ruta)}&sentido=${encodeURIComponent(x.sentido)}`;
          links.append(a);
        });
        li.append(links);
      }
      sugerencias(r.sugerencias || []);
    } catch {
      pensando.remove();
      burbuja("bot", T.error);
    }
    log.scrollTop = log.scrollHeight;
  }

  function enviar(texto) {
    const t = texto.trim();
    if (!t) return;
    burbuja("yo", t);
    input.value = "";
    preguntar(t);
  }
  form.addEventListener("submit", (e) => { e.preventDefault(); enviar(input.value); });

  function ubicar() {
    burbuja("yo", T.ubic);
    sugerencias([]);
    if (!navigator.geolocation) return burbuja("bot", T.ubicNo);
    navigator.geolocation.getCurrentPosition(
      (p) => { coords = { lat: p.coords.latitude, lng: p.coords.longitude }; burbuja("bot", T.ubicOk); input.focus(); },
      () => burbuja("bot", T.ubicNo),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }
})();
