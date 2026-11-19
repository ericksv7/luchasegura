# Diagramas de flujo

Los rectángulos distinguen acciones de usuario y de sistema mediante su etiqueta. Los rombos indican decisiones.

## 1. Flujo general

```mermaid
flowchart LR
  A["Usuario · Ingresa"] --> B["Sistema · Abre el espacio del rol"]
  B --> C["Deportista · Registra actividad"]
  B --> D["Personal · Gestiona o consulta"]
  C --> E["Sistema · Persiste registros"]
  D --> E
  E --> F["Sistema · Actualiza consultas autorizadas"]
```

Los espacios comparten una base y cada consulta aplica los permisos correspondientes.

## 2. Autenticación y navegación

```mermaid
flowchart LR
  A["Usuario · Envía credenciales"] --> B{"Sistema · ¿Credenciales y cuenta válidas?"}
  B -->|No| C["Sistema · Rechaza"]
  B -->|Sí| D{"¿Cambio obligatorio?"}
  D -->|Sí| E["Usuario · Cambia contraseña"]
  E --> F["Sistema · Abre el espacio del rol"]
  D -->|No| F
```

Administrador va a Usuarios, deportista a Inicio y fisioterapeuta o entrenador a Resumen.

## 3. Administración de usuarios

```mermaid
flowchart LR
  A["Administrador · Abre Usuarios"] --> B["Administrador · Crea, edita o cambia estado"]
  B --> C{"Sistema · ¿Operación válida?"}
  C -->|Sí| D["Sistema · Guarda y actualiza la lista"]
  C -->|No| E["Sistema · Informa el motivo"]
  D --> F["Usuario nuevo · Cambia contraseña temporal al entrar"]
```

La última acción corresponde al alta. Los cambios de rol respetan los vínculos existentes.

## 4. Alta de deportista y asignación

```mermaid
flowchart LR
  A["Deportista · Completa Crear cuenta"] --> B["Sistema · Guarda cuenta, perfil y aceptación"]
  B --> C["Administrador · Abre Asignaciones"]
  C --> D{"¿Selecciona entrenador activo?"}
  D -->|Sí| E["Sistema · Guarda el vínculo"]
  D -->|Sin asignar| F["Sistema · Guarda sin entrenador"]
```

El entrenador obtiene acceso a la ficha deportiva al existir la asignación.

## 5. Antecedentes

```mermaid
flowchart LR
  A["Deportista · Perfil, Antecedentes"] --> B["Deportista · Agrega o edita"]
  B --> C{"Sistema · ¿Campos válidos y registro propio?"}
  C -->|Sí| D["Sistema · Guarda y permite consultar"]
  C -->|No| E["Sistema · Informa error"]
```

La edición aplica a antecedentes propios editables. El alta de antecedentes carece de generación de alertas.

## 6. Registro de molestias

```mermaid
flowchart LR
  A["Deportista · Reportar molestia"] --> B["Deportista · Completa y envía"]
  B --> C{"Sistema · ¿Solicitud válida?"}
  C -->|Sí| D["Sistema · Registra y evalúa umbral"]
  C -->|No| E["Sistema · Devuelve error"]
  D --> F["Deportista · Consulta su reporte"]
```

El servidor conserva el identificador de envío para resolver reintentos equivalentes.

## 7. Generación de alertas

```mermaid
flowchart LR
  A["Sistema · Recibe registro"] --> B{"¿Molestia actual con intensidad?"}
  B -->|No| E["Sistema · Guarda solo el registro"]
  B -->|Sí| C{"¿Cumple el umbral aplicable?"}
  C -->|Sí| D["Sistema · Guarda registro y alerta nueva"]
  C -->|No| E
```

Se usa la regla específica de zona si existe, o la general. Dentro de cada alcance prevalece la más reciente.

## 8. Revisión por fisioterapia

```mermaid
flowchart LR
  A["Fisioterapia · Abre alerta"] --> B["Fisioterapia · Registra revisión"]
  B --> C{"¿Necesita seguimiento?"}
  C -->|Sí| D["Sistema · Deja seguimiento pendiente"]
  C -->|No| E["Sistema · Deja alerta revisada"]
  D --> F["Sistema · Conserva actuación e historial"]
  E --> F
```

Se registran observaciones y actuación. Iniciar revisión registra una transición intermedia.

## 9. Seguimiento y finalización

```mermaid
flowchart LR
  A["Fisioterapia · Abre pendiente"] --> B["Fisioterapia · Registra actuación"]
  B --> C{"¿Finaliza seguimiento?"}
  C -->|No| D["Sistema · Mantiene pendiente con fecha opcional"]
  C -->|Sí| E["Sistema · Pasa a revisada"]
  E --> F["Fisioterapia · Puede reabrir"]
  F --> G["Sistema · Devuelve a pendientes de revisión"]
```

Cada revisión y reapertura agrega una actuación. El historial conserva el contexto anterior.

## 10. Programa preventivo de ocho semanas

```mermaid
flowchart LR
  A["Fisioterapia · Registra inicio"] --> B{"Sistema · ¿Llegó la fecha?"}
  B -->|No| C["Sistema · Aún sin semana activa"]
  B -->|Sí| D["Sistema · Calcula semana desde el inicio"]
  D --> E["Usuario · Consulta sesiones y ejercicios"]
```

La propuesta considera tres sesiones semanales durante ocho semanas. La aplicación usa las semanas del plan vigente y el calendario de Bogotá.

## 11. Sesiones completadas

```mermaid
flowchart LR
  A["Deportista · Elige Marcar o corrige la marca"] --> B{"Sistema · ¿Sesión vigente y habilitada?"}
  B -->|No| C["Sistema · Rechaza e informa"]
  B -->|Sí| D["Sistema · Crea o retira el registro"]
  D --> E["Sistema · Recalcula el avance consultable"]
```

La marca expresa una declaración del deportista y se conserva al recargar.

## 12. Ejercicio individual

```mermaid
flowchart LR
  A["Fisioterapia · Abre Ejercicios individuales asignados"] --> B["Fisioterapia · Elige ejercicio, dosis e indicación"]
  B --> C{"Sistema · ¿Asignación válida y única?"}
  C -->|No| D["Sistema · Informa el motivo"]
  C -->|Sí| E["Sistema · Persiste la asignación"]
  E --> F["Deportista · Consulta en Mi plan"]
```

La dosificación individual tiene prioridad sobre la general. El ejercicio se consulta separado de las sesiones.

## 13. Exportación Excel

```mermaid
flowchart LR
  A["Fisioterapia · Elige reporte y filtros"] --> B{"Sistema · ¿Permisos y filtros válidos?"}
  B -->|No| C["Sistema · Informa error"]
  B -->|Sí| D["Sistema · Consulta PostgreSQL"]
  D --> E{"¿Dentro del límite?"}
  E -->|Sí| F["Sistema · Entrega XLSX"]
  E -->|No| G["Sistema · Solicita acotar el alcance"]
```

El libro usa identificación directa o seudonimizada según la opción seleccionada.

## 14. Permisos

```mermaid
flowchart LR
  A["Usuario · Solicita un recurso"] --> B{"API · ¿Sesión válida y cuenta activa?"}
  B -->|No| C["API · Rechaza autenticación"]
  B -->|Sí| D{"API · ¿Rol y alcance autorizados?"}
  D -->|No| E["API · Deniega o no revela el registro"]
  D -->|Sí| F["API · Filtra campos y responde"]
```

Angular orienta la navegación. La autorización de los datos se aplica en cada ruta de la API.
