# Fase 6 · Mi bienestar

Mi bienestar reúne autorregistros voluntarios de sueño, descanso, fatiga y recuperación durante el programa preventivo. El deportista puede dejar respuestas sin contestar, consultar fechas anteriores, corregir sus datos y revisar sus versiones.

## Recorrido

1. En un entorno con datos sintéticos, entra como fisioterapia y registra el inicio desde **Equipo → Deportistas → Ficha → Programa**.
2. Entra con la cuenta del deportista y abre **Mi bienestar → Registrar bienestar**. Elige una fecha disponible, responde al menos un campo y guarda.
3. En **Mis registros**, abre **Detalles → Corregir registro** o **Ver historial de cambios**. En **Evolución**, filtra los registros cargados por semana y abre **Consultar datos por fecha**.
4. Para la consulta profesional, abre **Equipo → Deportistas → Ficha → Bienestar** con una cuenta de fisioterapia que haya documentado una revisión clínica o una evaluación de ese deportista.

| Rol | Acceso |
| --- | --- |
| Deportista | Sus registros, correcciones, versiones y observaciones privadas. |
| Fisioterapia | Consulta de los valores vigentes para deportistas con atención documentada por esa cuenta. |
| Entrenador | Solo fechas y horas de sueño en la ficha del deportista asignado, con autorización válida. |
| Administrador | Gestión de cuentas y asignaciones. Acceso denegado a bienestar y horas de sueño. |

Las rutas nuevas son `/deportista/bienestar`, `/equipo/deportistas/:id?tab=wellbeing`, `/api/athletes/me/wellbeing` y `/api/team/athletes/:id/wellbeing`. La ruta propia permite listar, crear, consultar un registro, corregirlo y consultar versiones. La ruta profesional solo lista.

La interpretación clínica, la política institucional de acceso y conservación y la aprobación del tratamiento de datos reales se revisan por separado. [Decisiones](DECISIONES.md) · [Pruebas](PRUEBAS.md)

## Ampliación · Evolución del sueño

- **Deportista → Progreso → Evolución del sueño**. Selecciona intervención y semana con datos. Abre **Ver tabla de horas de sueño** para consultar cada fecha y valor exacto.
- **Fisioterapia → Deportistas → Ficha → Bienestar**. La gráfica usa el mismo alcance de atención documentada que el resto de la pestaña.
- **Entrenador → Deportistas → Ficha → Sueño**. Selecciona un deportista asignado. La gráfica se habilita solo si ese deportista autorizó expresamente a esa cuenta de entrenador.

Para ensayar la autorización, registra un adulto sintético con el flujo normal de consentimiento y asigna su entrenador desde Administración. En la cuenta del deportista, abre **Mi bienestar → Privacidad del sueño**, verifica el destinatario, marca la autorización y guárdala. Registra horas y consulta la gráfica como entrenador. Vuelve a **Privacidad del sueño**, elige **Retirar acceso al sueño** y vuelve a abrir la ficha como entrenador. La consulta queda denegada inmediatamente en el servidor. La vista ya abierta se vuelve a validar al recuperar el foco.

## Cierre estable

La rama local `feature/fase6-cierre-estable` parte de `852e27f`. El rediseño
`11652ba` queda en la rama original de Fase 6. La recuperación conserva los
autorregistros, las correcciones y versiones, las gráficas con filtros por
intervención y semana, la consulta profesional y la autorización revocable para
un entrenador asignado. El enlace «Saltar al contenido» enfoca el área principal
en los cuatro perfiles.

### Abrir una instancia sintética

Desde la raíz del repositorio, en Bash con PostgreSQL y las dependencias de npm
disponibles, inicia un clúster temporal y prevé su cierre al salir:

```bash
(
  set -e
  demo="$(mktemp -d /tmp/luchasegura-demo.XXXXXX)"
  initdb -D "$demo/data" -U ls_demo --auth=trust --no-locale --encoding=UTF8
  pg_ctl -D "$demo/data" -l "$demo/postgres.log" \
    -o "-h 127.0.0.1 -p 55436 -k $demo" -w start
  trap 'pg_ctl -D "$demo/data" -m fast -w stop' EXIT
  createdb -h 127.0.0.1 -p 55436 -U ls_demo luchasegura_cierre_demo
  export DATABASE_URL=postgresql://ls_demo@127.0.0.1:55436/luchasegura_cierre_demo
  export NODE_ENV=development PORT=3000 MAIL_TRANSPORT=disabled
  export DOTENV_CONFIG_PATH=/dev/null
  JWT_SECRET="$(openssl rand -hex 32)"
  export JWT_SECRET
  npm --prefix backend run db:deploy
  npm --prefix backend run db:seed
  (cd backend && ./node_modules/.bin/tsx prisma/seed-program.ts)
  npm --prefix backend run dev
)
```

En otra terminal, ejecuta `npm --prefix frontend start` y abre
`http://localhost:4200` en Brave. El seed crea `admin@demo.local`,
`fisio@demo.local` y `entrenador@demo.local`, con la contraseña de demostración
`Cambiar123!`. Registra un deportista adulto ficticio desde la pantalla de
registro para obtener el consentimiento de desarrollo. Asígnalo desde
**Administración → Asignaciones** y sigue el recorrido anterior. Fija el inicio
de la intervención para ayer o antes. Guarda dos
fechas de sueño, corrige una de ellas y consulta la tabla de **Progreso**.
Comprueba como entrenador la ficha antes de autorizar, después de autorizar y
después de retirar la autorización. Para confirmar la privacidad, revisa que
esa ficha solo muestre horas y fechas, y que Administración permita gestionar
asignaciones sin mostrar bienestar. Detén ambos servidores con `Ctrl+C`.

En producción la compartición sigue bloqueada mientras los avisos de
consentimiento estén en borrador. El acceso a datos de sueño de menores requiere
un procedimiento institucional válido.
