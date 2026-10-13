// go503: chat "¿A dónde vas?". Pregunta al servidor (/api/chat) qué ruta tomar.
// Se agrega solo a la página: un botón abajo a la derecha que abre la ventanita.
// La conversación se guarda mientras la pestaña esté abierta (sessionStorage), aunque cambies de página.
// Otras partes de la página lo abren con window.go503Chat.abrir("pregunta opcional").
(() => {
  const idioma = window.go503Idioma?.lang === "en" ? "en" : "es";
  const T = idioma === "en"
    ? { abrir: "Where to?", titulo: "Which bus do I take?", cerrar: "Close chat", nueva: "New conversation", ph: "e.g. how do I get to Metrocentro", enviar: "Send",
        mic: "Ask by voice", escuchando: "Listening…",
        ubic: "Use my location", ubicOk: "Got it. I'll start from your closest stop. Where are you going?",
        ubicNo: "I couldn't get your location. Tell me where you're leaving from, e.g. “from Soyapango to Metrocentro”.",
        error: "I couldn't reach the server. Check your internet and try again.",
        lento: "Too many questions in a row. Wait a minute and try again.", tu: "You", bot: "go503" }
    : { abrir: "¿A dónde vas?", titulo: "¿Qué bus me lleva?", cerrar: "Cerrar el chat", nueva: "Empezar de nuevo", ph: "Ej.: cómo llego a Metrocentro", enviar: "Enviar",
        mic: "Preguntar con la voz", escuchando: "Te escucho…",
        ubic: "Usar mi ubicación", ubicOk: "Listo. Salgo desde la parada más cerca de ti. ¿A dónde vas?",
        ubicNo: "No pude ver tu ubicación. Dime de dónde sales, por ejemplo «de Soyapango a Metrocentro».",
        error: "No pude conectarme. Revisa tu internet e intenta de nuevo.",
        lento: "Muchas preguntas seguidas. Espera un minuto e intenta de nuevo.", tu: "Tú", bot: "go503" };

  const CLAVE = "go503-chat";
  let coords = null;
  let historial = [];
  let ocupado = false;
  try { historial = JSON.parse(sessionStorage.getItem(CLAVE)) || []; } catch {}
  const guardar = () => { try { sessionStorage.setItem(CLAVE, JSON.stringify(historial.slice(-30))); } catch {} };

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const ico = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;

  // translate="no": las respuestas ya llegan en el idioma escogido
  const caja = el("div", "chat notranslate");
  caja.setAttribute("translate", "no");
  caja.innerHTML = `
    <button class="chat__open" type="button" aria-expanded="false" aria-controls="chat-ventana">
      ${ico('<path d="M4 5h16v11H9l-5 4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M8 10h8M8 13h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>')}
      <span></span>
    </button>
    <section class="chat__win" id="chat-ventana" role="dialog" aria-labelledby="chat-titulo" hidden>
      <header class="chat__head">
        <h2 id="chat-titulo"></h2>
        <div class="chat__tools">
          <button class="chat__icon chat__new" type="button">${ico('<path d="M4 12a8 8 0 1 0 2.6-5.9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M4 4v4h4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>')}</button>
          <button class="chat__icon chat__close" type="button">${ico('<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>')}</button>
        </div>
      </header>
      <ol class="chat__log" aria-live="polite"></ol>
      <div class="chat__sug"></div>
      <form class="chat__form">
        <button class="chat__mic" type="button" hidden>${ico('<rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>')}</button>
        <input name="m" autocomplete="off" maxlength="400" required>
        <button class="chat__send" type="submit">${ico('<path d="M4 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>')}</button>
      </form>
    </section>`;
  document.body.append(caja);

  const abrirBtn = caja.querySelector(".chat__open");
  const win = caja.querySelector(".chat__win");
  const log = caja.querySelector(".chat__log");
  const sug = caja.querySelector(".chat__sug");
  const form = caja.querySelector(".chat__form");
  const input = form.elements.m;
  const mic = caja.querySelector(".chat__mic");
  abrirBtn.querySelector("span").textContent = T.abrir;
  caja.querySelector("#chat-titulo").textContent = T.titulo;
  caja.querySelector(".chat__close").setAttribute("aria-label", T.cerrar);
  caja.querySelector(".chat__new").setAttribute("aria-label", T.nueva);
  caja.querySelector(".chat__new").title = T.nueva;
  input.placeholder = T.ph;
  input.setAttribute("aria-label", T.ph);
  caja.querySelector(".chat__send").setAttribute("aria-label", T.enviar);
  mic.setAttribute("aria-label", T.mic);
  mic.title = T.mic;

  function mostrar(abierto, saludar = true) {
    win.hidden = !abierto;
    abrirBtn.setAttribute("aria-expanded", String(abierto));
    caja.classList.toggle("is-open", abierto);
    if (!abierto) return abrirBtn.focus();
    if (saludar && !historial.length && !log.children.length) preguntar("");
    log.scrollTop = log.scrollHeight;
    input.focus();
  }
  abrirBtn.addEventListener("click", () => mostrar(win.hidden));
  caja.querySelector(".chat__close").addEventListener("click", () => mostrar(false));
  caja.querySelector(".chat__new").addEventListener("click", () => {
    historial = [];
    guardar();
    log.replaceChildren();
    preguntar("");
    input.focus();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !win.hidden) mostrar(false); });

  // Solo estas direcciones de go503 se vuelven enlaces dentro de una respuesta
  const ENLACES = /(\/mapa\.html|\/sensor\.html|\/preguntas\.html|\/login\.html|\/#pedir)/g;
  function parrafo(linea) {
    const p = el("p");
    linea.split(ENLACES).forEach((parte, i) => {
      if (i % 2) { const a = el("a", "chat__link", parte); a.href = parte; p.append(a); }
      else if (parte) p.append(parte);
    });
    return p;
  }

  function burbuja(quien, texto, rutas = []) {
    const li = el("li", `chat__msg chat__msg--${quien}`);
    li.append(el("span", "chat__who", quien === "yo" ? T.tu : T.bot));
    texto.split("\n").filter((l) => l.trim()).forEach((l) => li.append(quien === "bot" ? parrafo(l) : el("p", null, l)));
    if (rutas.length) {
      const links = el("div", "chat__routes");
      rutas.forEach((x) => {
        const a = el("a", null, x.texto);
        a.href = `/mapa.html?ruta=${encodeURIComponent(x.ruta)}&sentido=${encodeURIComponent(x.sentido)}`;
        links.append(a);
      });
      li.append(links);
    }
    log.append(li);
    log.scrollTop = log.scrollHeight;
    return li;
  }
  // Lo que se dijo antes en esta pestaña
  historial.forEach((h) => burbuja(h.rol, h.texto, h.rutas || []));

  function sugerencias(lista) {
    sug.replaceChildren(...lista.map((s) => {
      const b = el("button", null, s);
      b.type = "button";
      b.addEventListener("click", () => (s === T.ubic ? ubicar() : enviar(s)));
      return b;
    }));
  }

  async function preguntar(mensaje) {
    ocupado = true;
    sugerencias([]);
    const pensando = el("li", "chat__msg chat__msg--bot chat__typing");
    pensando.innerHTML = "<i></i><i></i><i></i>";
    log.append(pensando);
    log.scrollTop = log.scrollHeight;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensaje, lang: idioma, ...(coords || {}),
          historial: historial.slice(-10).map(({ rol, texto }) => ({ rol, texto })),
        }),
      });
      pensando.remove();
      if (res.status === 429) { burbuja("bot", T.lento); return; }
      if (!res.ok) throw new Error(res.status);
      const r = await res.json();
      burbuja("bot", r.texto, r.rutas || []);
      // el saludo no se guarda: así no se le manda a la IA
      if (mensaje) { historial.push({ rol: "bot", texto: r.texto, rutas: r.rutas || [] }); guardar(); }
      sugerencias(r.sugerencias || []);
    } catch {
      pensando.remove();
      burbuja("bot", T.error);
    } finally {
      ocupado = false;
    }
  }

  function enviar(texto) {
    const t = texto.trim();
    if (!t || ocupado) return;
    burbuja("yo", t);
    historial.push({ rol: "yo", texto: t });
    guardar();
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

  // Preguntar con la voz (Chrome, Edge, Safari): lo dicho se manda solo
  const Voz = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (Voz) {
    mic.hidden = false;
    let rec = null;
    mic.addEventListener("click", () => {
      if (rec) return rec.stop();
      rec = new Voz();
      rec.lang = idioma === "en" ? "en-US" : "es-SV";
      rec.interimResults = true;
      const antes = input.placeholder;
      input.placeholder = T.escuchando;
      caja.classList.add("is-listening");
      rec.onresult = (e) => {
        input.value = [...e.results].map((x) => x[0].transcript).join("");
        if (e.results[e.results.length - 1].isFinal) enviar(input.value);
      };
      rec.onend = () => { rec = null; input.placeholder = antes; caja.classList.remove("is-listening"); };
      rec.start();
    });
  }

  window.go503Chat = {
    abrir(pregunta) {
      if (win.hidden) mostrar(true, !pregunta);
      if (pregunta) enviar(pregunta);
    },
  };
})();
