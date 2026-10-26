# Graph Report - bus-tracker  (2026-10-25)

## Corpus Check
- 73 files · ~141,205 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 31 file(s) not represented in the graph (top: .xml 10, .css 7, .woff2 4)

## Summary
- 678 nodes · 1110 edges · 55 communities (40 shown, 15 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 61 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `dc37dec3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Panel de administración
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
- distanceM
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
- trazos.js
- package.json
- motorista.test.js
- store.js
- tracking.js
- recorrido.test.js
- telemetry.js
- idioma.js
- db.js
- server.js
- claves.test.js
- trazos.test.js
- telemetria.test.js
- middleware/empresa.js
- sesion.js
- clientes.js
- go503

## God Nodes (most connected - your core abstractions)
1. `persist()` - 15 edges
2. `loadUnidades()` - 12 edges
3. `distanceM()` - 12 edges
4. `loadFlota()` - 11 edges
5. `openDetalle()` - 11 edges
6. `loadMantenimiento()` - 11 edges
7. `renderChips()` - 10 edges
8. `handlePosition()` - 10 edges
9. `scripts` - 9 edges
10. `render()` - 9 edges

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

## Communities (55 total, 15 thin omitted)

### Community 0 - "Panel de administración"
Cohesion: 0.05
Nodes (85): Rediseño 2026-10-18: "rótulo y parada" (sigue en las pantallas de app), ADMIN_VIEWS, agregarPunto(), alertas, applyTheme(), button(), cambiarRecorrido(), cards() (+77 more)

### Community 1 - "empresa.test.js"
Cohesion: 0.18
Nodes (6): assert, { db }, empresas, express, store, test

### Community 2 - "Mapa de pasajeros"
Cohesion: 0.06
Nodes (62): ALTOS, animateVehicle(), api(), applyTheme(), b64ToBytes(), bearing(), bellButton(), buscar (+54 more)

### Community 3 - "routes/empresa.js"
Cohesion: 0.08
Nodes (13): ALERT, crypto, { db, select, flush, unitFromRow }, { hashKey }, KINDS, LEAD_STATES, { requireUser, requireCompany, requireAdmin, forgetToken, rateLimit }, router (+5 more)

### Community 4 - "admin.js"
Cohesion: 0.09
Nodes (15): ARCHIVOS, fs, path, PUBLIC, WWW, @supabase/supabase-js, { createClient }, crypto (+7 more)

### Community 5 - "go503 sensor (ESP32 + 4G + GPS)"
Cohesion: 0.09
Nodes (14): GET /api/rutas (health check), go503 sensor firmware README, POST /api/telemetry, BUS_API_KEY, Local test tunnel (cloudflared/ngrok), go503 sensor (ESP32 + 4G + GPS), GPS odometer, J1939 (heavy diesel, planned) (+6 more)

### Community 6 - "alerts.js"
Cohesion: 0.06
Nodes (39): addAlert(), alertKey(), checkAlerts(), dropAlert(), enabled, listAlerts(), minutesTo(), { persist } (+31 more)

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

### Community 11 - "distanceM"
Cohesion: 0.33
Nodes (8): distanceM(), nearestStop(), updateCounters(), buildPath(), { distanceM }, jitter(), post(), runBus()

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

### Community 31 - "trazos.js"
Cohesion: 0.24
Nodes (10): { distanceM }, grabando, { persist }, pt(), round6(), saveRecording(), { shapes, recordings, trips, units }, simplify() (+2 more)

### Community 32 - "package.json"
Cohesion: 0.07
Nodes (27): dependencies, cors, dotenv, express, @supabase/supabase-js, web-push, devDependencies, tailwindcss (+19 more)

### Community 33 - "motorista.test.js"
Cohesion: 0.24
Nodes (9): assert, enMapa(), express, gps(), { hashKey }, motorista(), post(), store (+1 more)

### Community 34 - "store.js"
Cohesion: 0.25
Nodes (5): auth, router, { routes, buses, units, trips }, { saveBus }, { startTrip, endTrip }

### Community 35 - "tracking.js"
Cohesion: 0.19
Nodes (15): DIRS, endTrip(), handlePosition(), { nearestStop }, other(), { persist }, registerExit(), registerPass() (+7 more)

### Community 36 - "recorrido.test.js"
Cohesion: 0.22
Nodes (6): assert, { handlePosition }, route, { routeStatus }, store, test

### Community 44 - "telemetry.js"
Cohesion: 0.13
Nodes (14): persist(), saveBus(), auth, CAMPOS, { distanceM }, { handlePosition, toTime }, lastLog, logHistory() (+6 more)

### Community 45 - "idioma.js"
Cohesion: 0.48
Nodes (4): doAttrs(), doText(), t(), walk()

### Community 46 - "db.js"
Cohesion: 0.33
Nodes (8): { createClient }, flush(), loadState(), ms(), queues, select(), store, unitFromRow()

### Community 47 - "server.js"
Cohesion: 0.25
Nodes (7): cors, limpiarHistorial(), app, cors, express, { loadState, limpiarHistorial }, path

### Community 48 - "claves.test.js"
Cohesion: 0.25
Nodes (5): assert, express, { hashKey }, store, test

### Community 49 - "trazos.test.js"
Cohesion: 0.25
Nodes (6): assert, { handlePosition }, route, { simplify, validPoints, setShape }, store, test

### Community 50 - "telemetria.test.js"
Cohesion: 0.25
Nodes (5): express, assert, express, store, test

### Community 51 - "middleware/empresa.js"
Cohesion: 0.36
Nodes (7): cache, { db }, forgetToken(), lookup(), requireAdmin(), requireCompany(), requireUser()

### Community 54 - "clientes.js"
Cohesion: 0.29
Nodes (4): rateLimit(), { db }, { rateLimit }, router

### Community 57 - "go503"
Cohesion: 0.20
Nodes (9): Cuando algo cambie, Empezar, Estructura, go503, Legal, Para cuando go503 se inscriba, Publicar, Qué hace (+1 more)

## Knowledge Gaps
- **24 isolated node(s):** `@capacitor-community/background-geolocation`, `@capacitor/android`, `@capacitor/core`, `@capacitor/cli`, `dotenv` (+19 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 326 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@supabase/supabase-js` connect `admin.js` to `package.json`, `db.js`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **What connects `@capacitor-community/background-geolocation`, `@capacitor/android`, `@capacitor/core` to the rest of the system?**
  _24 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Panel de administración` be split into smaller, more focused modules?**
  _Cohesion score 0.051055867415129644 - nodes in this community are weakly interconnected._
- **Why does `express` connect `telemetria.test.js` to `package.json`, `empresa.test.js`, `motorista.test.js`, `server.js`, `claves.test.js`, `trazos.test.js`, `encendido.test.js`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Should `Mapa de pasajeros` be split into smaller, more focused modules?**
  _Cohesion score 0.06093189964157706 - nodes in this community are weakly interconnected._
- **Should `routes/empresa.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._
- **Should `admin.js` be split into smaller, more focused modules?**
  _Cohesion score 0.09057971014492754 - nodes in this community are weakly interconnected._