# LuchaSegura · Entrega académica

Este paquete parte de la Fase 9, preparada sobre `334080f590562f5a5a64ab31527f24097165ec71` (PR #5). Incluye referencias a las evaluaciones y lesiones de Fase 10 y a la revisión visual de Fase 11.2. La presentación utiliza exclusivamente cuentas y registros sintéticos.

| Archivo o recurso | Propósito |
|---|---|
| [Instalación](INSTALACION.md) | Requisitos, comandos, servicios, pruebas y diagnóstico de arranque |
| [Manual y guion](DEMOSTRACION.md) | Recorridos por rol y dos versiones de la presentación |
| [Informe académico y técnico](INFORME.md) | Problema, objetivos, metodología, arquitectura, persistencia y permisos |
| [Matriz de requisitos](MATRIZ.md) | Contraste con el PDF, evidencia reproducible y brechas |
| [Informe de pruebas](PRUEBAS.md) | Entorno, resultados y alcance de la verificación |
| [Capturas sintéticas](evidencias/) | Ficha profesional en escritorio e informe individual en móvil |
| [Cierre y privacidad](CIERRE.md) | Estado de entrega, condiciones del piloto y pendientes clasificados |
| [Evaluaciones y lesiones](../avance/fase10-evaluaciones-lesiones/README.md) | Semana 0, FMS, LESS, caracterización y protocolos |
| [Galería visual](../avance/fase11-ux-consolidacion/galeria.html) | Comparaciones de ficha, LESS y administración |
| [Diseño Excel](../avance/fase8-informes-comparativos/EXCEL.md) | Plantillas y ejemplos sintéticos aprobados |
| [PDF de referencia](../referencias/PROYECTO%20DEPORTE%20DE%20LUCHA%20LIBRE%20OL%C3%8DMPICA.pdf) | Fuente primaria para consulta interna |
| [Documentación integral anterior](../entrega/README.md) | Diagramas, modelo y material histórico anterior a las fases recientes |

La entrega se reconstruye desde la rama revisada. Para obtener un archivo que contenga únicamente la documentación de Fase 9, ejecuta desde la raíz:

```bash
git archive --format=zip --output=/tmp/luchasegura-entrega-academica.zip HEAD docs/entrega-academica
unzip -Z1 /tmp/luchasegura-entrega-academica.zip
```

Los enlaces relativos se consultan en el repositorio. Comparte el PDF fuente únicamente con el alcance autorizado por sus titulares. Las plantillas se reproducen con la demostración o se consultan en el directorio de ejemplos sintéticos de Fase 8. Mantén fuera de cualquier paquete los archivos de entorno, instalaciones locales, cachés, volcados y registros de ejecución.
