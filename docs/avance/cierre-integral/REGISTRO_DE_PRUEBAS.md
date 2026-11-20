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

## Fase 3 · seguridad

- Node.js 22.23.5. Prisma Client generado, backend typecheck y build aprobados. `npm test -- --availability` pasó autorización, sesiones, recuperación SMTP de loopback y 503 controlado.
- La prueba de cierre confirma JWT distintos en dos logins simultáneos, 204 en dos cierres concurrentes del mismo JWT, rechazo 401 posterior, persistencia del hash y otra sesión activa en un proceso backend nuevo. La prueba Angular comprueba la retirada local inmediata y la advertencia si falla la red.
- El ensayo de catálogo y restauración sintética completó 13 migraciones. La nueva tabla se verificó en la comparación del esquema. La base habitual quedó fuera de esta fase.
- La auditoría npm de ejecución de ambos proyectos y la completa de backend informaron cero avisos. La completa de frontend mantiene 16 moderados. GitHub Actions remoto no se ejecutó. El pipeline actual ejecuta `security.test.ts` mediante `npm test`.
- Lectores de pantalla: Orca y el ejecutable de Speech Dispatcher no estaban disponibles. En equipo físico, recorrer login y un formulario de equipo con lector y teclado. Comprobar aviso de red, anuncio único, foco visible, cierre y continuación de tabulación. Repetir con contraste alto y ambos temas.
- La ejecución final API y SMTP en Brave pasó 52 casos (28 de flujos, 6 de Excel, 12 de seguridad y 6 de correo), sin omisiones. Los cambios de correo y rol invalidaron credenciales anteriores. La prueba de persistencia abrió otro proceso backend y verificó ambos JWT contra el mismo PostgreSQL sintético.
- Angular pasó typecheck de aplicación y especificaciones, build y 30 casos. La advertencia de fallo de red se mostró tras la salida local.
- `DISCLOSURE_VISUAL=1` pasó con el build final. Reproduce fallo de red al cerrar sesión y confirma que el aviso y el formulario no se superponen y que el foco sigue visible a 320, 360, 390, 768, 1024 y 1440 px, en ambos temas y al 200 %. El aviso enfocado se pudo cerrar con Enter. El primer intento detectó superposición a 1024 px y motivó extender el diseño en flujo a escritorio.
- Inspección visual de la [agenda a 768 px en tema oscuro](capturas/fase3-agenda-768-oscuro.png) con nombres sintéticos y texto extenso.
- La regresión general de Brave terminó sobre el build final. Pasaron cuatro perfiles, 144 combinaciones de ruta, ancho y tema, descarga de Excel, revisión y reapertura, biblioteca, navegación y reglas de acceso. Los cierres explícitos del recorrido verificaron 204 en la API y 401 al presentar el JWT previo. El primer intento se detuvo al interactuar con el desplegable durante la transición. El recorrido final esperó el cambio de estado y verificó la apertura con Enter. Los clústeres de las ejecuciones finalizadas quedaron detenidos.

## Fase 4 · experiencia móvil

- Antes del cambio, Brave en emulación táctil a 414 × 896 midió 15 px en correo y contraseña. Después midió 16 px y conservó el valor y la selección al alternar la contraseña.
- Pasaron 60 combinaciones de login, registro y correo de recuperación en Chromium con emulación móvil. Incluyen dos temas, diez dimensiones, 414 × 896, horizontal 896 × 414 y altura reducida 414 × 350. Se midió la escala de `visualViewport` antes y después del foco y se verificó que el botón de envío sigue alcanzable al desplazar. La altura reducida se simuló cambiando el viewport. El teclado virtual y el gesto físico de ampliación requieren un dispositivo.
- Firefox 160 con WebDriver BiDi pasó foco y medidas del login a 320 × 640, 414 × 896 y 896 × 414. WebKitGTK MiniBrowser con WebDriver pasó a 414 × 791. Ambos midieron 16 px en los campos de acceso y no mostraron desbordamiento. Son motores de escritorio y la medición se hizo en el tema inicial del sistema.
- Los ensayos de base nueva, actualización, restauración e integridad del catálogo pasaron con 13 migraciones y 40 SVG. En PostgreSQL habitual solo se consultó el historial mediante una sesión de solo lectura y se confirmaron los 13 checksums.
- Auditoría npm de ejecución sin avisos en frontend ni backend. La auditoría completa mantiene 16 avisos moderados de desarrollo en frontend y cero en backend. Las correcciones propuestas por el registro requieren actualizaciones mayores, sin cambios de versión en esta fase.
- Capturas con credenciales vacías y foco visible [tema claro](capturas/fase4-login-414-light.png) y [tema oscuro](capturas/fase4-login-414-dark.png).
- Los primeros intentos consolidados detectaron problemas en el entorno y en la sincronización de pruebas. El proceso de inicialización agotó su tiempo en una ejecución y pasó posteriormente. En la emulación de recuperación se cambió la interacción de ratón a toque y se añadió la comprobación explícita de la respuesta HTTP. El recorrido visual pasó el caso móvil nuevo, pero una ejecución no observó un fotograma intermedio del chevron y otra agotó el tiempo de navegación. Se dejó la página de animación en primer plano y se espera el estado del DOM y los elementos pertinentes.
- El build final produjo 494,27 kB iniciales y 128,68 kB estimados de transferencia. Ambos typechecks de frontend, build y 30 tests pasaron. Backend pasó typecheck y build, además de 52 pruebas, sin omisiones en esa ejecución. El caso SMTP de loopback pasó en Brave táctil a 414 × 896 y midió las dos contraseñas de restablecimiento.
- El recorrido general de Brave pasó sobre el build final con los cuatro perfiles, 216 combinaciones de ruta, ancho y tema entre 320 y 1920 px, y medición de campos visibles en los anchos estrechos. Pasaron Excel descargado, sesiones, permisos, antecedentes, revisiones, seguimientos, biblioteca y confirmaciones. El clúster se detuvo.
- El recorrido visual final pasó las 60 combinaciones de acceso, la apertura y el cierre animados, teclado, toque, contraste, texto ampliado, avisos, borradores y Exportación Excel. `suite=0 visual=0`. Las aserciones nuevas ya son invocadas por CI. GitHub Actions remoto sigue pendiente.

## Cierre de integración · 20 de noviembre de 2026

- El usuario probó personalmente LuchaSegura en un iPhone 11 y en un teléfono Android. Ambas pruebas fueron satisfactorias y el usuario no reportó problemas. La corrección móvil queda cerrada para los flujos efectivamente comprobados, salvo que se descubra una regresión. No se registraron aquí recorridos, versiones de SO o navegadores específicos ni se extrapola el resultado a otros equipos.
- Sobre `1bb9555` pasaron los typechecks de aplicación y especificaciones Angular y el typecheck de backend. Los builds de producción y 30 pruebas Angular pasaron con Node.js 22.23.5 y Brave en modo headless para las pruebas. El build Angular completó con el aviso de optimización CommonJS de SweetAlert2.
- El ensayo aislado de catálogo pasó con instalación limpia, actualización histórica, despliegue y seeds repetidos, conservación de 40 SVG y restauración sintética. La base habitual confirmó en solo lectura 13 migraciones aplicadas y 13 checksums coincidentes.
- Pasaron 52 pruebas de backend sin omisiones: 28 de flujos, 6 de Excel, 12 de seguridad y 6 de recuperación con SMTP TLS en loopback y Brave. Incluyen autenticación, revocación persistente de sesiones, permisos, fechas y respuestas 503 controladas cuando el PostgreSQL aislado no está disponible.
- Pasó de nuevo el recorrido `DISCLOSURE_VISUAL=1` con 60 combinaciones móviles, teclado, toque, foco, contraste, zoom, borradores, registro y descarga Excel. Confirmó también el arranque de producción y la equivalencia del esquema Prisma en el clúster temporal. Para la regresión general de 216 combinaciones y cuatro perfiles se conserva la ejecución de fase 4 sobre el mismo código de producto. El commit `1bb9555` contiene documentación y capturas.
