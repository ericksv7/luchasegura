import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

const isProd = process.env.NODE_ENV === "production";
const jwtSecret = required("JWT_SECRET");
if (jwtSecret.length < 32 || (isProd && jwtSecret === "cambia-esto-por-un-valor-largo-y-aleatorio")) {
  throw new Error("Configura JWT_SECRET con un valor aleatorio de al menos 32 caracteres");
}

const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
if (!Number.isSafeInteger(trustProxyHops) || trustProxyHops < 0) {
  throw new Error("TRUST_PROXY_HOPS debe ser un entero no negativo");
}
const jwtExpiresIn = process.env.JWT_EXPIRES_IN ?? "2h";
if (!/^[1-9]\d{0,5}[smhd]$/.test(jwtExpiresIn)) {
  throw new Error("JWT_EXPIRES_IN debe incluir una unidad de tiempo, por ejemplo 2h");
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  jwtSecret,
  jwtExpiresIn,
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:4200",
  isProd,
  trustProxyHops,
};