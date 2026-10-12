// Simula sensores de buses. Con el servidor encendido: npm run simulate (Node 18+)
require("dotenv").config();

const API = "http://localhost:3000/api";
const stops = ["t-occ", "sdm", "centro", "t-ori"];
const post = (url, body) =>
  fetch(API + url, { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": process.env.BUS_API_KEY || "" }, body: JSON.stringify(body) });

function runBus(busId, secondsPerSegment) {
  let i = 0;
  setInterval(async () => {
    await post("/checkpoints", { busId, routeId: "101", stopId: stops[i] });
    await post("/telemetry", {
      busId,
      routeId: "101",
      speed: Math.round(20 + Math.random() * 40),
      fuel: Math.round(40 + Math.random() * 50),
      engineTemp: Math.round(80 + Math.random() * 15),
    });
    i = (i + 1) % stops.length;
  }, secondsPerSegment * 1000);
}

runBus("BUS-01", 5);
runBus("BUS-02", 7);
console.log("Simulando BUS-01 y BUS-02...");
