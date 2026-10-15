# Graph Report - bus-tracker  (2026-10-14)

## Corpus Check
- 54 files · ~54,291 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: .css 5, (none) 1, .ino 1)

## Summary
- 563 nodes · 941 edges · 35 communities (30 shown, 5 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 62 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ec459061`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Panel de administración
- routes/familia.js
- Mapa de pasajeros
- Datos y autenticación
- Servidor y dependencias
- Sensor y páginas públicas
- Alertas y push
- Firmware: cola y red
- Landing y pedidos
- Firmware: sensores
- Firmware: GPS
- CI y despliegue Render
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
- colegio.js
- tracking.js
- js/motorista.js
- colegio.test.js
- store.js
- telemetry.js
- js/familia.js
- demo-colegio.js

## God Nodes (most connected - your core abstractions)
1. `persist()` - 13 edges
2. `distanceM()` - 12 edges
3. `openDetalle()` - 11 edges
4. `loadUnidades()` - 11 edges
5. `renderChips()` - 10 edges
6. `loadFlota()` - 10 edges
7. `loadMantenimiento()` - 10 edges
8. `schoolRoute()` - 10 edges
9. `render()` - 9 edges
10. `render()` - 9 edges

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

## Communities (35 total, 5 thin omitted)

### Community 0 - "Panel de administración"
Cohesion: 0.06
Nodes (70): ADMIN_VIEWS, alertas, button(), clientes, closeAlertas(), closeDetalle(), codigos, confirmar() (+62 more)

### Community 1 - "routes/familia.js"
Cohesion: 0.08
Nodes (29): activeTrip(), { distanceM }, finished(), legProgress(), legSeconds(), other(), pickDirection(), recentTrips() (+21 more)

### Community 2 - "Mapa de pasajeros"
Cohesion: 0.07
Nodes (57): animateVehicle(), api(), applyTheme(), b64ToBytes(), bearing(), bellButton(), buscar, cargarAlertas() (+49 more)

### Community 3 - "Datos y autenticación"
Cohesion: 0.06
Nodes (31): { createClient }, flush(), loadState(), ms(), queues, select(), store, unitFromRow() (+23 more)

### Community 4 - "Servidor y dependencias"
Cohesion: 0.05
Nodes (36): dependencies, cors, dotenv, express, @supabase/supabase-js, web-push, engines, node (+28 more)

### Community 5 - "Sensor y páginas públicas"
Cohesion: 0.07
Nodes (29): go503 sensor firmware README, POST /api/telemetry, Local test tunnel (cloudflared/ngrok), go503 sensor (ESP32 + 4G + GPS), GPS odometer, J1939 (heavy diesel, planned), Legacy bus sensors (ignition, fuel, DS18B20, MPU6050), npm run simulate (sensor simulator) (+21 more)

### Community 6 - "Alertas y push"
Cohesion: 0.14
Nodes (20): addAlert(), alertKey(), checkAlerts(), dropAlert(), enabled, listAlerts(), minutesTo(), { persist } (+12 more)

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

### Community 11 - "CI y despliegue Render"
Cohesion: 0.28
Nodes (5): GET /api/rutas (health check), BUS_API_KEY, CI workflow (GitHub Actions), Render blueprint (render.yaml), Render env vars (Supabase, VAPID, BUS_API_KEY)

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
Nodes (7): Diales, Dirección de diseño de go503, Identidad, Motivo de identidad, Paleta (en `public/css/base.css`), Reglas de contenido, Tipografía

### Community 25 - "Registro antislop 001 (2026-10-14)"
Cohesion: 0.22
Nodes (8): Cambios hechos, Evaluación general, Pendiente para Mateo (no lo cambié porque es decisión tuya), Registro antislop 001 (2026-10-14), Revisado y se quedó igual (con su razón), Segunda ronda: mapa, panel, login y sensor (antislop-ui), Tercera ronda: panel con sesión y página del sensor, Verificación (navegador del app, servidor local)

### Community 26 - "auth.js"
Cohesion: 0.28
Nodes (6): crypto, hashKey(), { isProduction }, sameHash(), sensorAuth(), { units }

### Community 27 - "colegio.js"
Cohesion: 0.13
Nodes (21): addStop(), clearStops(), crypto, { distanceM }, dropSchoolRoute(), ensureSchoolRoute(), { persist }, randomId() (+13 more)

### Community 28 - "tracking.js"
Cohesion: 0.23
Nodes (13): DIRS, endTrip(), handlePosition(), { nearestStop }, other(), { persist }, registerExit(), registerPass() (+5 more)

### Community 29 - "js/motorista.js"
Cohesion: 0.33
Nodes (11): call(), keepAwake(), refresh(), render(), renderDetalle(), save(), sendPosition(), showEntrar() (+3 more)

### Community 30 - "colegio.test.js"
Cohesion: 0.17
Nodes (6): assert, express, { hashKey }, PARADAS, store, test

### Community 31 - "store.js"
Cohesion: 0.20
Nodes (9): auth, { registerPass, toTime }, router, { routes }, router, { segments, publicRoutes }, publicRoutes(), routes (+1 more)

### Community 32 - "telemetry.js"
Cohesion: 0.20
Nodes (7): auth, { distanceM }, { handlePosition, toTime }, lastLog, { persist, saveBus }, router, { routes, buses, units, retired, publicRoutes }

### Community 33 - "js/familia.js"
Cohesion: 0.60
Nodes (5): drawMap(), initMap(), refresh(), render(), showMsg()

### Community 34 - "demo-colegio.js"
Cohesion: 0.33
Nodes (5): { hashKey }, PARADAS, { startTrip }, stops, store

## Knowledge Gaps
- **18 isolated node(s):** `dotenv`, `go503 Brand Palette (blue #2E63D9, navy #0E1F3D, amber #F2B230)`, `go503 Brand Wordmark`, `Front-View Bus Icon`, `Brand Palette (blue background, orange accent, white marks)` (+13 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 260 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `route()` connect `Panel de administración` to `demo-colegio.js`?**
  _High betweenness centrality (0.112) - this node is a cross-community bridge._
- **What connects `dotenv`, `go503 Brand Palette (blue #2E63D9, navy #0E1F3D, amber #F2B230)`, `go503 Brand Wordmark` to the rest of the system?**
  _18 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Panel de administración` be split into smaller, more focused modules?**
  _Cohesion score 0.05712050078247261 - nodes in this community are weakly interconnected._
- **Why does `@supabase/supabase-js` connect `Servidor y dependencias` to `Datos y autenticación`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Should `routes/familia.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07641196013289037 - nodes in this community are weakly interconnected._
- **Why does `express` connect `Servidor y dependencias` to `colegio.test.js`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Should `Mapa de pasajeros` be split into smaller, more focused modules?**
  _Cohesion score 0.06654567453115548 - nodes in this community are weakly interconnected._