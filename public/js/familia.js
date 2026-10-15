// go503 familia: el papá ve el micro de colegio de sus hijos con su enlace privado (/familia.html#t=TOKEN)
(() => {
const REFRESH_MS = 10000;
const CARTO_KEY = "cb1_483z_1_4a6102fca3ea19c0048a0ded"; // la misma del mapa público
const $ = (id) => document.getElementById(id);

// El token viene en el # del enlace (el navegador no lo manda al servidor ni queda en los logs)
const token = new URLSearchParams(location.hash.slice(1)).get("t");
const MIA = `go503-mi-parada:${token}`;
let miParada = null;
try { miParada = localStorage.getItem(MIA); } catch {}

const hora = (iso) => new Date(iso).toLocaleTimeString("es-SV", { hour: "numeric", minute: "2-digit" });
const minutos = (iso) => Math.max(0, Math.round((new Date(iso) - Date.now()) / 60000));

function showMsg(text) {
  const m = $("msg");
  m.textContent = text;
  m.className = "msg msg--error";
  m.hidden = !text;
}

// ---------- Mapa ----------
let map = null;
let microMk = null;
let paradasLayer = null;
let encuadrado = false;

function initMap() {
  map = L.map("mapa", { zoomControl: false, attributionControl: true }).setView([13.699, -89.205], 13);
  L.tileLayer(`https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png?key=${CARTO_KEY}`, {
    maxZoom: 20, detectRetina: true,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  }).addTo(map);
  paradasLayer = L.layerGroup().addTo(map);
}

function drawMap(d) {
  paradasLayer.clearLayers();
  const pts = d.paradas.map((p) => [p.lat, p.lng]);
  if (pts.length > 1) L.polyline(pts, { color: "#1B2559", weight: 3, opacity: .35, dashArray: "6 8" }).addTo(paradasLayer);
  d.paradas.forEach((p) => {
    const cls = `marker-parada${p.id === miParada ? " marker-parada--mia" : ""}`;
    L.marker([p.lat, p.lng], { icon: L.divIcon({ className: "", html: `<span class="${cls}"></span>`, iconSize: [14, 14], iconAnchor: [7, 7] }) })
      .bindTooltip(p.nombre).addTo(paradasLayer);
  });

  if (d.bus) {
    const ll = [d.bus.lat, d.bus.lng];
    if (!microMk) microMk = L.marker(ll, { zIndexOffset: 1000, icon: L.divIcon({ className: "", html: '<span class="marker-micro">🚐</span>', iconSize: [34, 34], iconAnchor: [17, 17] }) }).addTo(map);
    else microMk.setLatLng(ll);
  } else if (microMk) { microMk.remove(); microMk = null; }

  if (!encuadrado && pts.length) {
    map.fitBounds(L.latLngBounds(d.bus ? [...pts, [d.bus.lat, d.bus.lng]] : pts), { padding: [30, 30], maxZoom: 16 });
    encuadrado = true;
  }
}

// ---------- Texto ----------
function render(d) {
  $("titulo").textContent = d.micro || "Micro del colegio";
  $("subtitulo").textContent = d.para ? `Enlace de ${d.para}` : "";
  const mia = d.paradas.find((p) => p.id === miParada);
  let aviso;
  let detalle = "";

  if (!d.enServicio) {
    aviso = "El micro no está en recorrido ahora.";
    detalle = "Cuando el motorista salga, aquí lo verás moverse.";
  } else if (d.llego) {
    const ultima = d.paradas.at(-1);
    aviso = d.sentido === "ida" ? `Llegó al colegio${ultima?.pasoA ? ` a las ${hora(ultima.pasoA)}` : ""}.` : "Terminó el recorrido de la tarde.";
  } else if (mia?.pasoA) {
    aviso = `Ya pasó por ${mia.nombre} a las ${hora(mia.pasoA)}.`;
  } else if (mia?.etaA) {
    const m = minutos(mia.etaA);
    aviso = m <= 1 ? `Está llegando a ${mia.nombre}.` : `Llega a ${mia.nombre} en ${m} min.`;
  } else {
    aviso = `Recorrido de la ${d.turno} en camino.`;
    detalle = "Toca tu parada abajo para ver cuánto falta.";
  }
  if (d.enServicio && !d.llego) {
    detalle = d.bus ? `Ubicación de hace ${Math.max(0, Math.round((Date.now() - new Date(d.actualizado)) / 1000))} s.`
      : "Sin señal del micro. Las horas son estimadas.";
  }
  $("aviso").textContent = aviso;
  $("detalle").textContent = detalle;

  $("paradas").replaceChildren(...d.paradas.map((p) => {
    const li = document.createElement("li");
    li.className = `${p.id === miParada ? "es-mia" : ""}${p.pasoA ? " ya-paso" : ""}`;
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = p.nombre;
    const small = document.createElement("small");
    small.textContent = p.pasoA ? `Pasó a las ${hora(p.pasoA)}` : p.etaA ? `Llega ~${hora(p.etaA)} (${minutos(p.etaA)} min)` : p.id === miParada ? "Tu parada" : "";
    b.append(small);
    b.addEventListener("click", () => {
      miParada = p.id;
      try { localStorage.setItem(MIA, p.id); } catch {}
      render(d);
      drawMap(d);
    });
    li.append(b);
    return li;
  }));
  drawMap(d);
}

async function refresh() {
  try {
    const res = await fetch("/api/familia", { headers: { "x-familia": token } });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      $("v-ok").hidden = true;
      return showMsg(d.error || "No se pudo cargar. Intenta de nuevo.");
    }
    showMsg("");
    const first = $("v-ok").hidden;
    $("v-ok").hidden = false;
    if (first) { if (!map) initMap(); map.invalidateSize(); }
    render(d);
  } catch {
    showMsg("Sin conexión. Reintentando…");
  }
}

if (!token) showMsg("Este enlace está incompleto. Pídele el enlace al motorista.");
else {
  refresh();
  setInterval(refresh, REFRESH_MS);
}
})();
