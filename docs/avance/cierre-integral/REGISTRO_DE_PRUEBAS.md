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
