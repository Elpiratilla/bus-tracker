# Graph Report - bus-tracker  (2026-10-14)

## Corpus Check
- Corpus is ~43,845 words - fits in a single context window. You may not need a graph.

## Summary
- 459 nodes · 747 edges · 24 communities (19 shown, 5 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 53 edges (avg confidence: 0.84)
- Token cost: 464,439 input · 0 output

## Community Hubs (Navigation)
- Panel de administración
- ETA y rutas (geo)
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
- `Sensor product page (sensor.html)` --conceptually_related_to--> `go503 sensor (ESP32 + 4G + GPS)`  [INFERRED]
  public/sensor.html → firmware/README.md
- `Rider live map (mapa.html)` --shares_data_with--> `POST /api/telemetry`  [INFERRED]
  public/mapa.html → firmware/README.md
- `Panel view: Flota en vivo` --shares_data_with--> `POST /api/telemetry`  [INFERRED]
  public/panel.html → firmware/README.md
- `Panel view: Mantenimiento` --shares_data_with--> `GPS odometer`  [INFERRED]
  public/panel.html → firmware/README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **CI gated deploy to Render** — github_workflows_ci, github_workflows_ci_smoke_test, render, render_autodeploy_checkspass, api_rutas_endpoint [EXTRACTED 1.00]
- **Telemetry mobile-data saving strategy** — firmware_readme_adaptive_send_interval, firmware_readme_offline_queue, firmware_readme_data_usage, firmware_readme_proposed_backend_changes [INFERRED 0.85]
- **Public marketing site pages** — public_index, public_preguntas, public_sensor, public_mapa, public_login [EXTRACTED 1.00]

## Communities (24 total, 5 thin omitted)

### Community 0 - "Panel de administración"
Cohesion: 0.06
Nodes (66): ADMIN_VIEWS, alertas, button(), clientes, closeAlertas(), closeDetalle(), codigos, confirmar() (+58 more)

### Community 1 - "ETA y rutas (geo)"
Cohesion: 0.06
Nodes (48): activeTrip(), { distanceM }, finished(), legProgress(), legSeconds(), other(), pickDirection(), recentTrips() (+40 more)

### Community 2 - "Mapa de pasajeros"
Cohesion: 0.07
Nodes (57): animateVehicle(), api(), applyTheme(), b64ToBytes(), bearing(), bellButton(), buscar, cargarAlertas() (+49 more)

### Community 3 - "Datos y autenticación"
Cohesion: 0.06
Nodes (35): { createClient }, flush(), loadState(), ms(), queues, select(), store, unitFromRow() (+27 more)

### Community 4 - "Servidor y dependencias"
Cohesion: 0.05
Nodes (35): dependencies, cors, dotenv, express, @supabase/supabase-js, web-push, engines, node (+27 more)

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

## Knowledge Gaps
- **18 isolated node(s):** `dotenv`, `go503 sensor firmware README`, `J1939 (heavy diesel, planned)`, `Legacy bus sensors (ignition, fuel, DS18B20, MPU6050)`, `Local test tunnel (cloudflared/ngrok)` (+13 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 199 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@supabase/supabase-js` connect `Servidor y dependencias` to `Datos y autenticación`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **What connects `dotenv`, `go503 sensor firmware README`, `J1939 (heavy diesel, planned)` to the rest of the system?**
  _18 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Panel de administración` be split into smaller, more focused modules?**
  _Cohesion score 0.06151062867480778 - nodes in this community are weakly interconnected._
- **Why does `web-push` connect `Servidor y dependencias` to `Alertas y push`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Should `ETA y rutas (geo)` be split into smaller, more focused modules?**
  _Cohesion score 0.05576923076923077 - nodes in this community are weakly interconnected._
- **Why does `routes` connect `ETA y rutas (geo)` to `Datos y autenticación`, `Alertas y push`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Should `Mapa de pasajeros` be split into smaller, more focused modules?**
  _Cohesion score 0.06654567453115548 - nodes in this community are weakly interconnected._