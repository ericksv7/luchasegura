import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ForgotPage } from './forgot.page';

describe('Recuperación por correo', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [ForgotPage],
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
  }));

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('valida correo, evita doble envío y espera la respuesta antes de mostrar instrucciones', () => {
    const fixture = TestBed.createComponent(ForgotPage);
    const page = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    page.submit();
    http.expectNone('/api/auth/forgot-password');

    page.form.setValue({ email: 'cuenta@example.test' });
    page.submit();
    page.submit();
    const request = http.expectOne('/api/auth/forgot-password');
    expect(request.request.body).toEqual({ email: 'cuenta@example.test' });
    expect(page.requested()).toBeFalse();
    expect(page.loading()).toBeTrue();
    request.flush({}, { status: 202, statusText: 'Accepted' });
    expect(page.requested()).toBeTrue();
    expect(page.loading()).toBeFalse();
  });

  it('conserva el correo ante indisponibilidad y muestra el error público', () => {
    const page = TestBed.createComponent(ForgotPage).componentInstance;
    page.form.setValue({ email: 'cuenta@example.test' });
    page.submit();
    TestBed.inject(HttpTestingController).expectOne('/api/auth/forgot-password')
      .flush({ error: 'Recuperación no disponible' }, { status: 503, statusText: 'Unavailable' });
    expect(page.requested()).toBeFalse();
    expect(page.error()).toBe('Recuperación no disponible');
    expect(page.form.getRawValue().email).toBe('cuenta@example.test');
  });
});
