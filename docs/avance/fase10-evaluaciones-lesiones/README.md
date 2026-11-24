# Fase 10 · Evaluaciones y ficha de lesiones

La rama `feature/fase10-evaluaciones-lesiones` parte de `feature/fase9-preparacion-entrega` en `1636104`. Para integrar las fases en orden, revisa y fusiona primero Fase 9 y después Fase 10.

La ficha profesional incluye FMS, LESS, un registro fechado de semana 0 y la caracterización de antecedentes y molestias. El deportista puede consultar las evaluaciones que le corresponden. El informe individual compara FMS y LESS cuando las dos fases cumplen las condiciones. El Excel usa las hojas y el formato de Fase 8.

## Demostración

Desde la raíz, con dependencias instaladas:

```bash
DATABASE_URL=postgresql://generator@127.0.0.1:1/luchasegura_codegen_unused npm --prefix backend run db:generate
npm --prefix frontend run build
TMPDIR=/tmp npm --prefix backend test -- --reports-demo
```

Abre `http://127.0.0.1:4288/login`. Usa `fisioterapia-fase8@example.test` o `completa-fase8@example.test` con la contraseña ficticia `Informes-sinteticos1`. El ejecutor imprime la ficha autorizada. En la ficha, abre **Evaluaciones** para ver semana 0, FMS y LESS en ambas fases. Abre **Antecedentes y molestias** para consultar el antecedente sintético de hombro y su caracterización. En el informe, verifica ambas comparaciones y descarga el Excel. El caso `parcial-fase8@example.test` está activo y puede registrar una sesión, bienestar y una molestia.

Ctrl+C detiene el servidor y su clúster temporal. [Instalación](../../entrega-academica/INSTALACION.md) · [Modelo y protocolos](MODELO_Y_PROTOCOLOS.md) · [Pruebas](PRUEBAS.md) · [Pendientes](PENDIENTES.md)
