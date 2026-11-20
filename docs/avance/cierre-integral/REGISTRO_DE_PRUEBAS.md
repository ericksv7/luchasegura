# Registro de pruebas

La auditoría previa completó 24 pruebas Angular y 42 de backend. Brave reprodujo el fallo Bogotá–UTC del antecedente sin fecha. Estos resultados corresponden a la base de la rama y no validan los cambios nuevos.

## A · Fechas y antecedentes

- Prisma Client generado y typecheck y compilación de ambos proyectos correctos.
- 27 pruebas Angular y 44 de backend aprobadas. Se incluyó el SMTP TLS sintético con Brave. El reloj de prueba cruzó medianoche UTC antes de medianoche Bogotá, con fin de año, fin de mes, año no bisiesto, día futuro, fecha omitida y eliminación explícita.
- Diez migraciones aplicadas a una base sintética con registros anteriores y sin diferencias de esquema. La prueba verifica que la marca temporal histórica se conserve.
- Brave completó los cuatro roles a las 19:30 de Bogotá, incluida la creación, edición y recarga del antecedente que fallaba en la auditoría. También pasaron Excel real y la prueba de PostgreSQL no disponible.
