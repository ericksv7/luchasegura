import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

export type VisualRole = "GUEST" | "ATHLETE" | "PHYSIO" | "COACH" | "ADMIN";
const authenticated: VisualRole[] = ["ATHLETE", "PHYSIO", "COACH", "ADMIN"];
const routesFile = resolve(__dirname, "../../../frontend/src/app/app.routes.ts");
const tree = ts.createSourceFile(routesFile, readFileSync(routesFile, "utf8"), ts.ScriptTarget.Latest, true);

export interface VisualRoute {
  path: string;
  component: string;
  roles: VisualRole[];
}

function readRoutes(array: ts.ArrayLiteralExpression, parent = "", inherited?: VisualRole[]): VisualRoute[] {
  return array.elements.flatMap(node => {
    if (!ts.isObjectLiteralExpression(node)) throw new Error("Actualiza el lector de rutas Angular.");
    const field = (name: string) => node.properties.find((item): item is ts.PropertyAssignment =>
      ts.isPropertyAssignment(item) && item.name.getText(tree) === name)?.initializer;
    const route = field("path");
    if (!route || !ts.isStringLiteral(route)) throw new Error("Ruta con path no literal.");
    if (field("redirectTo")) return [];
    const path = [parent, route.text].filter(Boolean).join("/");
    const guards = field("canActivate")?.getText(tree) ?? "";
    const explicit = authenticated.filter(role => guards.includes("'" + role + "'"));
    const roles = explicit.length ? explicit : guards.includes("authGuard") ? authenticated : inherited ?? ["GUEST" as const];
    const children = field("children");
    if (children && ts.isArrayLiteralExpression(children)) return readRoutes(children, path, roles);
    const loader = field("loadComponent")?.getText(tree);
    const component = loader?.match(/import\(['"]([^'"]+)['"]\)/)?.[1];
    if (!component) throw new Error("No se identificó el componente para " + path);
    return [{ path: "/" + path, roles, component }];
  });
}

const declaration = tree.statements.filter(ts.isVariableStatement).flatMap(node => [...node.declarationList.declarations])
  .find(node => node.name.getText(tree) === "routes");
if (!declaration?.initializer || !ts.isArrayLiteralExpression(declaration.initializer)) {
  throw new Error("No se encontró el arreglo routes de Angular.");
}
export const visualRoutes = readRoutes(declaration.initializer);
