import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  imports: [RouterLink],
  template: `
    <main class="legal">
      <header>
        <a routerLink="/login">Volver a LuchaSegura</a>
        <h1>Privacidad, uso y accesibilidad</h1>
        <p class="notice">Borrador para revisión institucional. El entorno de demostración usa datos ficticios.</p>
      </header>

      <section aria-labelledby="treatment">
        <h2 id="treatment">Tratamiento de datos personales</h2>
        <p>LuchaSegura registra información de cuenta y perfil, antecedentes, molestias, revisiones y cumplimiento del programa. Los registros de salud contienen datos sensibles.</p>
        <p>La finalidad propuesta es apoyar el seguimiento del programa preventivo. Para el uso institucional falta aprobar el responsable del tratamiento, el contacto para ejercer derechos, las finalidades autorizadas y los plazos de conservación.</p>
        <p>La política definitiva debe explicar cómo consultar, corregir y actualizar datos, solicitar su supresión cuando proceda y presentar reclamos. El canal institucional está pendiente de confirmación.</p>
      </section>

      <section aria-labelledby="privacy">
        <h2 id="privacy">Privacidad y confidencialidad</h2>
        <p>El acceso depende del perfil. El entrenador consulta un conjunto limitado de datos de sus deportistas asignados. Fisioterapia consulta los registros del equipo y puede descargar reportes. El administrador gestiona cuentas y asignaciones.</p>
        <p>Los reportes seudonimizados reemplazan identificadores directos. La combinación de fechas y otros datos puede permitir reidentificar a una persona. La institución debe definir cómo proteger, conservar y eliminar las copias exportadas.</p>
        <p>El procedimiento para autorización y participación de menores está pendiente. El nombre del acudiente en la demostración registra lo declarado por la persona que completa el formulario.</p>
      </section>

      <section aria-labelledby="terms">
        <h2 id="terms">Condiciones de uso y alcance</h2>
        <p>Usa tu propia cuenta y conserva la confidencialidad de la información a la que tengas acceso. En la demostración, ingresa únicamente datos ficticios.</p>
        <p>LuchaSegura apoya el registro y seguimiento de la intervención preventiva. La valoración, el diagnóstico y la dosificación clínica corresponden al profesional a cargo.</p>
      </section>

      <section aria-labelledby="credits">
        <h2 id="credits">Derechos y créditos</h2>
        <p>La aplicación incluye recursos propios del proyecto y dependencias de terceros con sus licencias. La titularidad y las atribuciones institucionales definitivas están pendientes de confirmación.</p>
      </section>

      <section aria-labelledby="access">
        <h2 id="access">Accesibilidad</h2>
        <p>La interfaz cuenta con controles nativos, foco visible, temas claro y oscuro y una opción de movimiento reducido del sistema. Se prueban el teclado y distintos tamaños en Brave. Quedan por completar la revisión con tecnologías de asistencia y las pruebas en dispositivos físicos.</p>
      </section>
    </main>
  `,
  styles: `
    .legal {
      --legal-gutter: clamp(1rem, 4vw, 3rem);
      max-inline-size: 48rem;
      padding: max(var(--legal-gutter), env(safe-area-inset-top, 0px))
        max(var(--legal-gutter), env(safe-area-inset-right, 0px))
        max(var(--legal-gutter), env(safe-area-inset-bottom, 0px))
        max(var(--legal-gutter), env(safe-area-inset-left, 0px));
      margin-inline: auto;
    }
    section { margin-block-start: 1.5rem; }
    h1 { font-size: var(--text-page); }
    h2 { font-size: var(--text-section); }
    p { overflow-wrap: anywhere; }
  `,
})
export class LegalPage {}
