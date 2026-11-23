# Informe académico y técnico

## Problema, justificación y objetivos

La lucha libre olímpica exige movimientos explosivos, contacto, fuerza y control corporal. La fatiga y las dificultades para reconocer o comunicar molestias pueden afectar el cuidado y la continuidad deportiva. El documento de la Universidad del Rosario y el IDRD propone conocer las prácticas existentes y facilitar la incorporación progresiva de hábitos y ejercicios preventivos, según la edad, la experiencia y las cargas de los deportistas. El árbol de problemas vincula el descanso irregular, la comunicación insuficiente de molestias, las carencias de fortalecimiento y la orientación limitada con la exposición a factores de riesgo y la interrupción de entrenamientos. Véanse las secciones 1 a 3 y 5 del PDF de referencia, pp. 2–5 y 8–10.

El objetivo general es favorecer la prevención en luchadores competitivos mediante hábitos de cuidado y fortalecimiento específico. Los objetivos específicos son promover el manejo de la fatiga, el descanso y la recuperación, fomentar el calentamiento y fortalecimiento, conocer prácticas preventivas y sensibilizar sobre la comunicación de molestias. LuchaSegura aporta registros, orientación y seguimiento para esos objetivos. Las decisiones clínicas corresponden al equipo profesional.

## Metodología y alcance

La sección 7 describe un **diseño descriptivo** para recoger antecedentes, localización, severidad y tratamiento. La población propuesta es la selección Bogotá del IDRD, de género mixto y entre 13 y 25 años. El documento propone una ficha de lesión inspirada en sistemas de vigilancia de NCAA, UWW y COI, una encuesta a deportistas, preguntas al entrenador y una evaluación física y funcional. La semana 0 incorpora antecedentes, características antropométricas y deportivas, y mediciones iniciales. En semanas 1–8 se prevén tres sesiones de 20–30 minutos con carrera, fuerza, pliometría y equilibrio. Durante el programa se registra adherencia y lesiones cada semana. Al final se repiten las pruebas y la encuesta para comparar resultados. El producto esperado es una aplicación con perfil, identificación de factores de riesgo, orientación preventiva y seguimiento. Véanse pp. 13–18.

El sistema registra el perfil, las molestias y las sesiones y permite documentar evaluaciones por intervención. El diario de bienestar recoge fatiga, descanso, sueño y recuperación. Las encuestas de inicio, final y entrenador son instrumentos sintéticos versionados. La ficha de lesiones y la batería funcional tienen brechas respecto del PDF. La [matriz](MATRIZ.md) documenta cada diferencia.

## Arquitectura y persistencia

| Capa | Implementación |
|---|---|
| Cliente | Angular standalone 20.3.35, Router, HttpClient, SCSS y TypeScript 5.9.3. La interfaz utiliza rutas de deportista, equipo y administración con guards |
| API | Express 4.22.3 en Node.js, TypeScript 5.9.3, Zod para entradas y Prisma Client 6.19.3. `backend/src/app.ts` monta las rutas y middleware |
| Datos | PostgreSQL relacional. `backend/prisma/schema.prisma` y migraciones SQL son la referencia ejecutable |
| Archivos | ExcelJS 4.4.0. Los generadores reciben los datos autorizados de informes y aplican la plantilla profesional |
| Operación | CI reproduce builds, comprobaciones de tipos, Angular, API, Brave o Chromium, migraciones y restauración sintética |

`User` y `Athlete` separan cuenta y datos deportivos. `Consent` guarda la evidencia de aceptación del aviso de registro. `Program`, `ProgramSession`, `SessionExercise` y `CompletedSession` cubren el plan y cumplimiento. La intervención se identifica en módulos nuevos por programa y fecha civil de inicio. `Injury`, `Alert` y `AlertEntry` conservan el reporte y la historia de atención. `FunctionalTestRevision`, `WellbeingRevision` y `PreventiveSurveyRevision` versionan los cambios respectivos. `SleepSharing` y `PreventiveSurveyConsent` registran permisos específicos.

| API | Permisos y uso |
|---|---|
| `/api/auth` | Registro local, login, sesión, cambio y recuperación de contraseña |
| `/api/athletes/me`, `/api/injuries`, `/api/program` | Perfil, evaluaciones propias, bienestar, sueño, molestias y sesiones del deportista |
| `/api/team`, `/api/exercises`, `/api/rules` | Fichas, revisiones, evaluaciones y orientación. La API comprueba rol y aplica reglas de acceso por módulo |
| `/api/preventive-surveys` | Respuesta propia o cuestionario para un deportista asignado. Fisioterapia consulta según atención documentada y consentimiento. Función restringida a demostración |
| `/api/program-reports` | Informe propio y de fisioterapia con alcance documentado. Descargas `.xlsx` revalidan los permisos. Agregados restringidos a demostración |
| `/api/admin` | Administración de cuentas, roles, estado y asignación de entrenador |

El frontend usa guardas para navegación. El servidor verifica el usuario vigente, el rol y la relación con el deportista. Los módulos clínicos tienen alcances distintos. Bienestar, encuestas e informes de fisioterapia comprueban atención documentada. Entrenamiento consulta datos deportivos de sus asignados y solo recibe las horas de sueño cuando existe el permiso específico correspondiente. Administración queda fuera de las rutas clínicas.

## Resultados

- **Desarrollo.** La aplicación reúne cuatro recorridos y genera vistas e informes autorizados sobre registros persistentes. El [informe de pruebas](PRUEBAS.md) especifica cuáles se verificaron en esta fase.
- **Demostración.** Las diferencias de tiempos, porcentajes y conteos provienen de fixtures ficticias. Ilustran comparaciones, datos faltantes y acceso por rol.
- **Clínica.** La eficacia preventiva, el cambio atribuible al programa y los resultados en deportistas reales quedan sin demostrar. Para estudiarlos se requieren protocolo, autorización, instrumentos válidos y medición profesional.

La [documentación técnica de Fase 5](../avance/fase5-evaluaciones/README.md), el [diseño de encuestas](../avance/fase7-encuestas-preventivas/DECISIONES.md) y las [reglas de métricas](../avance/fase8-informes-comparativos/DATOS_Y_METRICAS.md) complementan el inventario.
