require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.use("/api/checkpoints", require("./routes/checkpoints"));
app.use("/api/telemetry", require("./routes/telemetry"));
app.use("/api/buses", require("./routes/telemetry"));
app.use("/api/routes", require("./routes/routes"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API lista en http://localhost:${PORT}`));
