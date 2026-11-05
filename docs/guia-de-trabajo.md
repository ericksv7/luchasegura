# Guía de trabajo

## Ramas

- `main`: versión estable. Solo recibe cambios por Pull Request.
- `develop`: integración del trabajo en curso.
- `feat/nombre-corto`, `fix/nombre-corto`, `docs/nombre-corto`: una rama por tarea, que sale de `develop`.

## Commits

Formato `tipo: descripción corta en minúsculas`.

| Tipo | Uso |
| --- | --- |
| feat | nueva funcionalidad |
| fix | corrección de un error |
| docs | documentación |
| refactor | cambio de código sin cambiar el comportamiento |
| test | pruebas |
| chore | configuración y mantenimiento |

Ejemplos: `feat: agregar reporte de molestias`, `docs: actualizar requisitos del módulo 3`.

## Pull Requests

1. Describe qué cambia y qué requisito toca (por ejemplo RF-06).
2. Verifica que la integración continua pase (compila backend y frontend).
3. Actualiza `docs/requisitos.md` si cambió el estado de una función.

## Primer commit

```bash
git init
git add .
git commit -m "chore: esqueleto inicial del proyecto"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/luchasegura.git
git push -u origin main
git checkout -b develop && git push -u origin develop
```
