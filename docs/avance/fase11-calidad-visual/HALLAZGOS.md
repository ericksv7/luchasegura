# Hallazgos visuales

| Prioridad | Hallazgo reproducido | Corrección |
|---|---|---|
| P1 | En la ficha móvil de entrenador, Sueño quedaba fuera de vista en una tira con un único borde como pista | Las fichas con hasta cuatro secciones usan dos columnas por debajo de 600 px. Fisioterapia conserva su tira desplazable |
| P1 | El selector de acción de seguimiento cortaba el texto que distingue mantener el caso pendiente de finalizarlo | «Mantener pendiente» cabe en el control. La ayuda que explica la finalización conserva su contenido y queda asociada al selector |
| P2 | El nombre de la cuenta se truncaba en el sidebar y dos nombres sintéticos se veían prácticamente iguales | El nombre ocupa las líneas necesarias en el espacio disponible. Se conserva la ubicación de los iconos |
| P2 | En el resumen de fisioterapia, «Todo al día» convivía con seguimientos pendientes | «Sin alertas por revisar» identifica solo el estado de esa lista. El contador usa singular cuando corresponde |
| P2 | Usuarios mostraba acciones iconográficas dispersas en móvil que dependían de hover para revelar texto | Editar, Activar, Desactivar y Eliminar conservan sus iconos y muestran etiquetas en móvil. Los botones se agrupan y admiten salto de línea |
| P2 | En anchos con barra clásica, registro y recuperación tenían distinto ancho de lectura cuando una página tenía desplazamiento vertical | Se reservó el espacio de la barra de desplazamiento en el acceso y en escritorio. La navegación móvil conserva todo su ancho |
| P3 | En recuperación, el regreso a login quedaba alineado al margen mientras el pie de acceso y las acciones de las otras pantallas se centraban | El enlace usa el patrón de navegación secundaria de registro y login |

La matriz original señaló superposiciones dentro de un desplegable cerrado en la revisión de alertas. Esos elementos estaban fuera de interacción. El detector ahora excluye ese contenido y conserva la comprobación para desplegables abiertos. También reconoce el botón para mostrar la contraseña como superposición deliberada dentro del campo, que reserva espacio propio.
