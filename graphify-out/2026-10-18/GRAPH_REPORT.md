# Graph Report - bus-tracker  (2026-10-18)

## Corpus Check
- 71 files · ~72,026 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 30 file(s) not represented in the graph (top: .xml 10, .css 6, .woff2 4)

## Summary
- 681 nodes · 1109 edges · 57 communities (43 shown, 14 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 70 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `798e9193`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Panel de administración
- tracking.js
- Mapa de pasajeros
- routes/empresa.js
- admin.js
- Sensor y páginas públicas
- Alertas y push
- Firmware: cola y red
- Landing y pedidos
- Firmware: sensores
- Firmware: GPS
- eta.js
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
- Registro antislop 001 (2026-10-14)
- encendido.test.js
- app/package.json
- js/motorista.js
- ExampleInstrumentedTest.java
- MainActivity.java
- distanceM
- package.json
- Detalle por página
- recorrido.test.js
- CI workflow (GitHub Actions)
- rutas.js
- trazos.js
- auth.js
- telemetry.js
- motorista.test.js
- db.js
- routes/motorista.js
- server.js
- claves.test.js
- telemetria.test.js
- middleware/empresa.js
- scripts
- clientes.js
- dependencies

## God Nodes (most connected - your core abstractions)
1. `persist()` - 15 edges
2. `loadUnidades()` - 12 edges
3. `distanceM()` - 12 edges
4. `openDetalle()` - 11 edges
5. `loadMantenimiento()` - 11 edges
6. `renderChips()` - 10 edges
7. `handlePosition()` - 10 edges
8. `render()` - 9 edges
9. `drawMap()` - 9 edges
10. `render()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Rediseño 2026-10-18: "rótulo y parada"` --references--> `cards()`  [INFERRED]
  DESIGN.md → public/js/panel.js
- `Rediseño 2026-10-18: "rótulo y parada"` --references--> `moreMenu()`  [INFERRED]
  DESIGN.md → public/js/panel.js
- `buildPath()` --calls--> `distanceM()`  [EXTRACTED]
  tools/simulator.js → src/geo.js
- `gps()` --calls--> `handlePosition()`  [EXTRACTED]
  test/recorrido.test.js → src/tracking.js
- `Render env vars (Supabase, VAPID, BUS_API_KEY)` --shares_data_with--> `BUS_API_KEY`  [INFERRED]
  render.yaml → firmware/README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **CI gated deploy to Render** — github_workflows_ci, github_workflows_ci_smoke_test, render, render_autodeploy_checkspass, api_rutas_endpoint [EXTRACTED 1.00]
- **Public marketing site pages** — public_index, public_preguntas, public_sensor, public_mapa, public_login [EXTRACTED 1.00]
- **Telemetry mobile-data saving strategy** — firmware_readme_adaptive_send_interval, firmware_readme_offline_queue, firmware_readme_data_usage, firmware_readme_proposed_backend_changes [INFERRED 0.85]

## Communities (57 total, 14 thin omitted)

### Community 0 - "Panel de administración"
Cohesion: 0.05
Nodes (83): Rediseño 2026-10-18: "rótulo y parada", ADMIN_VIEWS, agregarPunto(), alertas, applyTheme(), button(), cambiarRecorrido(), cards() (+75 more)

### Community 1 - "tracking.js"
Cohesion: 0.16
Nodes (17): nearestStop(), DIRS, endTrip(), handlePosition(), { nearestStop }, other(), { persist }, registerExit() (+9 more)

### Community 2 - "Mapa de pasajeros"
Cohesion: 0.06
Nodes (62): ALTOS, animateVehicle(), api(), applyTheme(), b64ToBytes(), bearing(), bellButton(), buscar (+54 more)

### Community 3 - "routes/empresa.js"
Cohesion: 0.08
Nodes (13): ALERT, crypto, { db, select, flush, unitFromRow }, { hashKey }, KINDS, LEAD_STATES, { requireUser, requireCompany, requireAdmin, forgetToken, rateLimit }, router (+5 more)

### Community 4 - "admin.js"
Cohesion: 0.09
Nodes (15): ARCHIVOS, fs, path, PUBLIC, WWW, @supabase/supabase-js, { createClient }, crypto (+7 more)

### Community 5 - "Sensor y páginas públicas"
Cohesion: 0.07
Nodes (29): go503 sensor firmware README, POST /api/telemetry, Local test tunnel (cloudflared/ngrok), go503 sensor (ESP32 + 4G + GPS), GPS odometer, J1939 (heavy diesel, planned), Legacy bus sensors (ignition, fuel, DS18B20, MPU6050), npm run simulate (sensor simulator) (+21 more)

### Community 6 - "Alertas y push"
Cohesion: 0.12
Nodes (22): addAlert(), alertKey(), checkAlerts(), dropAlert(), enabled, listAlerts(), minutesTo(), { persist } (+14 more)

### Community 7 - "Firmware: cola y red"
Cohesion: 0.16
Nodes (13): agregarACola(), colaPendiente(), enviarCola(), guardarPosicionCola(), recortarCola(), tamanoCola(), vaciarCola(), alimentarWatchdog() (+5 more)

### Community 8 - "Landing y pedidos"
Cohesion: 0.26
Nodes (12): el(), flip(), getJSON(), hhmm(), init(), load(), minsTo(), myStop (+4 more)

### Community 9 - "Firmware: sensores"
Cohesion: 0.21
Nodes (7): escribirMpu(), ignicionEncendida(), iniciarAcelerometro(), leerAceleracion(), leerCombustible(), leerVoltios(), tareaAcelerometro()

### Community 10 - "Firmware: GPS"
Cohesion: 0.29
Nodes (4): aGrados(), horaIso(), leerGps(), ponerHora()

### Community 11 - "eta.js"
Cohesion: 0.21
Nodes (14): enMapa(), activeTrip(), { distanceM }, { enMapa }, finished(), legProgress(), legSeconds(), other() (+6 more)

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
Cohesion: 0.25
Nodes (7): Diales, Dirección de diseño de go503, Identidad, Motivo de identidad, Paleta (en `public/css/base.css`), Reglas de contenido, Tipografía (cambió el 2026-10-18)

### Community 25 - "Registro antislop 001 (2026-10-14)"
Cohesion: 0.22
Nodes (8): Cambios hechos, Evaluación general, Pendiente para Mateo (no lo cambié porque es decisión tuya), Registro antislop 001 (2026-10-14), Revisado y se quedó igual (con su razón), Segunda ronda: mapa, panel, login y sensor (antislop-ui), Tercera ronda: panel con sesión y página del sensor, Verificación (navegador del app, servidor local)

### Community 26 - "encendido.test.js"
Cohesion: 0.24
Nodes (8): assert, express, hace(), { hashKey }, post(), sensor(), store, test

### Community 27 - "app/package.json"
Cohesion: 0.11
Nodes (18): dependencies, @capacitor/android, @capacitor-community/background-geolocation, @capacitor/core, description, devDependencies, @capacitor/cli, name (+10 more)

### Community 28 - "js/motorista.js"
Cohesion: 0.27
Nodes (16): call(), conectar(), desarmarTerminar(), gpsApp(), keepAwake(), ocupado(), refresh(), render() (+8 more)

### Community 31 - "distanceM"
Cohesion: 0.53
Nodes (5): buildPath(), { distanceM }, jitter(), post(), runBus()

### Community 32 - "package.json"
Cohesion: 0.22
Nodes (8): engines, node, name, private, version, dotenv, express, web-push

### Community 33 - "Detalle por página"
Cohesion: 0.12
Nodes (15): App del motorista — 6.0, Detalle por página, El sensor — 8.0, Entrar — 8.0, Mapa — 7.0, Nota general: **7.1 / 10**, Notas después del rediseño, Panel de empresas — 6.5 (+7 more)

### Community 34 - "recorrido.test.js"
Cohesion: 0.25
Nodes (6): assert, { handlePosition }, route, { routeStatus }, store, test

### Community 35 - "CI workflow (GitHub Actions)"
Cohesion: 0.28
Nodes (5): GET /api/rutas (health check), BUS_API_KEY, CI workflow (GitHub Actions), Render blueprint (render.yaml), Render env vars (Supabase, VAPID, BUS_API_KEY)

### Community 36 - "rutas.js"
Cohesion: 0.22
Nodes (4): { distanceM }, router, { routes, buses, units, shapes }, { routeStatus, pickDirection }

### Community 44 - "trazos.js"
Cohesion: 0.12
Nodes (21): persist(), saveBus(), logHistory(), deleteShape(), { distanceM }, grabando, { persist }, pt() (+13 more)

### Community 45 - "auth.js"
Cohesion: 0.24
Nodes (6): crypto, hashKey(), { isProduction }, sameHash(), sensorAuth(), { units }

### Community 46 - "telemetry.js"
Cohesion: 0.17
Nodes (9): auth, CAMPOS, { distanceM }, { enMapa }, { handlePosition, toTime }, lastLog, { persist, saveBus }, router (+1 more)

### Community 47 - "motorista.test.js"
Cohesion: 0.24
Nodes (8): assert, express, gps(), { hashKey }, motorista(), post(), store, test

### Community 48 - "db.js"
Cohesion: 0.33
Nodes (8): { createClient }, flush(), loadState(), ms(), queues, select(), store, unitFromRow()

### Community 49 - "routes/motorista.js"
Cohesion: 0.22
Nodes (5): auth, router, { routes, buses, units, trips }, { saveBus }, { startTrip, endTrip }

### Community 50 - "server.js"
Cohesion: 0.25
Nodes (7): cors, limpiarHistorial(), app, cors, express, { loadState, limpiarHistorial }, path

### Community 51 - "claves.test.js"
Cohesion: 0.25
Nodes (5): assert, express, { hashKey }, store, test

### Community 52 - "telemetria.test.js"
Cohesion: 0.25
Nodes (4): assert, express, store, test

### Community 53 - "middleware/empresa.js"
Cohesion: 0.36
Nodes (7): cache, { db }, forgetToken(), lookup(), requireAdmin(), requireCompany(), requireUser()

### Community 54 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, admin, codigo, dev, simulate, start, test

### Community 55 - "clientes.js"
Cohesion: 0.29
Nodes (4): rateLimit(), { db }, { rateLimit }, router

### Community 56 - "dependencies"
Cohesion: 0.33
Nodes (6): dependencies, cors, dotenv, express, @supabase/supabase-js, web-push

## Knowledge Gaps
- **22 isolated node(s):** `@capacitor-community/background-geolocation`, `@capacitor/android`, `@capacitor/core`, `@capacitor/cli`, `dotenv` (+17 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 322 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@supabase/supabase-js` connect `admin.js` to `package.json`, `db.js`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `@capacitor-community/background-geolocation`, `@capacitor/android`, `@capacitor/core` to the rest of the system?**
  _22 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Panel de administración` be split into smaller, more focused modules?**
  _Cohesion score 0.052100840336134456 - nodes in this community are weakly interconnected._
- **Why does `express` connect `package.json` to `trazos.js`, `motorista.test.js`, `server.js`, `claves.test.js`, `telemetria.test.js`, `encendido.test.js`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Should `Mapa de pasajeros` be split into smaller, more focused modules?**
  _Cohesion score 0.06093189964157706 - nodes in this community are weakly interconnected._
- **Why does `scripts` connect `scripts` to `package.json`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Should `routes/empresa.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._