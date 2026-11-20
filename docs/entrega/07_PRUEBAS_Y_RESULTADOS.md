# Pruebas y resultados

## Verificación de esta edición

| Comprobación | Resultado de la edición de noviembre de 2026 |
| --- | --- |
| Angular | Compilación de desarrollo completada y 24 de 24 pruebas Jasmine y Karma aprobadas en Brave. |
| Backend | Compilación TypeScript completada. |
| Integración | 40 aprobadas, 0 fallidas y 1 omitida. Distribución: 22 de alertas y flujos, 5 de exportación y plan, 8 de seguridad, 5 de correo. El caso opcional omitido corresponde al navegador con enlace SMTP. |
| Capturas | 37 pantallas y estados capturados en Brave con backend y PostgreSQL temporal, seis migraciones aplicadas y datos ficticios. |
| Gmail | La recepción previa del mensaje de diagnóstico fue confirmada por el usuario. La entrega de un enlace Gmail y su canje todavía requieren verificación. |

## Evidencia de referencia

La Fase 6 contrastó el informe de Fase 5 con los archivos de pruebas y con los registros locales disponibles de la ejecución del 18 de noviembre de 2026. Esos registros confirman 21 casos Angular y tres suites de API con 22, 5 y 8 casos correctos. Las cifras son de una ejecución por suite. La Fase 6 valida documentación, diagramas y PDF.

| Comprobación de Fase 5 | Evidencia y resultado |
| --- | --- |
| Angular con Jasmine y Karma en Brave | **21 de 21**. Incluye formulario de revisión, sesión, respuestas tardías y panel de reportes. |
| API y PostgreSQL aislado | **35 de 35**. 22 en `alert-reviews.test.ts`, 5 en `team-export.test.ts` y 8 en `security.test.ts`. |
| TypeScript y compilación | Frontend, especificaciones y backend correctos. La compilación Angular consulta la fuente Manrope para la configuración de producción actual. |
| Prisma | Esquema válido, migraciones verificadas con un registro previo, estado y comparación de esquema en base aislada. |
| Resiliencia | Inicio de producción local, PostgreSQL disponible y caso aislado sin conexión con 503 en salud y acceso. |
| Seguridad e integridad | Cuenta desactivada, sesiones inválidas, cambios de contraseña, permisos, recuperación de un solo uso, concurrencia y límites. |
| Excel | Lectura automatizada de hojas, filtros, filas y tipos, texto literal, seudonimización y error explícito sobre el límite de 5.000 registros. Brave cotejó los bytes descargados y probó fallo de red. |
| UI | Cuatro roles en Brave, variantes clara y oscura, teclado, tacto emulado y movimiento reducido. Excel y seguimiento a 320, 390, 768, 1024 y 1440 px. |

[Informe Fase 5](../avance/FASE_5_SEGURIDAD_Y_PRUEBAS.md) · [Pruebas fuente](../../backend/tests) · [Evidencias sintéticas Excel](../avance/evidencias-fase-4)

## Flujos y roles

| Flujo | Recorrido y respaldo |
| --- | --- |
| A | Administrador crea y edita cuenta, verifica acceso y espacio de rol. API y navegador. |
| B | Deportista registra molestia, reintenta y fisioterapia consulta la alerta. API y navegador. |
| C | Fisioterapia registra, finaliza y reabre, con historial y estado persistidos. API y navegador. |
| D | Fisioterapia asigna y retira ejercicios, deportista consulta su plan. API y navegador. |
| E | Sesión del deportista actualiza avance profesional y persiste ante reintentos. API y PostgreSQL. |
| F | Fisioterapia aplica filtros y descarga un archivo cotejado. API, Brave y PostgreSQL. |

El entrenador también recorrió su menú, fichas y programa. Las pruebas de API comprobaron límites por asignación y acceso restringido a notas, evaluaciones y Excel clínico.

## Historial y límites

El historial de Git identifica los avances de estabilidad y funcionalidad (`319e72c` y `d20cdb2`). La Fase 2 documentó sus recorridos por rol. Las fases 3 y 4 produjeron capturas responsive y evidencias Excel sintéticas. Sus cifras previas representan estados anteriores. La auditoría temprana indicaba cuatro migraciones y ausencia de pruebas backend dentro de `backend/src`. Al cierre de esa fase el repositorio contenía seis migraciones y los casos de integración viven en `backend/tests`. No se localizó un informe independiente titulado Fase 1. [Auditoría previa](../claude-handoff/02_AUDITORIA_TECNICA.md)

La Fase 5 documentó Node.js 26.13.1, npm 12.2.2 y PostgreSQL 18.7. Las pruebas describen el entorno local aislado. Quedan pruebas representativas en dispositivos físicos, otros navegadores, Microsoft Excel y una infraestructura de producción. No hay evidencia de resultados clínicos en estas suites.

[Estado funcional Fase 2](../avance/FASE_2_ESTADO_FUNCIONAL.md) · [Fase 3](../avance/FASE_3_UX_UI.md) · [Fase 4](../avance/FASE_4_DATOS_Y_EXPORTACIONES.md)

## Permisos, privacidad y controles operativos

| Recurso o acción | Administrador | Fisioterapeuta | Deportista | Entrenador |
| --- | --- | --- | --- | --- |
| Identidad y estado de cuentas | Gestiona | Cuenta propia | Cuenta propia | Cuenta propia |
| Asignar entrenador | Gestiona | Consulta en contexto | — | — |
| Perfil y actividad | Gestión de identidad | Consulta de equipo | Propios | Consulta asignada y recortada |
| Historial profesional y evaluación | — | Gestiona actuaciones y consulta evaluaciones | Estado permitido | Estado permitido por asignación |
| Inicio y sesiones | — | Registra inicio | Declara sesiones propias | Consulta asignada |
| Catálogo y umbrales | — | Gestiona | Consulta ejercicios de su plan | Consulta |
| Excel clínico | — | Descarga | — | — |

Los controles combinan guard de Angular, autenticación y verificación de permisos en Express. Los endpoints de equipo limitan al entrenador por asignación. El despliegue debe definir titulares y responsables de los datos, consentimiento y representación de menores, retención, atención de solicitudes, mecanismos de auditoría y tratamiento de archivos exportados. La aceptación almacenada en `Consent` conserva versión, fecha y acudiente cuando corresponde. El proyecto trata información de salud y la institución debe validar el procedimiento aplicable antes de usar datos reales.
