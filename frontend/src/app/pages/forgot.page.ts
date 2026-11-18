import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthShell } from '../core/auth-shell';

@Component({
  selector: 'app-forgot',
  imports: [RouterLink, AuthShell],
  template: `
    <app-auth-shell>
      <div class="form">
        <div>
          <h1>Recuperar contraseña</h1>
          <p class="sub">La recuperación por correo todavía no está disponible. Contacta al equipo administrador para solicitar ayuda con tu cuenta.</p>
        </div>
        <a class="btn" routerLink="/login">Volver a iniciar sesión</a>
      </div>
    </app-auth-shell>
  `
})
export class ForgotPage {}
