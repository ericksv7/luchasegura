# Matriz de cobertura y hallazgos

| ID / prioridad | Módulo y rol | Comportamiento esperado | Problema y causa | Corrección / componente | Prueba y evidencia | Estado / riesgo residual / aprobación |
| --- | --- | --- | --- | --- | --- | --- |
| A-01 P0 | Antecedentes · deportista, consulta de fisioterapia | Fecha civil opcional y edición de campos independientes | El editor corta el instante UTC y la API compara con el día de Bogotá | Separar fecha civil y marca temporal; ajustar ficha y Excel | Auditoría en Brave y API sintética reprodujo 400; nueva regresión pendiente | Verificado en aislamiento; cualquier migración habitual requiere autorización |
| B-01 P1 | Catálogo · cuatro roles según alcance | Vista actual y relaciones históricas preservadas | Dos migraciones de datos pendientes en la auditoría habitual | Ensayar historial, ejecución repetida y recursos estáticos | Auditoría: 7/9 aplicadas, 40 SVG | Ensayo y restauración verificados; autorización habitual pendiente |
| C-01 P1 | Permisos, autenticación y dependencias · cuatro roles | Acceso según rol, propietario y asignación | Riesgo de cadena Prisma/Effect y controles por validar en nueva revisión | Fijar dependencias transitivas, separar revocación y proteger transporte de tokens | 49 pruebas, SMTP Brave y auditoría npm | Verificado en aislamiento; CSP y proxy del despliegue pendientes |
| D-01 P0 antes de datos reales | Consentimiento · registro y edición de deportista | Versión verificable y situación del acudiente coherente | Versión aceptada desde el cliente, cambios de nacimiento sin reevaluación y texto en borrador | Validación en servidor y resolución institucional | Inspección inicial de rutas auth y athletes | Control técnico verificado; aprobación institucional pendiente |
| E-01 P1 | Flujos de los cuatro roles | Recorrido completo, errores y permisos | Brave se interrumpe en A-01 | Recorrido completo repetido tras A y D | Brave general y registro móvil | Verificado con datos sintéticos |
| F-01 / G-01 P2 | UI y accesibilidad · cuatro roles | Jerarquía, foco, contraste, responsive y movimiento | Revisión por pantalla pendiente | Tipografía compartida, bordes contrastados, zoom y foco móvil | Brave y capturas; render legal en Firefox | Controles verificados; tecnología de asistencia y cobertura transversal de otros motores pendientes |
| H-01 P1 | Correo · usuarios con cuenta | Restablecimiento TLS, único y caduco | Ensayo HTTPS y proveedor real pendientes | SMTP sintético y propuesta de verificación externa | Recuperación integral en Brave con SMTP TLS local | Verificado en aislamiento; proveedor real y HTTPS pendientes |
| I-01 P1 | Excel · fisioterapia | Permisos y datos íntegros, especialmente fechas civiles | Fecha histórica derivada del instante; Excel de escritorio pendiente | Fecha civil explícita y seudonimización predeterminada | Pruebas de integración y descarga real | Verificado; Microsoft Excel de escritorio pendiente |
| J-01 P1 | Intervención y evaluaciones · fisioterapia, deportista y entrenador | Plan e historial confiables, evaluación solo de consulta | Protocolos, dosis, umbrales e ilustraciones requieren revisión | Verificación técnica; aprobación profesional separada | Suite de programa, catálogo y evaluaciones | Verificado funcionalmente; validación clínica pendiente |
| K-01 / M-01 P1 | Operación · responsable técnico | Recuperación, HTTPS y restauración comprobada | Infraestructura objetivo aún no verificada | Ensayo sintético y procedimientos | Salud, 503 y restauración sintética | Verificado en aislamiento; despliegue y operación institucional pendientes |
| L-01 P1 | CI · mantenimiento | Ejecutar regresiones de API en cambios futuros | CI solo compila backend | Añadir suite con PostgreSQL aislado y SMTP local | Guarda de clúster, pruebas en Node.js 22 y sintaxis del workflow | Verificado localmente; ejecución en GitHub pendiente |
| N-01 P2 | Documentación · cuatro roles y operación | Evidencia y manuales vigentes | Inventario de migraciones de entrega desactualizado | Actualizar solo documentos afectados | Comparación con el árbol y matriz de aceptación | Actualizado en los documentos versionados afectados |

### Seguimiento de fase 3

- C2-02 · Revocación individual persistente. Verificada en pruebas API con dos sesiones simultáneas y una prueba Angular de fallo de red. Se añade una migración de esquema.
- C2-01 · Cobertura automatizada de guard por método y ruta, con JWT revocado, sin autenticación y roles excluidos. Véase la [matriz de permisos](MATRIZ_PERMISOS.md).
- F2-02 / G2-01 · Los avisos ocupan espacio en el flujo de la página y dejan libres los controles. La comprobación de lectores de pantalla requiere un entorno con tecnología instalada.

### Fase 4 · experiencia móvil

- M4-01 · La regla base de entrada tenía mayor especificidad que el ajuste móvil. Brave a 414 × 896 midió 15 px en correo y contraseña. Un token de entrada compartido fija `max(16px, 1rem)` en pantallas estrechas o con puntero táctil. Cubre campos, selectores y áreas de texto. Se conserva el viewport con ampliación manual.
- M4-02 · El acceso usaba el tamaño dinámico del viewport como altura mínima y carecía de margen seguro lateral. El marco usa `100svh` como mínimo, mantiene el desplazamiento natural y respeta las áreas seguras. Se ajustaron también la navegación, la cabecera y la página legal.
- M4-03 · El botón de visibilidad de contraseña tenía un área de 36 × 36 px. Pasa a 44 × 44 px con espacio reservado en el campo. La prueba táctil conserva valor, selección y autocompletado.
