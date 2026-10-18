require("dotenv").config();

// En producción, sin BUS_API_KEY cualquiera podría inventar buses en el mapa público: no arrancar
if (require("./env").isProduction && !process.env.BUS_API_KEY) {
  console.error("Falta BUS_API_KEY. En producción es obligatoria (ponla en Environment de Render).");
  process.exit(1);
}

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
// En Render las peticiones llegan por un proxy: así req.ip es la IP real (para los límites por IP)
app.set("trust proxy", 1);
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.use("/api/checkpoints", require("./routes/checkpoints"));
app.use("/api/telemetry", require("./routes/telemetry"));
app.use("/api/buses", require("./routes/telemetry"));
app.use("/api/routes", require("./routes/routes"));
app.use("/api/rutas", require("./routes/rutas"));
app.use("/api/alertas", require("./routes/alertas"));
app.use("/api/empresa", require("./routes/empresa"));
app.use("/api/clientes", require("./routes/clientes"));
app.use("/api/motorista", require("./routes/motorista"));

// Datos públicos que necesita el navegador para iniciar sesión con Supabase
app.get("/api/config", (_req, res) => res.json({
  supabaseUrl: process.env.SUPABASE_URL || null,
  supabaseKey: process.env.SUPABASE_PUBLISHABLE_KEY || null,
}));

// Cualquier error inesperado: mensaje claro en JSON (el detalle queda en la terminal)
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Algo falló en el servidor. Intenta de nuevo." });
});

const PORT = process.env.PORT || 3000;

// Primero carga lo guardado en Supabase; si falla, no arranca vacío (pisaría los datos guardados)
require("./db").loadState()
  .then(() => {
    require("./alerts").startAlerts();
    app.listen(PORT, () => console.log(`API lista en http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error(`No se pudo cargar Supabase: ${err.message}`);
    process.exit(1);
  });
