# Decisiones y riesgos

- Las pruebas de escritura usan clústeres sintéticos independientes. La base habitual queda fuera de los cambios. Preparar la autorización de migraciones por separado.
- Consentimiento, tratamiento de menores, finalidades, retención y responsables requieren revisión institucional. Las evaluaciones, el programa y los umbrales requieren revisión académica y de fisioterapia.
- La validación de SMTP real y cualquier despliegue externo requieren autorización. La batería automatizada solo usa SMTP en loopback.
- La fecha de un antecedente es un dato civil opcional. La marca histórica se conserva como dato de auditoría y orden, incluso si no se conoce una fecha civil. La migración conserva el día UTC que mostraba el editor anterior cuando la marca difiere de la de creación. Si ambas coinciden, registra fecha desconocida. Esa coincidencia fue el valor por defecto del sistema anterior y por sí sola no permite demostrar si hubo una fecha explícita.
