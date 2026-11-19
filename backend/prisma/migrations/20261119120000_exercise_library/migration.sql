BEGIN;

ALTER TABLE "Exercise"
  ADD COLUMN "isBase" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "objective" TEXT,
  ADD COLUMN "level" TEXT,
  ADD COLUMN "equipment" TEXT,
  ADD COLUMN "instructions" TEXT,
  ADD COLUMN "mistakes" TEXT,
  ADD COLUMN "precautions" TEXT,
  ADD COLUMN "illustration" TEXT;

-- Enrich built-in seed rows in place so existing session and assignment references survive.
CREATE TEMP TABLE exercise_library (
  id TEXT, name TEXT, old_component TEXT, component TEXT, zone TEXT, level TEXT,
  equipment TEXT, objective TEXT, description TEXT, instructions TEXT, dosage TEXT,
  mistakes TEXT, precautions TEXT, illustration TEXT, old_description TEXT
) ON COMMIT DROP;

INSERT INTO exercise_library VALUES
  ('base-cadera', 'Movilidad de cadera en cuadrupedia', 'Movilidad', 'Movilidad', 'Cadera', 'Inicial', 'Colchoneta', 'Mover la cadera manteniendo el tronco estable.', 'Dibuja un círculo pequeño con la rodilla flexionada.', 'Mantén manos bajo los hombros y rodillas bajo las caderas.
Separa una rodilla y dibuja un círculo pequeño sin girar la pelvis.
Vuelve al apoyo y cambia de lado.', '2 × 6 por lado', 'Girar la pelvis o doblar los codos.', 'Reduce el círculo si pierdes el apoyo.', '/exercises/cadera.svg', 'Círculos amplios de cadera apoyado en manos y rodillas.'),
  ('base-toracica', 'Rotaciones torácicas', 'Movilidad', 'Movilidad', 'Zona dorsal', 'Inicial', 'Colchoneta', 'Practicar la rotación de la parte alta de la espalda.', 'Abre el codo desde una posición de cuatro apoyos.', 'Colócate en cuatro apoyos y lleva una mano detrás de la cabeza.
Abre ese codo hacia arriba mientras la pelvis se mantiene quieta.
Vuelve despacio y repite hacia el otro lado.', '2 × 8 por lado', 'Desplazar la pelvis o tirar del cuello.', 'Mantén la mirada acompañando el giro sin forzarlo.', '/exercises/toracica.svg', 'Rotación de la espalda alta apoyado en cuadrupedia.'),
  ('base-hombro', 'Círculos de hombro con banda', 'Movilidad', 'Movilidad', 'Hombro', 'Inicial', 'Banda ligera', 'Explorar un arco cómodo de movimiento de los hombros.', 'Eleva y baja los brazos con un agarre amplio.', 'Sostén la banda al frente con las manos más separadas que los hombros.
Eleva los brazos hacia arriba solo hasta donde el tronco siga quieto.
Regresa al frente y baja con control.', '2 × 8', 'Arquear la espalda o elevar los hombros hacia las orejas.', 'Usa poca tensión y un arco cómodo.', '/exercises/hombro.svg', 'Movimiento controlado en ambos sentidos.'),
  ('base-plancha', 'Plancha frontal', 'Estabilidad', 'Core', 'Zona lumbar', 'Inicial', 'Colchoneta', 'Sostener el tronco y la pelvis alineados.', 'Mantén una línea continua desde la cabeza hasta los talones.', 'Apoya los antebrazos con los codos bajo los hombros.
Estira las piernas y apoya las puntas de los pies.
Eleva la pelvis y respira mientras mantienes la postura.', '3 × 20 s', 'Hundir la cintura o aguantar la respiración.', 'Apoya las rodillas si no puedes mantener la alineación.', '/exercises/plancha.svg', 'Cuerpo alineado, abdomen firme.'),
  ('base-lateral', 'Plancha lateral', 'Estabilidad', 'Core', 'Zona lumbar', 'Intermedio', 'Colchoneta', 'Sostener el tronco de lado sin girar la pelvis.', 'Eleva la cadera con el peso sobre el antebrazo y los pies.', 'Túmbate de lado con el codo debajo del hombro y los pies juntos.
Eleva la cadera hasta alinear hombros, pelvis y tobillos.
Mantén la postura y baja lentamente antes de cambiar de lado.', '2 × 15 s por lado', 'Rodar hacia delante o hundir el hombro de apoyo.', 'Puedes flexionar las rodillas para reducir la carga.', '/exercises/lateral.svg', 'Cadera elevada, hombro sobre el codo.'),
  ('base-puente', 'Puente de glúteo', 'Estabilidad', 'Estabilidad', 'Cadera', 'Inicial', 'Colchoneta', 'Practicar la extensión de cadera con los pies apoyados.', 'Eleva la pelvis mientras mantienes los hombros en el suelo.', 'Túmbate boca arriba, flexiona las rodillas y apoya ambos pies.
Empuja el suelo con los pies hasta alinear muslos y tronco.
Pausa un segundo y baja despacio.', '2 × 12', 'Arquear la espalda o juntar las rodillas.', 'Eleva solo hasta donde puedas mantener el tronco cómodo.', '/exercises/puente.svg', 'Eleva la cadera y mantén un segundo arriba.'),
  ('base-nordico', 'Curl nórdico asistido', 'Fuerza', 'Fuerza', 'Rodilla', 'Avanzado', 'Colchoneta y compañero para sujetar los tobillos', 'Practicar un descenso controlado desde las rodillas.', 'Inclina el cuerpo en bloque con ayuda para frenar la bajada.', 'Arrodíllate sobre una superficie acolchada y pide a un compañero que sujete tus tobillos.
Inclínate despacio desde las rodillas manteniendo alineados tronco y muslos.
Recibe el peso con las manos y úsalas para volver.', '2 × 4', 'Doblar la cadera o dejarse caer sin control.', 'Requiere supervisión y un apoyo firme en los tobillos.', '/exercises/nordico.svg', 'Descenso lento con apoyo de las manos.'),
  ('base-zancada', 'Zancadas caminando', 'Fuerza', 'Fuerza', 'Rodilla', 'Intermedio', 'Ninguno', 'Trabajar el control al bajar y avanzar con un apoyo adelantado.', 'Alterna pasos amplios y flexiona ambas rodillas con control.', 'Da un paso hacia delante y apoya todo el pie delantero.
Flexiona ambas rodillas manteniendo el tronco erguido.
Empuja con el pie delantero, levántate y da el siguiente paso con la otra pierna.', '2 × 8 por pierna', 'Meter la rodilla delantera hacia dentro o levantar su talón.', 'Practica sin carga y con espacio libre.', '/exercises/zancada.svg', 'Paso largo y tronco erguido.'),
  ('base-sentadilla', 'Sentadilla goblet', 'Fuerza', 'Fuerza', 'Cadera', 'Intermedio', 'Mancuerna o pesa rusa ligera', 'Trabajar piernas y cadera con una carga al pecho.', 'Baja en sentadilla sosteniendo la carga cerca del tronco.', 'Sujeta la carga con ambas manos frente al pecho.
Flexiona caderas y rodillas manteniendo los pies completamente apoyados.
Empuja el suelo para volver a ponerte de pie.', '2 × 10', 'Levantar los talones o alejar la carga del pecho.', 'Elige una carga que te permita subir sin perder el equilibrio.', '/exercises/sentadilla.svg', 'Sostén una carga al pecho y baja con control.'),
  ('base-remo', 'Remo con banda', 'Fuerza', 'Fuerza', 'Zona dorsal', 'Inicial', 'Banda y anclaje firme', 'Practicar la tracción con los hombros relajados.', 'Tira de la banda llevando los codos hacia atrás.', 'Fija la banda a la altura del pecho y toma un extremo con cada mano.
Lleva los codos hacia atrás sin mover el tronco.
Estira los brazos lentamente para volver.', '2 × 12', 'Encoger los hombros o inclinarse hacia atrás.', 'Revisa la banda y el anclaje antes de empezar.', '/exercises/remo.svg', 'Lleva los codos atrás sin encoger los hombros.'),
  ('base-pasos', 'Desplazamientos laterales en postura de lucha', 'Técnica', 'Técnica', 'Cadera', 'Intermedio', 'Superficie firme y despejada', 'Coordinar pasos laterales y conservar el equilibrio.', 'Muévete lateralmente manteniendo la base de apoyo.', 'Flexiona ligeramente caderas y rodillas con los pies separados.
Da un paso corto al lado y acerca el otro pie sin juntarlos.
Repite en ambos sentidos con el tronco estable.', '3 × 20 s', 'Cruzar los pies o estirar las rodillas en cada paso.', 'Practica sin contacto sobre una superficie despejada.', '/exercises/pasos.svg', 'Mantén la postura baja y los pies activos.'),
  ('base-altura', 'Entradas a piernas sin oponente', 'Técnica', 'Técnica', 'Rodilla', 'Intermedio', 'Colchoneta', 'Practicar el cambio de altura y recuperar el equilibrio sin contacto.', 'Ensaya el descenso y el retorno en una base escalonada.', 'Empieza con un pie ligeramente adelantado y el peso repartido.
Flexiona ambas rodillas y baja solo hasta donde conserves el equilibrio.
Vuelve a subir con control y alterna el pie adelantado.', '2 × 6 por lado', 'Inclinarse en exceso o golpear la rodilla contra el suelo.', 'Realiza solo el cambio de altura sin contacto y a ritmo controlado.', '/exercises/altura.svg', 'Trabajo técnico a ritmo controlado.'),
  ('base-balanceo', 'Caídas controladas', 'Técnica', 'Técnica', 'Cadera', 'Intermedio', 'Colchoneta y supervisión', 'Practicar una transferencia de peso cerca del suelo.', 'Ensaya la preparación sentada antes de practicar caídas completas.', 'Siéntate en la colchoneta con rodillas flexionadas y pies apoyados.
Redondea suavemente el tronco y lleva el peso hacia atrás unos centímetros.
Regresa a la posición sentada conservando los pies apoyados.', '2 × 6', 'Impulsarse bruscamente o llevar el peso al cuello.', 'Completa cualquier práctica de caída solo con supervisión directa.', '/exercises/balanceo.svg', 'Practica la recepción con el cuerpo protegido.'),
  ('base-equilibrio', 'Equilibrio en un pie', NULL, 'Estabilidad', 'Tobillo o pie', 'Inicial', 'Pared o apoyo estable', 'Practicar el control del apoyo en una sola pierna.', 'Separa un pie del suelo y mantén la pelvis nivelada.', 'Ponte de pie cerca de un apoyo estable.
Eleva un pie unos centímetros y fija la mirada al frente.
Mantén la postura y cambia de pierna.', '2 × 20 s por lado', 'Inclinar la pelvis o bloquear la rodilla de apoyo.', 'Usa el apoyo si pierdes el equilibrio.', '/exercises/equilibrio.svg', NULL),
  ('base-salto', 'Salto vertical con recepción', NULL, 'Pliometría', 'Rodilla', 'Intermedio', 'Superficie firme y despejada', 'Practicar un aterrizaje estable después de un salto bajo.', 'Salta poca altura y recupera el equilibrio antes de repetir.', 'Separa los pies al ancho de la cadera y flexiona un poco las rodillas.
Haz un salto vertical bajo.
Aterriza con ambos pies y flexiona caderas y rodillas. Haz una pausa antes de repetir.', '2 × 5', 'Aterrizar rígido o juntar las rodillas.', 'Empieza con saltos bajos y detente si pierdes el control.', '/exercises/salto.svg', NULL),
  ('base-pantorrilla', 'Estiramiento de pantorrilla', NULL, 'Recuperación', 'Tobillo o pie', 'Inicial', 'Pared', 'Explorar un estiramiento suave de la pantorrilla.', 'Mantén el talón del pie atrasado en el suelo.', 'Apoya las manos en una pared y lleva un pie hacia atrás.
Flexiona la rodilla delantera y mantén recta la pierna trasera.
Sostén una tensión suave y cambia de lado.', '2 × 20 s por lado', 'Girar el pie trasero o despegar el talón.', 'Mantén la postura sin rebotes ni dolor.', '/exercises/pantorrilla.svg', NULL);

UPDATE "Exercise" e
SET "isBase" = true, component = b.component, zone = COALESCE(e.zone, b.zone),
    level = b.level, equipment = b.equipment, objective = b.objective,
    description = CASE WHEN e.description IS NULL OR e.description = b.old_description
      THEN b.description ELSE e.description END,
    instructions = b.instructions,
    dosage = COALESCE(e.dosage, b.dosage), mistakes = b.mistakes,
    precautions = b.precautions, illustration = b.illustration
FROM exercise_library b
WHERE e.name = b.name AND e.component = b.old_component;

INSERT INTO "Exercise" (id, name, component, zone, level, equipment, objective,
  description, instructions, dosage, mistakes, precautions, illustration, "isBase")
SELECT b.id, b.name, b.component, b.zone, b.level, b.equipment, b.objective,
  b.description, b.instructions, b.dosage, b.mistakes, b.precautions, b.illustration, true
FROM exercise_library b
WHERE NOT EXISTS (
  SELECT 1 FROM "Exercise" e WHERE e."isBase" AND e.name = b.name
);

COMMIT;
