# Paquete de Transferencia de Conocimiento · LuchaSegura para Claude

¡Bienvenido! Este paquete ha sido preparado para que puedas transferir de forma completa, estructurada y sin pérdidas todo el contexto técnico de la aplicación **LuchaSegura** a **Claude** (en su versión web o aplicación de escritorio).

---

## ¿Cómo utilizar este paquete con Claude?

### Opción A: Proyecto en Claude (Recomendada si tienes Claude Pro / Team)
1. En Claude (claude.ai), ve a la sección **Projects** y crea un nuevo proyecto llamado **"LuchaSegura"**.
2. En la sección **Project Knowledge**, sube los 5 documentos Markdown:
   - `01_PROYECTO_COMPLETO.md`
   - `02_AUDITORIA_TECNICA.md`
   - `03_PLAN_DE_MEJORAS.md`
   - `04_GUIA_PARA_CLAUDE.md`
   - `05_RESUMEN_EJECUTIVO.md`
3. En las instrucciones personalizadas del proyecto (*Custom Instructions*), pega el siguiente texto:
   > *"Eres el Ingeniero de Software Principal de LuchaSegura. Sigue estrictamente las pautas de `04_GUIA_PARA_CLAUDE.md`. Basa tus correcciones en `02_AUDITORIA_TECNICA.md` y propone los cambios siguiendo las tareas de `03_PLAN_DE_MEJORAS.md`. Entrega código completo y no asumas acceso directo al sistema de archivos."*
4. ¡Listo! Cualquier conversación dentro de ese proyecto tendrá todo el contexto precargado.

### Opción B: Conversación Estándar en Claude (Web o Desktop)
1. Inicia un nuevo chat en Claude.
2. Adjunta los archivos `05_RESUMEN_EJECUTIVO.md`, `04_GUIA_PARA_CLAUDE.md` y `03_PLAN_DE_MEJORAS.md`.
3. Inicia la conversación con este mensaje:
   > *"Hola Claude. Te acabo de adjuntar el paquete de transferencia técnica de mi proyecto LuchaSegura. Por favor lee `04_GUIA_PARA_CLAUDE.md` para entender cómo vamos a trabajar y `05_RESUMEN_EJECUTIVO.md` para el estado actual. Vamos a comenzar abordando la Fase 1 del plan de mejoras. ¿Estás listo?"*
4. Cuando vayan a trabajar en un archivo específico, puedes adjuntarle la copia correspondiente desde la carpeta `codigo_referencia/`.

---

## Contenido del Paquete

| Documento | Descripción y Uso |
| :--- | :--- |
| **`01_PROYECTO_COMPLETO.md`** | Especificación técnica exhaustiva: modelos Prisma, endpoints, arquitectura de Angular 20, flujo de información y reglas de negocio. |
| **`02_AUDITORIA_TECNICA.md`** | Diagnóstico técnico profundo: bugs confirmados, vulnerabilidades, cuellos de botella de rendimiento, evidencias con rutas y líneas de código. |
| **`03_PLAN_DE_MEJORAS.md`** | Hoja de ruta priorizada en 5 fases con tareas estructuradas (problema, archivos, solución técnica, riesgos y pasos de verificación). |
| **`04_GUIA_PARA_CLAUDE.md`** | Manual de operaciones específico para Claude: estándares de respuesta, entrega de código completo y cómo evitar regresiones. |
| **`05_RESUMEN_EJECUTIVO.md`** | Resumen de alto nivel del estado del sistema, fortalezas, semáforo de riesgos y próximos pasos recomendados. |
| **`codigo_referencia/`** | Copia exacta del código fuente limpio (backend, frontend, esquemas Prisma, migraciones, configs), excluyendo secretos y `node_modules`. |
| **`MANIFIESTO.txt`** | Listado de todas las rutas de archivos incluidos en el paquete. |

---

## Seguridad y Privacidad
- Este paquete **no contiene contraseñas, variables de entorno reales, tokens ni datos personales reales**.
- Los archivos `.env` han sido excluidos (solo se incluye `.env.example` con valores de ejemplo).
- Todo el código ha sido verificado con compiladores estáticos de TypeScript (`tsc --noEmit`).
