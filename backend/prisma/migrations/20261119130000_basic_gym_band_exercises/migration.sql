BEGIN;

-- Keep the jump in the catalog and in any plans or assignments that already use it.
UPDATE "Exercise"
SET component = 'Técnica'
WHERE id = 'base-salto' AND component = 'Pliometría';

-- Preserve any locally curated equivalent, including exercises already archived.
WITH additions (id, name, component, zone, equipment, objective, description,
                instructions, dosage, mistakes, precautions, illustration) AS (
  VALUES
  ('base-press-pecho', 'Press de pecho con mancuernas', 'Fuerza', 'Hombro',
   'Banco plano y dos mancuernas ligeras', 'Practicar el empuje horizontal con ambos brazos.',
   'Empuja las mancuernas desde los lados del pecho hasta quedar sobre los hombros.',
   'Túmbate en el banco con los pies apoyados y las mancuernas a los lados del pecho.
Empuja hacia arriba manteniendo las muñecas sobre los codos.
Baja con control hasta una altura cómoda.', '2 × 8–12',
   'Rebotar al bajar o abrir los codos completamente hacia los lados.',
   'Empieza con una carga que puedas bajar con control.', '/exercises/press-pecho.svg'),
  ('base-peso-rumano', 'Peso muerto rumano con mancuernas', 'Fuerza', 'Cadera',
   'Dos mancuernas ligeras', 'Practicar la bisagra de cadera mientras sostienes una carga.',
   'Lleva la cadera atrás y desliza las mancuernas cerca de los muslos.',
   'De pie, sostiene las mancuernas delante de los muslos y flexiona ligeramente las rodillas.
Lleva la cadera atrás, inclina el tronco y baja las mancuernas cerca de las piernas.
Regresa a la posición de pie empujando el suelo con ambos pies.', '2 × 8–10',
   'Alejar las mancuernas de las piernas o redondear la espalda para bajar más.',
   'Detén el descenso cuando ya no puedas mover la cadera sin cambiar la postura de la espalda.', '/exercises/peso-rumano.svg'),
  ('base-talones', 'Elevación de talones de pie', 'Fuerza', 'Tobillo o pie',
   'Pared o apoyo estable', 'Trabajar la pantorrilla al elevar y bajar los talones.',
   'Sube sobre la parte delantera de ambos pies y baja despacio.',
   'Ponte de pie con los pies al ancho de la cadera cerca de un apoyo.
Eleva ambos talones manteniendo el peso repartido entre los pies.
Haz una pausa breve y baja con control.', '2 × 12–15',
   'Rebotar o dejar que los tobillos se desvíen hacia los lados.',
   'Usa el apoyo para mantener el equilibrio y empieza en el suelo.', '/exercises/talones.svg'),
  ('base-escalon', 'Subida a escalón', 'Fuerza', 'Rodilla',
   'Escalón bajo y estable', 'Practicar la subida y la bajada con control en una pierna.',
   'Apoya el pie completo en un escalón bajo y sube con control.',
   'Coloca un pie completo sobre el escalón.
Empuja con esa pierna hasta quedar de pie arriba.
Baja primero el pie que subió en segundo lugar y cambia de lado al completar la serie.', '2 × 8 por pierna',
   'Impulsarse con el pie de abajo o dejar que la rodilla de apoyo caiga hacia dentro.',
   'Elige un escalón bajo, firme y antideslizante.', '/exercises/escalon.svg'),
  ('base-apertura-banda', 'Apertura horizontal con banda', 'Fuerza', 'Zona dorsal',
   'Banda elástica ligera', 'Practicar la tracción horizontal con los brazos a la altura del pecho.',
   'Separa las manos hacia los lados y vuelve despacio al centro.',
   'Sostén la banda frente al pecho con las manos al ancho de los hombros.
Separa las manos hacia los lados con los codos ligeramente flexionados.
Acerca las manos sin dejar que la banda vuelva de golpe.', '2 × 10–12',
   'Encoger los hombros o arquear la espalda para abrir más.',
   'Usa una banda que permita mantener el pecho y los hombros relajados.', '/exercises/apertura-banda.svg'),
  ('base-curl-banda', 'Curl de bíceps con banda', 'Fuerza', 'Codo',
   'Banda elástica ligera', 'Practicar la flexión de codo con resistencia.',
   'Eleva las manos hacia los hombros manteniendo los codos junto al cuerpo.',
   'Pisa el centro de la banda y toma un extremo con cada mano.
Flexiona los codos y lleva las manos hacia los hombros.
Baja despacio hasta casi estirar los brazos.', '2 × 10–12',
   'Balancear el tronco o llevar los codos hacia delante al subir.',
   'Asegura la banda bajo la parte media de los pies antes de empezar.', '/exercises/curl-banda.svg'),
  ('base-press-banda', 'Press de hombros con banda', 'Fuerza', 'Hombro',
   'Banda elástica larga y ligera', 'Practicar un empuje por encima de la cabeza con resistencia ligera.',
   'Empuja desde los hombros hacia arriba manteniendo el tronco estable.',
   'Pisa el centro de la banda y coloca las manos a la altura de los hombros.
Empuja las manos hacia arriba dentro de un recorrido cómodo.
Regresa despacio a la altura de los hombros.', '2 × 8–10',
   'Arquear la espalda o subir las manos a alturas distintas.',
   'Usa una banda larga que permita subir sin forzar el hombro.', '/exercises/press-banda.svg'),
  ('base-rotacion-banda', 'Rotación externa con banda', 'Estabilidad', 'Hombro',
   'Banda elástica ligera', 'Mover los antebrazos hacia fuera manteniendo los codos junto al tronco.',
   'Abre las manos con los codos flexionados y pegados al costado.',
   'Sostén la banda con las palmas hacia arriba y flexiona ambos codos en ángulo recto.
Separa las manos manteniendo los codos cerca del cuerpo.
Vuelve despacio al centro sin soltar la tensión de golpe.', '2 × 10–12',
   'Separar los codos del tronco o mover las muñecas en vez de los antebrazos.',
   'Elige poca resistencia y un recorrido cómodo.', '/exercises/rotacion-banda.svg')
)
INSERT INTO "Exercise" (id, name, component, zone, level, equipment, objective, description,
                        instructions, dosage, mistakes, precautions, illustration, "isBase")
SELECT a.id, a.name, a.component, a.zone, 'Inicial', a.equipment, a.objective, a.description,
       a.instructions, a.dosage, a.mistakes, a.precautions, a.illustration, true
FROM additions a
WHERE NOT EXISTS (
  SELECT 1 FROM "Exercise" e WHERE LOWER(TRIM(e.name)) = LOWER(a.name)
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
