# Inventario de rutas

Generado desde el arreglo de rutas Angular y la vista abierta con cada cuenta. Los formularios y acciones se cuentan en el estado inicial. Las comprobaciones combinan ancho y tema.

| Ruta | Rol | Componente | Formularios | Encabezado o estado | Acciones visibles | Comprobaciones |
|---|---|---|---:|---|---|---:|
| `/informacion-legal` | Público | `./pages/legal.page` | 0 | Privacidad, uso y accesibilidad | — | 18 |
| `/login` | Público | `./pages/login.page` | 1 | Iniciar sesión | Entrar | 18 |
| `/registro` | Público | `./pages/register.page` | 1 | Crear cuenta | Crear cuenta | 18 |
| `/olvide-contrasena` | Público | `./pages/forgot.page` | 1 | Recuperar contraseña | Enviar instrucciones | 18 |
| `/restablecer` | Público | `./pages/reset.page` | 0 | Enlace no válido | Solicitar nuevo enlace | 18 |
| `/cambiar-contrasena` | Deportista | `./pages/change-password.page` | 1 | Cambia tu contraseña | Guardar contraseña, Cancelar | 18 |
| `/deportista` | Deportista | `./athlete/home.page` | 0 | Hola, completa | Ver mi plan, Reportar molestia | 18 |
| `/deportista/reportar` | Deportista | `./athlete/report.page` | 1 | Reportar molestia | Cuello, Hombro, Codo, Muñeca o mano, Zona dorsal, Zona lumbar, Cadera | 18 |
| `/deportista/plan` | Deportista | `./athlete/plan.page` | 0 | Aún no tienes ejercicios asignados | Ir a ejercicios individuales, Ir al programa, 1, 2, 3, 4, 5 | 18 |
| `/deportista/progreso` | Deportista | `./athlete/progress.page` | 0 | Sin datos de dolor | Ver informe del programa | 18 |
| `/deportista/progreso/informe` | Deportista | `./reports/program-report.page` | 0 | Informe del programa | Descargar Excel individual | 18 |
| `/deportista/encuestas` | Deportista | `./surveys/surveys.page` | 0 | Encuestas preventivas | Consultar respuestas, Consultar respuestas, Retirar autorización | 18 |
| `/deportista/bienestar` | Deportista | `./athlete/wellbeing.page` | 0 | Mi bienestar | Registrar bienestar, Corregir registro, Ver historial de cambios, Corregir registro, Ver historial de cambios, Corregir registro, Ver historial de cambios | 18 |
| `/deportista/evaluaciones` | Deportista | `./team/athlete-evaluations` | 0 | Mis evaluaciones funcionales | — | 18 |
| `/deportista/perfil` | Deportista | `./athlete/profile.page` | 0 | Mi perfil | Editar, Agregar, Editar, Eliminar, Cambiar contraseña, Cerrar sesión | 18 |
| `/cambiar-contrasena` | Fisioterapia | `./pages/change-password.page` | 1 | Cambia tu contraseña | Guardar contraseña, Cancelar | 18 |
| `/equipo` | Fisioterapia | `./team/overview.page` | 1 | Sin alertas por revisar | Ver informe grupal del programa, Descargar Excel, Ver todos los seguimientos, Registrar seguimiento | 18 |
| `/equipo/alertas/:id` | Fisioterapia | `./team/alert-review.page` | 1 | Seguimiento de alerta | Iniciar seguimiento, Guardar seguimiento | 18 |
| `/equipo/alertas` | Fisioterapia | `./team/alerts.page` | 0 | Sin alertas en esta consulta | — | 18 |
| `/equipo/deportistas` | Fisioterapia | `./team/athletes.page` | 0 | Deportistas | Todos, Revisar, Seguimiento pendiente, Baja adherencia, Sin iniciar, Al día | 18 |
| `/equipo/informes-programa` | Fisioterapia | `./reports/program-report.page` | 0 | Informe grupal | Descargar Excel grupal | 18 |
| `/equipo/deportistas/:id/informe` | Fisioterapia | `./reports/program-report.page` | 0 | Informe del programa | Descargar Excel individual | 18 |
| `/equipo/deportistas/:id/encuestas` | Fisioterapia | `./surveys/surveys.page` | 0 | Encuestas preventivas | Consultar respuestas, Consultar respuestas | 18 |
| `/equipo/deportistas/:id` | Fisioterapia | `./team/athlete-detail.page` | 0 | Sin reportes de dolor | Abrir revisiones y seguimientos | 18 |
| `/equipo/ejercicios` | Fisioterapia | `./team/exercises.page` | 0 | Biblioteca de ejercicios | Ir a deportistas, Nuevo ejercicio, Apertura horizontal con bandaSepara las manos hacia los lados y vuelve despacio al centro.Implementos · Banda elástica ligera, Editar, Archivar, Curl de bíceps con bandaEleva las manos hacia los hombros manteniendo los codos junto al cuerpo.Implementos · Banda elástica ligera, Editar | 18 |
| `/equipo/umbrales` | Fisioterapia | `./team/rules.page` | 1 | Umbrales de alerta | Eliminar, Guardar umbral | 18 |
| `/cambiar-contrasena` | Entrenador | `./pages/change-password.page` | 1 | Cambia tu contraseña | Guardar contraseña, Cancelar | 18 |
| `/equipo` | Entrenador | `./team/overview.page` | 0 | Sin alertas por revisar | — | 18 |
| `/equipo/alertas` | Entrenador | `./team/alerts.page` | 0 | Sin alertas en esta consulta | — | 18 |
| `/equipo/deportistas` | Entrenador | `./team/athletes.page` | 0 | Deportistas | Todos, Revisar, Seguimiento pendiente, Baja adherencia, Sin iniciar, Al día | 18 |
| `/equipo/deportistas/:id/encuestas` | Entrenador | `./surveys/surveys.page` | 0 | Encuestas preventivas | Comenzar encuesta | 18 |
| `/equipo/deportistas/:id` | Entrenador | `./team/athlete-detail.page` | 0 | Sin reportes de dolor | Ver programa y ejercicios, Abrir cuestionario | 18 |
| `/equipo/ejercicios` | Entrenador | `./team/exercises.page` | 0 | Biblioteca de ejercicios | Apertura horizontal con bandaSepara las manos hacia los lados y vuelve despacio al centro.Implementos · Banda elástica ligera, Curl de bíceps con bandaEleva las manos hacia los hombros manteniendo los codos junto al cuerpo.Implementos · Banda elástica ligera, Curl de bíceps con mancuernasLleva las mancuernas hacia los hombros manteniendo quietos los brazos.Implementos · Dos mancuernas ligeras, Curl femoral sentado en máquinaLleva los talones hacia abajo doblando las rodillas.Implementos · Máquina de curl femoral sentado, Elevaciones laterales con mancuernasEleva los brazos hasta un punto cómodo próximo a los hombros.Implementos · Dos mancuernas ligeras, Elevación de talones de pieSube sobre la parte delantera de ambos pies y baja despacio.Implementos · Pared o apoyo estable, Extensión de cuádriceps en máquinaEleva el rodillo estirando las rodillas y vuelve despacio.Implementos · Máquina de extensión de rodilla | 18 |
| `/equipo/umbrales` | Entrenador | `./team/rules.page` | 0 | Umbrales de alerta | — | 18 |
| `/cambiar-contrasena` | Administración | `./pages/change-password.page` | 1 | Cambia tu contraseña | Guardar contraseña, Cancelar | 18 |
| `/admin` | Administración | `./admin/users.page` | 0 | Usuarios | Nuevo usuario, Todos · 8, Deportistas · 4, Entrenadores · 1, Fisioterapeutas · 2, Administradores · 1, Editar | 18 |
| `/admin/asignaciones` | Administración | `./admin/assignments.page` | 0 | Asignaciones | Todos · 4, Sin entrenador · 2 | 18 |
