# Graph Report - bus-tracker  (2026-10-18)

## Corpus Check
- 67 files · ~65,068 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 25 file(s) not represented in the graph (top: .xml 10, .css 5, (none) 3)

## Summary
- 614 nodes · 961 edges · 51 communities (37 shown, 14 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 59 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `03ca4f11`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Panel de administración
- tracking.js
- Mapa de pasajeros
- Datos y autenticación
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
- auth.js
- app/package.json
- js/motorista.js
- ExampleInstrumentedTest.java
- MainActivity.java
- rutas.js
- package.json
- Detalle por página
- copiar-web.js
- scripts
- server.js
- store.js
- dependencies
- telemetry.js
- distanceM
- CI workflow (GitHub Actions)
- routes/motorista.js
- codigo.js

## God Nodes (most connected - your core abstractions)
1. `openDetalle()` - 11 edges
2. `renderChips()` - 10 edges
3. `loadUnidades()` - 10 edges
4. `loadMantenimiento()` - 10 edges
5. `distanceM()` - 10 edges
6. `render()` - 9 edges
7. `render()` - 9 edges
8. `load()` - 9 edges
9. `fmt()` - 9 edges
10. `loadFlota()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Render env vars (Supabase, VAPID, BUS_API_KEY)` --shares_data_with--> `BUS_API_KEY`  [INFERRED]
  render.yaml → firmware/README.md
- `Rider live map (mapa.html)` --shares_data_with--> `POST /api/telemetry`  [INFERRED]
  public/mapa.html → firmware/README.md
- `Panel view: Flota en vivo` --shares_data_with--> `POST /api/telemetry`  [INFERRED]
  public/panel.html → firmware/README.md
- `Panel view: Mantenimiento` --shares_data_with--> `GPS odometer`  [INFERRED]
  public/panel.html → firmware/README.md
- `Panel view: Mantenimiento` --shares_data_with--> `OBD-II over CAN (SN65HVD230)`  [INFERRED]
  public/panel.html → firmware/README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **CI gated deploy to Render** — github_workflows_ci, github_workflows_ci_smoke_test, render, render_autodeploy_checkspass, api_rutas_endpoint [EXTRACTED 1.00]
- **Public marketing site pages** — public_index, public_preguntas, public_sensor, public_mapa, public_login [EXTRACTED 1.00]
- **Telemetry mobile-data saving strategy** — firmware_readme_adaptive_send_interval, firmware_readme_offline_queue, firmware_readme_data_usage, firmware_readme_proposed_backend_changes [INFERRED 0.85]

## Communities (51 total, 14 thin omitted)

### Community 0 - "Panel de administración"
Cohesion: 0.06
Nodes (66): ADMIN_VIEWS, alertas, button(), clientes, closeAlertas(), closeDetalle(), codigos, confirmar() (+58 more)

### Community 1 - "tracking.js"
Cohesion: 0.23
Nodes (14): persist(), DIRS, endTrip(), handlePosition(), { nearestStop }, other(), { persist }, registerExit() (+6 more)

### Community 2 - "Mapa de pasajeros"
Cohesion: 0.07
Nodes (57): animateVehicle(), api(), applyTheme(), b64ToBytes(), bearing(), bellButton(), buscar, cargarAlertas() (+49 more)

### Community 3 - "Datos y autenticación"
Cohesion: 0.06
Nodes (31): { createClient }, flush(), loadState(), ms(), queues, saveBus(), select(), store (+23 more)

### Community 4 - "admin.js"
Cohesion: 0.20
Nodes (7): { createClient }, crypto, db, email, ENV, fs, path

### Community 5 - "Sensor y páginas públicas"
Cohesion: 0.07
Nodes (29): go503 sensor firmware README, POST /api/telemetry, Local test tunnel (cloudflared/ngrok), go503 sensor (ESP32 + 4G + GPS), GPS odometer, J1939 (heavy diesel, planned), Legacy bus sensors (ignition, fuel, DS18B20, MPU6050), npm run simulate (sensor simulator) (+21 more)

### Community 6 - "Alertas y push"
Cohesion: 0.14
Nodes (19): addAlert(), alertKey(), checkAlerts(), dropAlert(), enabled, listAlerts(), minutesTo(), { persist } (+11 more)

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
Cohesion: 0.26
Nodes (12): enMapa(), activeTrip(), { distanceM }, { enMapa }, finished(), legProgress(), legSeconds(), other() (+4 more)

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
Nodes (8): Diales, Dirección de diseño de go503, Identidad, Motivo de identidad, Paleta (en `public/css/base.css`), Rediseño 2026-10-18: "rótulo y parada", Reglas de contenido, Tipografía (cambió el 2026-10-18)

### Community 25 - "Registro antislop 001 (2026-10-14)"
Cohesion: 0.22
Nodes (8): Cambios hechos, Evaluación general, Pendiente para Mateo (no lo cambié porque es decisión tuya), Registro antislop 001 (2026-10-14), Revisado y se quedó igual (con su razón), Segunda ronda: mapa, panel, login y sensor (antislop-ui), Tercera ronda: panel con sesión y página del sensor, Verificación (navegador del app, servidor local)

### Community 26 - "auth.js"
Cohesion: 0.07
Nodes (27): crypto, hashKey(), { isProduction }, sameHash(), sensorAuth(), { units }, assert, express (+19 more)

### Community 27 - "app/package.json"
Cohesion: 0.11
Nodes (18): dependencies, @capacitor/android, @capacitor-community/background-geolocation, @capacitor/core, description, devDependencies, @capacitor/cli, name (+10 more)

### Community 28 - "js/motorista.js"
Cohesion: 0.27
Nodes (16): call(), conectar(), desarmarTerminar(), gpsApp(), keepAwake(), ocupado(), refresh(), render() (+8 more)

### Community 31 - "rutas.js"
Cohesion: 0.25
Nodes (4): { distanceM }, router, { routes, buses, units }, { routeStatus, pickDirection }

### Community 32 - "package.json"
Cohesion: 0.25
Nodes (7): engines, node, name, private, version, dotenv, web-push

### Community 33 - "Detalle por página"
Cohesion: 0.14
Nodes (13): App del motorista — 6.0, Detalle por página, El sensor — 8.0, Entrar — 8.0, Mapa — 7.0, Nota general: **7.1 / 10**, Notas después del rediseño, Panel de empresas — 6.5 (+5 more)

### Community 34 - "copiar-web.js"
Cohesion: 0.25
Nodes (5): ARCHIVOS, fs, path, PUBLIC, WWW

### Community 35 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, admin, codigo, dev, simulate, start, test

### Community 36 - "server.js"
Cohesion: 0.29
Nodes (6): cors, express, app, cors, express, path

### Community 44 - "store.js"
Cohesion: 0.20
Nodes (8): auth, { registerPass, toTime }, router, { routes }, router, { routes, segments }, routes, toTime()

### Community 45 - "dependencies"
Cohesion: 0.33
Nodes (6): dependencies, cors, dotenv, express, @supabase/supabase-js, web-push

### Community 46 - "telemetry.js"
Cohesion: 0.17
Nodes (9): auth, { distanceM }, { enMapa }, { handlePosition, toTime }, lastLog, { persist, saveBus }, router, { routes, buses, units, retired } (+1 more)

### Community 47 - "distanceM"
Cohesion: 0.39
Nodes (7): distanceM(), nearestStop(), buildPath(), { distanceM }, jitter(), post(), runBus()

### Community 48 - "CI workflow (GitHub Actions)"
Cohesion: 0.28
Nodes (5): GET /api/rutas (health check), BUS_API_KEY, CI workflow (GitHub Actions), Render blueprint (render.yaml), Render env vars (Supabase, VAPID, BUS_API_KEY)

### Community 49 - "routes/motorista.js"
Cohesion: 0.22
Nodes (5): auth, router, { routes, buses, units, trips }, { saveBus }, { startTrip, endTrip }

### Community 50 - "codigo.js"
Cohesion: 0.33
Nodes (3): @supabase/supabase-js, { createClient }, crypto

## Knowledge Gaps
- **22 isolated node(s):** `@capacitor-community/background-geolocation`, `@capacitor/android`, `@capacitor/core`, `@capacitor/cli`, `dotenv` (+17 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 290 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@supabase/supabase-js` connect `codigo.js` to `package.json`, `Datos y autenticación`, `admin.js`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `@capacitor-community/background-geolocation`, `@capacitor/android`, `@capacitor/core` to the rest of the system?**
  _22 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Panel de administración` be split into smaller, more focused modules?**
  _Cohesion score 0.06151062867480778 - nodes in this community are weakly interconnected._
- **Why does `express` connect `server.js` to `package.json`, `auth.js`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Should `Mapa de pasajeros` be split into smaller, more focused modules?**
  _Cohesion score 0.06654567453115548 - nodes in this community are weakly interconnected._
- **Why does `scripts` connect `scripts` to `package.json`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Should `Datos y autenticación` be split into smaller, more focused modules?**
  _Cohesion score 0.061979648473635525 - nodes in this community are weakly interconnected._