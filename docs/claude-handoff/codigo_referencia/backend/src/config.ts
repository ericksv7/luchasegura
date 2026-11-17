import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

const jwtSecret = required("JWT_SECRET");
if (jwtSecret.length < 32) {
  throw new Error("JWT_SECRET debe tener al menos 32 caracteres");
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "2h",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:4200",
  isProd: process.env.NODE_ENV === "production",
};