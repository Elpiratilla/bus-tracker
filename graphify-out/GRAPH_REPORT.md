# Graph Report - bus-tracker  (2026-10-25)

## Corpus Check
- 74 files · ~146,254 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 31 file(s) not represented in the graph (top: .xml 10, .css 7, .woff2 4)

## Summary
- 720 nodes · 1219 edges · 58 communities (43 shown, 15 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `da1bc204`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- panel.js
- empresa.test.js
- Mapa de pasajeros
- routes/empresa.js
- admin.js
- go503 sensor (ESP32 + 4G + GPS)
- alerts.js
- Firmware: cola y red
- Landing y pedidos
- Firmware: sensores
- Firmware: GPS
- tracking.js
- Firmware: OBD-II
- Acceso por código
- Logo oscuro
- Página del sensor
- Icono Apple
- Favicon
- Logo claro
- Icono PWA 192
- Icono PWA 512
- Dirección de diseño de go503
- encendido.test.js
- auth.js
- app/package.json
- js/motorista.js
- ExampleInstrumentedTest.java
- MainActivity.java
- telemetry.js
- package.json
- motorista.test.js
- recorrido.test.js
- trazos.js
- idioma.js
- server.js
- claves.test.js
- isDark
- telemetria.test.js
- routes/motorista.js
- sesion.js
- loadFlota
- fail
- renderClientes
- pintarRuta
- go503
- trazos.test.js
- lineChart
- simulator.js

## God Nodes (most connected - your core abstractions)
1. `persist()` - 15 edges
2. `renderClientes()` - 13 edges
3. `loadUnidades()` - 12 edges
4. `distanceM()` - 12 edges
5. `loadFlota()` - 11 edges
6. `openDetalle()` - 11 edges
7. `loadMantenimiento()` - 11 edges
8. `pintarRuta()` - 11 edges
9. `renderChips()` - 10 edges
10. `fmt()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `Rediseño 2026-10-18: "rótulo y parada" (sigue en las pantallas de app)` --references--> `cards()`  [INFERRED]
  DESIGN.md → public/js/panel.js
- `Rediseño 2026-10-18: "rótulo y parada" (sigue en las pantallas de app)` --references--> `moreMenu()`  [INFERRED]
  DESIGN.md → public/js/panel.js
- `gps()` --calls--> `handlePosition()`  [EXTRACTED]
  test/recorrido.test.js → src/tracking.js
- `Render env vars (Supabase, VAPID, BUS_API_KEY)` --shares_data_with--> `BUS_API_KEY`  [INFERRED]
  render.yaml → firmware/README.md
- `desarmarTerminar()` --indirect_call--> `confirmar()`  [INFERRED]
  public/js/motorista.js → public/js/panel.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **CI gated deploy to Render** — github_workflows_ci, github_workflows_ci_smoke_test, render, render_autodeploy_checkspass, api_rutas_endpoint [EXTRACTED 1.00]
- **Telemetry mobile-data saving strategy** — firmware_readme_adaptive_send_interval, firmware_readme_offline_queue, firmware_readme_data_usage, firmware_readme_proposed_backend_changes [INFERRED 0.85]

## Communities (58 total, 15 thin omitted)

### Community 0 - "panel.js"
Cohesion: 0.06
Nodes (34): ADMIN_VIEWS, alertas, clientes, closeAlertas(), codigos, darkQuery, dlgCliente, dlgCodigo (+26 more)

### Community 1 - "empresa.test.js"
Cohesion: 0.11
Nodes (9): assert, comoA, comoB, { db }, empresas, express, IDA, store (+1 more)

### Community 2 - "Mapa de pasajeros"
Cohesion: 0.06
Nodes (62): ALTOS, animateVehicle(), api(), applyTheme(), b64ToBytes(), bearing(), bellButton(), buscar (+54 more)

### Community 3 - "routes/empresa.js"
Cohesion: 0.05
Nodes (48): { createClient }, flush(), loadState(), ms(), queues, select(), store, unitFromRow() (+40 more)

### Community 4 - "admin.js"
Cohesion: 0.09
Nodes (15): ARCHIVOS, fs, path, PUBLIC, WWW, @supabase/supabase-js, { createClient }, crypto (+7 more)

### Community 5 - "go503 sensor (ESP32 + 4G + GPS)"
Cohesion: 0.09
Nodes (14): GET /api/rutas (health check), go503 sensor firmware README, POST /api/telemetry, BUS_API_KEY, Local test tunnel (cloudflared/ngrok), go503 sensor (ESP32 + 4G + GPS), GPS odometer, J1939 (heavy diesel, planned) (+6 more)

### Community 6 - "alerts.js"
Cohesion: 0.07
Nodes (38): addAlert(), alertKey(), checkAlerts(), dropAlert(), enabled, listAlerts(), minutesTo(), { persist } (+30 more)

### Community 7 - "Firmware: cola y red"
Cohesion: 0.16
Nodes (13): agregarACola(), colaPendiente(), enviarCola(), guardarPosicionCola(), recortarCola(), tamanoCola(), vaciarCola(), alimentarWatchdog() (+5 more)

### Community 8 - "Landing y pedidos"
Cohesion: 0.24
Nodes (13): el(), flip(), getJSON(), hhmm(), init(), load(), minsTo(), myStop (+5 more)

### Community 9 - "Firmware: sensores"
Cohesion: 0.21
Nodes (7): escribirMpu(), ignicionEncendida(), iniciarAcelerometro(), leerAceleracion(), leerCombustible(), leerVoltios(), tareaAcelerometro()

### Community 10 - "Firmware: GPS"
Cohesion: 0.29
Nodes (4): aGrados(), horaIso(), leerGps(), ponerHora()

### Community 11 - "tracking.js"
Cohesion: 0.18
Nodes (13): DIRS, endTrip(), { legKey, segments, geofence, trips, units }, { nearestStop }, other(), { persist }, registerExit(), registerPass() (+5 more)

### Community 12 - "Firmware: OBD-II"
Cohesion: 0.39
Nodes (5): agregarObd(), leerPid(), preguntarObd(), revisarCan(), textoDtc()

### Community 13 - "Acceso por código"
Cohesion: 0.29
Nodes (3): msg, NIVELES, VIEWS

### Community 14 - "Logo oscuro"
Cohesion: 0.50
Nodes (4): go503 Brand Palette (blue #2E63D9, navy #0E1F3D, amber #F2B230), Front-View Bus Icon, go503 Brand Wordmark, go503 Logo (Dark Variant)

### Community 15 - "Página del sensor"
Cohesion: 0.83
Nodes (3): el(), pintarKit(), verPieza()

### Community 16 - "Icono Apple"
Cohesion: 0.67
Nodes (3): Brand Palette (blue background, orange accent, white marks), go503 App Icon (Apple Touch Icon), Route Path Motif (dotted trail from origin ring to orange destination dot)

### Community 17 - "Favicon"
Cohesion: 0.67
Nodes (3): Favicon Dark Mode Color Scheme, go503 Favicon Logo, Dotted Bus Route Path Motif

### Community 18 - "Logo claro"
Cohesion: 1.00
Nodes (3): go503 Brand Palette (blue #1E4FBF, navy #0E1F3D, amber #F2B230), go503 Brand, go503 Logo (light variant)

### Community 24 - "Dirección de diseño de go503"
Cohesion: 0.22
Nodes (8): Diales, Dirección de diseño de go503, Identidad, Motivo de identidad, Paleta (en `public/css/base.css` para las pantallas de app y en `estilos/sitio.css` para las páginas públicas), Rediseño 2026-10-24: "cartel de parada" (páginas públicas), Reglas de contenido, Tipografía (cambió el 2026-10-18)

### Community 25 - "encendido.test.js"
Cohesion: 0.24
Nodes (9): assert, enMapa(), express, hace(), { hashKey }, post(), sensor(), store (+1 more)

### Community 26 - "auth.js"
Cohesion: 0.24
Nodes (6): crypto, hashKey(), { isProduction }, sameHash(), sensorAuth(), { units }

### Community 27 - "app/package.json"
Cohesion: 0.11
Nodes (18): dependencies, @capacitor/android, @capacitor-community/background-geolocation, @capacitor/core, description, devDependencies, @capacitor/cli, name (+10 more)

### Community 28 - "js/motorista.js"
Cohesion: 0.23
Nodes (20): call(), conectar(), desarmarTerminar(), escribirCola(), gpsApp(), guardar(), keepAwake(), leerCola() (+12 more)

### Community 31 - "telemetry.js"
Cohesion: 0.17
Nodes (9): auth, CAMPOS, { distanceM }, { handlePosition, toTime }, lastLog, { persist, saveBus }, router, { routes, buses, units, retired } (+1 more)

### Community 32 - "package.json"
Cohesion: 0.07
Nodes (28): dependencies, cors, dotenv, express, @supabase/supabase-js, web-push, devDependencies, tailwindcss (+20 more)

### Community 33 - "motorista.test.js"
Cohesion: 0.24
Nodes (9): assert, enMapa(), express, gps(), { hashKey }, motorista(), post(), store (+1 more)

### Community 34 - "recorrido.test.js"
Cohesion: 0.22
Nodes (8): handlePosition(), assert, gps(), { handlePosition }, route, { routeStatus }, store, test

### Community 35 - "trazos.js"
Cohesion: 0.19
Nodes (15): persist(), saveBus(), logHistory(), deleteShape(), { distanceM }, grabando, { persist }, pt() (+7 more)

### Community 45 - "idioma.js"
Cohesion: 0.48
Nodes (4): doAttrs(), doText(), t(), walk()

### Community 47 - "server.js"
Cohesion: 0.25
Nodes (7): express, limpiarHistorial(), app, cors, express, { loadState, limpiarHistorial }, path

### Community 48 - "claves.test.js"
Cohesion: 0.25
Nodes (5): assert, express, { hashKey }, store, test

### Community 49 - "isDark"
Cohesion: 0.50
Nodes (5): applyTheme(), initMap(), initRecMap(), isDark(), setTiles()

### Community 50 - "telemetria.test.js"
Cohesion: 0.25
Nodes (4): assert, express, store, test

### Community 51 - "routes/motorista.js"
Cohesion: 0.25
Nodes (5): auth, router, { routes, buses, units, trips }, { saveBus }, { startTrip, endTrip }

### Community 53 - "loadFlota"
Cohesion: 0.23
Nodes (14): closeDetalle(), estado(), fmt(), icon(), km(), loadFlota(), loadMantenimiento(), markerIcon() (+6 more)

### Community 54 - "fail"
Cohesion: 0.38
Nodes (7): fail(), loadClientes(), loadCodigos(), loadReportes(), renderVueltas(), route(), showRoute()

### Community 55 - "renderClientes"
Cohesion: 0.20
Nodes (18): Rediseño 2026-10-18: "rótulo y parada" (sigue en las pantallas de app), button(), cards(), cerrarMenu(), confirmar(), enEtapa(), fecha(), hace() (+10 more)

### Community 56 - "pintarRuta"
Cohesion: 0.16
Nodes (23): abrirRuta(), agregarParada(), agregarPunto(), borradorDe(), cambiarSentido(), cargarTrazo(), dibujarRecorrido(), encuadrarRuta() (+15 more)

### Community 57 - "go503"
Cohesion: 0.20
Nodes (9): Cuando algo cambie, Empezar, Estructura, go503, Legal, Para cuando go503 se inscriba, Publicar, Qué hace (+1 more)

### Community 58 - "trazos.test.js"
Cohesion: 0.25
Nodes (6): assert, { handlePosition }, route, { simplify, validPoints, setShape }, store, test

### Community 59 - "lineChart"
Cohesion: 0.33
Nodes (7): cambiarModo(), hideTip(), hora(), lineChart(), loadVueltas(), renderTramos(), showTip()

### Community 60 - "simulator.js"
Cohesion: 0.33
Nodes (8): distanceM(), nearestStop(), updateCounters(), buildPath(), { distanceM }, jitter(), post(), runBus()

## Knowledge Gaps
- **24 isolated node(s):** `@capacitor-community/background-geolocation`, `@capacitor/android`, `@capacitor/core`, `@capacitor/cli`, `dotenv` (+19 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 331 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@supabase/supabase-js` connect `admin.js` to `package.json`, `routes/empresa.js`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **What connects `@capacitor-community/background-geolocation`, `@capacitor/android`, `@capacitor/core` to the rest of the system?**
  _24 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `panel.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06031746031746032 - nodes in this community are weakly interconnected._
- **Why does `express` connect `server.js` to `package.json`, `empresa.test.js`, `motorista.test.js`, `claves.test.js`, `telemetria.test.js`, `encendido.test.js`, `trazos.test.js`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Should `empresa.test.js` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Why does `confirmar()` connect `renderClientes` to `panel.js`, `js/motorista.js`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Should `Mapa de pasajeros` be split into smaller, more focused modules?**
  _Cohesion score 0.06093189964157706 - nodes in this community are weakly interconnected._