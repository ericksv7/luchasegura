import { app } from "./app";
import { config } from "./config";
import { prisma } from "./db";

const host = process.env.HOST ?? "0.0.0.0";
const server = app.listen(config.port, host, () => {
  console.log(`LuchaSegura escuchando en ${host}:${config.port}`);
});

function stop() {
  server.close(() => void prisma.$disconnect());
}

process.once("SIGTERM", stop);
process.once("SIGINT", stop);
