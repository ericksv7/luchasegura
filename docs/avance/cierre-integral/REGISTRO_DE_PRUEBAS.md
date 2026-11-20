# Registro de pruebas

La auditoría previa completó 24 pruebas Angular y 42 de backend. Brave reprodujo el fallo Bogotá–UTC del antecedente sin fecha. Estos resultados corresponden a la base de la rama y no validan los cambios nuevos.

## A · Fechas y antecedentes

- Prisma Client generado y typecheck y compilación de ambos proyectos correctos.
- 27 pruebas Angular y 44 de backend aprobadas. Se incluyó el SMTP TLS sintético con Brave. El reloj de prueba cruzó medianoche UTC antes de medianoche Bogotá, con fin de año, fin de mes, año no bisiesto, día futuro, fecha omitida y eliminación explícita.
- Diez migraciones aplicadas a una base sintética con registros anteriores y sin diferencias de esquema. La prueba verifica que la marca temporal histórica se conserve.
- Brave completó los cuatro roles a las 19:30 de Bogotá, incluida la creación, edición y recarga del antecedente que fallaba en la auditoría. También pasaron Excel real y la prueba de PostgreSQL no disponible.

## B · Catálogo

`node backend/tests/run-catalog-migrations.cjs` pasó. Un clúster nuevo alojó tres bases sintéticas. Una se instaló desde cero, otra comenzó con las siete migraciones habituales y un ejercicio referenciado por sesión y asignación, y la tercera recibió la restauración. El ensayo conservó los vínculos, dosis y nota al archivar, verificó los 40 SVG, repitió el deploy y los tres seeds y cotejó los resultados de respaldo y restauración.

## C · Seguridad y H · Recuperación técnica

- `npm install` y `npm audit --omit=dev` terminaron con cero avisos para el backend tras fijar Effect 3.22.1 y deepmerge-ts 8.0.0 dentro de `@prisma/config`. Prisma 6.19.3 generó el cliente y aplicó migraciones en aislamiento. Se repitió el ensayo de catálogo y restauración.
- 45 pruebas de backend aprobadas. La regresión comprueba que reactivar una cuenta no devuelve acceso a sus sesiones o enlaces anteriores. Brave abrió el enlace recibido por SMTP TLS local, corroboró que el token desapareciera de la dirección y verificó el uso único.
- Builds de ambos proyectos y typecheck del backend correctos. Indisponibilidad de PostgreSQL verificada con 503. No se contactó al proveedor SMTP real.

## D y E · Consentimiento y los cuatro perfiles

- 27 pruebas Angular, 48 de backend, builds y typechecks aprobados. La prueba de registro compara la huella con el aviso exacto, rechaza versiones obsoletas y comprueba el caso de un menor en el límite Bogotá–UTC. Se verifica el bloqueo de edición cuando cambia una fecha que involucra a un menor.
- El recorrido general de Brave completó los cuatro roles y verificó historial, estados, permisos y Excel. La prueba aislada adicional en móvil abrió la [página pública](capturas/informacion-legal-movil.png), repitió el consentimiento y completó el registro de un deportista sintético.
- La migración de evidencia se aplicó solo a la base sintética y el esquema coincidió. La habilitación del registro institucional queda pendiente.

## F–G · Jerarquía visual y accesibilidad

Brave aprobó la prueba retrospectiva de desplegables, foco, color de contorno, movimiento reducido, teclado, toque, registro y Excel. Se probaron siete anchos en dos temas y texto al 200 % en el reporte. Firefox verificó el render de la información legal a 360 px. Pasaron 27 pruebas Angular y los typechecks de aplicación y especificaciones. El primer intento de medir contraste se interrumpió por la serialización de una función del test a otra ejecución JavaScript. Se corrigió la instrumentación y se repitió todo el recorrido específico.

## I–J · Exportación e intervención

- 49 pruebas de backend en Node.js 22.23.5. El libro predeterminado es seudonimizado. El modo identificable requiere selección explícita. Se comprobaron texto literal, fechas civiles y celda vacía para un antecedente sin fecha. El filtro temporal no incluye ese antecedente.
- Brave completó los cuatro perfiles con Node.js 22. Incluyó dosis indicada en la asignación y dosis orientativa en el [plan de prueba](capturas/plan-dosificacion-movil.png), biblioteca histórica, sesión, retiro, descarga y errores. El plan de una semana de la captura es un fixture del recorrido. Los seeds sintéticos completos generaron 24 sesiones.
- Se ajustaron dos aserciones a los contratos que comprueban. El reporte histórico que busca el nombre del programa solicita explícitamente el modo identificable y el foco se verifica con el contorno. La dosis personalizada se verifica sobre la asignación del deportista que está autenticado.

## K–L · Resiliencia y pipeline

- Node.js 22.23.5. Instalaciones limpias de ambos lockfiles en directorios descartables, auditoría de ejecución sin hallazgos npm, cero errores de typecheck y builds correctos. La instalación limpia de comprobación se hizo con scripts desactivados y se generó Prisma por separado en el checkout.
- 49 pruebas backend y 27 Angular. Se comprobó PostgreSQL inaccesible con respuesta 503 sin detalles de conexión. El ensayo de catálogo volvió a verificar los vínculos y recuperar un volcado sintético.
- La guarda de pruebas verifica la URL y después la identidad, puerto y directorio del clúster. Rechazó tres destinos impropios antes de conectar. Se comprobó la sintaxis del workflow y la ausencia de nombres de archivo sensibles previstos por el control. GitHub Actions queda por ejecutar mediante una publicación autorizada.
- Regresión final en Brave con la guarda reforzada: cuatro perfiles completos, 144 combinaciones de rol, pantalla, ancho y tema, y bloque específico de accesibilidad aprobado. Los clústeres quedaron detenidos.

## Segunda fase · verificación sobre b6d4e87 y cambios locales

- La rama comenzó limpia, con ocho commits locales. `develop`, `origin/develop` y la consulta remota de la referencia coincidieron en `1ba2a81`.
- Node.js 22.23.5. El frontend pasó typecheck de aplicación, typecheck de especificaciones y build de producción. La batería Angular pasó 29 pruebas, incluidas dos nuevas de fecha de Bogotá. Backend pasó typecheck, build y 49 pruebas, con seis de recuperación, incluido SMTP TLS y Brave. No se omitieron casos de esas suites.
- El arranque de producción respondió tanto con base disponible como con PostgreSQL inaccesible. En el segundo caso, salud y autenticación devolvieron 503 sin detalles de conexión.
- `node backend/tests/run-catalog-migrations.cjs` probó las 12 migraciones, actualización desde un esquema histórico, conservación de relaciones, despliegue y seeds repetidos, 40 SVG y restauración sintética.
- Auditoría npm de ejecución sin avisos en ambos proyectos. Auditoría completa de backend sin avisos y frontend con 16 moderados en herramientas de desarrollo.
- Brave completó las secciones de ficha, biblioteca y descarga XLSX. Se inspeccionó la [agenda en tema oscuro a 768 px](capturas/fase2-agenda-768-oscuro.png). La primera regresión completa alcanzó la comprobación final de agenda y falló al simular el estado vacío. El reintento usa una respuesta simulada con sus propias cabeceras y confirma previamente el seguimiento en la API real.
- La instalación descartable inicial en `/tmp` se interrumpió por falta de espacio y caché incompleta. Se inició una segunda instalación con acceso al registro en un directorio ignorado del repositorio.
- Destino habitual inspeccionado en una transacción SQL de solo lectura. Se confirmaron siete checksums y cinco migraciones pendientes. Los clústeres de ensayo usaron datos sintéticos y SMTP de loopback.
- La segunda instalación de los lockfiles terminó correctamente con `npm ci --ignore-scripts --no-audit`: 320 paquetes de backend y 545 de frontend. La comprobación de arranque y las compilaciones usaron las dependencias del checkout.
- La repetición completa en Brave pasó después de corregir la instrumentación de agenda. Confirmó los cuatro roles, 144 combinaciones de ruta, ancho y tema, y los estados de agenda con 0, 1 y 8 seguimientos. También verificó teclado, toque emulado, movimiento reducido, idempotencia, historial y correspondencia con la API y PostgreSQL. El clúster se detuvo.
- El recorrido específico `DISCLOSURE_VISUAL=1` aprobó apertura y cierre animados, chevron, teclado, toque emulado, contraste, zoom de texto, siete anchos en ambos temas, borradores, registro y Excel. Clúster detenido.
- El build Angular de esta fase informó 489,29 kB iniciales y 127,70 kB estimados de transferencia. El registro anterior indicaba 487,03 kB y 127,19 kB. La comparación mide compilaciones locales. Aún falta medir tiempos y consumo en el dispositivo objetivo.
- El ensayo consolidado posterior a la corrección de alcance de entrenador usó un directorio ignorado del repo tras detectar que un `TMPDIR` más profundo excedía el límite de 107 bytes de PostgreSQL para sockets Unix. La variante con ruta corta mantiene el clúster y la verificación de identidad independientes.
- En la regresión consolidada con el filtro de entrenador pasaron las 49 pruebas de API y SMTP y el recorrido completo de Brave sobre la misma versión de producto. Cero fallos u omisiones en las suites API. Se comprobaron la retirada de acceso al entrenador, la conservación de acceso de fisioterapia y la restitución de la asignación sin volver a autenticarse.
- Los 40 SVG estáticos se analizaron como XML. Todos tienen `viewBox`, CSS interno sin importaciones y referencias locales. La inspección no encontró scripts, eventos ni elementos de contenido incrustado. La revisión clínica de las ilustraciones permanece pendiente.
- Render verificado en [Firefox a 360 px](capturas/fase2-legal-firefox-360.png) sobre el build consolidado estático. El recorrido de formularios y permisos en Firefox queda pendiente.
