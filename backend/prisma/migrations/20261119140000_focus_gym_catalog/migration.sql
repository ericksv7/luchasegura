BEGIN;

-- Archive stock exercises out of scope plus exact matches for the named withdrawals.
-- Archived rows remain readable from sessions and existing assignments.
UPDATE "Exercise"
SET archived = true
WHERE NOT archived AND (
  ("isBase" AND component IN ('Estabilidad', 'Pliometría', 'Técnica', 'Recuperación')
    AND id <> 'base-rotacion-banda')
  OR ("isBase" AND name IN ('Círculos de hombro con banda', 'Curl nórdico asistido'))
  OR LOWER(TRIM(name)) IN (
    'puente de glúteo', 'puente de glúteos', 'movilidad de cadera',
    'movilidad de cadera en cuadrupedia', 'rotaciones torácicas', 'rotación torácica',
    'salto vertical con recepción'
  )
);

-- The band provides resistance through active shoulder rotation.
UPDATE "Exercise" SET component = 'Fuerza'
WHERE id = 'base-rotacion-banda' AND "isBase" AND component = 'Estabilidad';

WITH additions (id, name, component, zone, level, equipment, objective, description,
                instructions, mistakes, precautions, illustration) AS (
  VALUES
  ('gym-sentadilla-libre', 'Sentadilla con peso corporal', 'Fuerza', 'Cadera', 'Inicial', 'Ninguno', 'Practicar la flexión coordinada de caderas y rodillas.', 'Baja con los pies apoyados y vuelve a ponerte de pie.', 'Coloca los pies aproximadamente al ancho de los hombros.
Flexiona caderas y rodillas sin despegar los talones.
Empuja el suelo para ponerte de pie.', 'Levantar los talones o juntar las rodillas al subir.', 'Baja hasta una profundidad que puedas controlar.', '/exercises/sentadilla-libre.svg'),
  ('gym-prensa', 'Prensa de piernas', 'Fuerza', 'Rodilla', 'Inicial', 'Prensa inclinada de piernas', 'Practicar el empuje con ambos pies.', 'Empuja la plataforma sin despegar la pelvis del asiento.', 'Apoya la espalda y coloca ambos pies sobre la plataforma.
Suelta el seguro según las instrucciones de la máquina y baja el carro con control.
Empuja la plataforma sin bloquear las rodillas y vuelve a colocar el seguro al terminar.', 'Despegar la pelvis del respaldo o dejar que el carro baje de golpe.', 'Familiarízate con los seguros usando el carro sin carga adicional.', '/exercises/prensa.svg'),
  ('gym-extension-rodilla', 'Extensión de cuádriceps en máquina', 'Fuerza', 'Rodilla', 'Inicial', 'Máquina de extensión de rodilla', 'Trabajar la extensión de rodilla en un asiento estable.', 'Eleva el rodillo estirando las rodillas y vuelve despacio.', 'Ajusta el asiento para alinear las rodillas con el eje de la máquina.
Coloca el rodillo delante de las piernas, justo por encima de los tobillos.
Extiende las rodillas con control y regresa despacio.', 'Impulsarse con el tronco o dejar caer el peso.', 'Ajusta la máquina antes de elegir la carga.', '/exercises/extension-rodilla.svg'),
  ('gym-curl-femoral', 'Curl femoral sentado en máquina', 'Fuerza', 'Rodilla', 'Inicial', 'Máquina de curl femoral sentado', 'Trabajar la flexión de rodilla desde una posición sentada.', 'Lleva los talones hacia abajo doblando las rodillas.', 'Ajusta el asiento y alinea las rodillas con el eje de la máquina.
Coloca el rodillo detrás de la parte baja de las piernas y ajusta el apoyo del muslo.
Dobla las rodillas y vuelve despacio a la posición inicial.', 'Levantar la cadera o dejar que el rodillo regrese de golpe.', 'Verifica los ajustes con una carga ligera.', '/exercises/curl-femoral.svg'),
  ('gym-flexiones', 'Flexiones de brazos', 'Fuerza', 'Hombro', 'Inicial', 'Ninguno', 'Practicar el empuje con el tronco alineado.', 'Acerca el pecho al suelo y empuja para volver.', 'Coloca las manos algo más separadas que los hombros.
Con el cuerpo alineado, flexiona los codos y acerca el pecho al suelo.
Empuja el suelo hasta volver a la posición inicial.', 'Hundir la pelvis o abrir los codos completamente hacia los lados.', 'Usa una superficie elevada y firme si necesitas reducir la dificultad.', '/exercises/flexiones.svg'),
  ('gym-banca-barra', 'Press de banca con barra', 'Fuerza', 'Hombro', 'Intermedio', 'Banco plano, barra y soportes de seguridad', 'Practicar el empuje horizontal con barra.', 'Acerca la barra al pecho con control y empuja hasta sobre los hombros.', 'Recuéstate con los pies apoyados y agarra la barra con ambas manos.
Retira la barra del soporte y bájala con control hacia el pecho.
Empuja hacia arriba manteniendo las muñecas sobre los antebrazos.', 'Rebotar la barra en el pecho o levantar los glúteos.', 'Usa seguros a la altura adecuada o una persona que asista.', '/exercises/banca-barra.svg'),
  ('gym-remo-mancuerna', 'Remo con mancuerna a un brazo', 'Fuerza', 'Zona dorsal', 'Inicial', 'Banco plano y una mancuerna', 'Practicar la tracción hacia el costado con un apoyo estable.', 'Lleva el codo hacia la cadera sin girar el tronco.', 'Apoya una mano y la rodilla del mismo lado en un banco estable.
Con el pie contrario en el suelo, tira de la mancuerna hacia el costado.
Baja la mancuerna con control y cambia de lado.', 'Girar el pecho al subir o encoger el hombro.', 'Asegúrate de que el banco esté firme.', '/exercises/remo-mancuerna.svg'),
  ('gym-remo-polea', 'Remo sentado en polea', 'Fuerza', 'Zona dorsal', 'Inicial', 'Polea baja, banco y agarre de remo', 'Practicar la tracción horizontal con el tronco estable.', 'Lleva el agarre hacia el abdomen sin balancearte.', 'Siéntate con los pies apoyados y las rodillas ligeramente flexionadas.
Lleva el agarre hacia el abdomen y deja que los codos viajen hacia atrás.
Estira los brazos lentamente para regresar.', 'Inclinarse hacia atrás para mover la carga o encoger los hombros.', 'Elige una carga que puedas mover sin impulso.', '/exercises/remo-polea.svg'),
  ('gym-jalon', 'Jalón al pecho', 'Fuerza', 'Zona dorsal', 'Inicial', 'Polea alta con barra y apoyo de muslos', 'Practicar la tracción vertical frente al cuerpo.', 'Lleva la barra hacia la parte alta del pecho.', 'Ajusta el apoyo sobre los muslos y toma la barra con ambas manos.
Lleva la barra al frente del pecho con los codos hacia abajo.
Deja subir la barra despacio hasta estirar los brazos.', 'Llevar la barra detrás de la cabeza o balancear el torso.', 'Verifica el ajuste del apoyo antes de empezar.', '/exercises/jalon.svg'),
  ('gym-press-militar', 'Press militar con mancuernas', 'Fuerza', 'Hombro', 'Inicial', 'Dos mancuernas ligeras', 'Practicar el empuje vertical con ambas manos.', 'Empuja las mancuernas desde los hombros hasta sobre la cabeza.', 'Ponte de pie y lleva las mancuernas a la altura de los hombros.
Empújalas hacia arriba dentro de un recorrido cómodo.
Bájalas despacio hasta la altura inicial.', 'Arquear la espalda o empujar con un impulso de las piernas.', 'Acorta el recorrido si para completarlo tienes que arquear la espalda.', '/exercises/press-militar.svg'),
  ('gym-elevacion-lateral', 'Elevaciones laterales con mancuernas', 'Fuerza', 'Hombro', 'Inicial', 'Dos mancuernas ligeras', 'Practicar la elevación de los brazos hacia los lados.', 'Eleva los brazos hasta un punto cómodo próximo a los hombros.', 'Sostén una mancuerna a cada lado con los codos ligeramente flexionados.
Eleva los brazos hacia los lados sin encoger los hombros.
Baja con control.', 'Balancear el tronco o subir los hombros hacia las orejas.', 'Utiliza una carga que puedas levantar sin impulso.', '/exercises/elevacion-lateral.svg'),
  ('gym-curl-mancuerna', 'Curl de bíceps con mancuernas', 'Fuerza', 'Codo', 'Inicial', 'Dos mancuernas ligeras', 'Practicar la flexión de codo con carga.', 'Lleva las mancuernas hacia los hombros manteniendo quietos los brazos.', 'Ponte de pie con una mancuerna en cada mano y los codos al costado.
Flexiona los codos sin mover los hombros hacia delante.
Baja las mancuernas con control.', 'Balancear el cuerpo o doblar las muñecas.', 'Empieza con una carga que puedas bajar lentamente.', '/exercises/curl-mancuerna.svg'),
  ('gym-triceps-polea', 'Extensión de tríceps en polea', 'Fuerza', 'Codo', 'Inicial', 'Polea alta y barra corta', 'Practicar la extensión de codo con resistencia.', 'Empuja la barra hacia abajo con los codos junto al cuerpo.', 'Ponte frente a una polea alta y toma la barra con ambos codos cerca del tronco.
Estira los codos para bajar la barra.
Vuelve lentamente sin llevar los hombros hacia delante.', 'Separar los codos o inclinarse para vencer la carga.', 'Comprueba que el agarre esté enganchado antes de comenzar.', '/exercises/triceps-polea.svg'),
  ('gym-abdominal-corto', 'Abdominal corto', 'Core', 'Zona lumbar', 'Inicial', 'Colchoneta', 'Practicar una flexión corta del tronco.', 'Eleva apenas los hombros con los pies apoyados.', 'Túmbate boca arriba con las rodillas flexionadas y los pies en el suelo.
Acerca las costillas hacia la pelvis hasta separar los hombros de la colchoneta.
Baja despacio y respira con normalidad.', 'Tirar del cuello o transformarlo en una incorporación completa.', 'Mantén el movimiento corto y cómodo.', '/exercises/abdominal-corto.svg'),
  ('gym-dead-bug', 'Dead bug alternado', 'Core', 'Zona lumbar', 'Inicial', 'Colchoneta', 'Coordinar brazo y pierna opuestos con el tronco estable.', 'Extiende un brazo y la pierna contraria y cambia de lado.', 'Túmbate boca arriba con brazos elevados, caderas y rodillas flexionadas.
Baja un brazo hacia atrás y estira la pierna contraria sin arquear la espalda.
Vuelve al centro y alterna los lados.', 'Bajar más de lo que puedes controlar o contener el aire.', 'Reduce el recorrido si pierdes el apoyo del tronco.', '/exercises/dead-bug.svg'),
  ('gym-tobillo-pared', 'Movilidad de tobillo frente a pared', 'Movilidad', 'Tobillo o pie', 'Inicial', 'Pared', 'Explorar la flexión de tobillo con el talón apoyado.', 'Acerca la rodilla a la pared sin levantar el talón.', 'Coloca un pie cerca de la pared y apóyate con las manos.
Lleva la rodilla delantera hacia la pared en la dirección de los dedos del pie.
Vuelve al inicio y cambia de lado.', 'Levantar el talón o desviar la rodilla hacia dentro.', 'Acerca el pie a la pared si necesitas reducir el recorrido.', '/exercises/tobillo-pared.svg')
)
INSERT INTO "Exercise" (id, name, component, zone, level, equipment, objective, description,
                        instructions, mistakes, precautions, illustration, "isBase")
SELECT a.id, a.name, a.component, a.zone, a.level, a.equipment, a.objective, a.description,
       a.instructions, a.mistakes, a.precautions, a.illustration, true
FROM additions a
WHERE NOT EXISTS (
  SELECT 1 FROM "Exercise" e WHERE LOWER(TRIM(e.name)) = LOWER(a.name)
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
