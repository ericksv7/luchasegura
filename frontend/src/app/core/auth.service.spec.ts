import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';

describe('Cierre de sesión', () => {
  it('retira el acceso local y avisa si el servidor no confirma la revocación', async () => {
    const warning = jasmine.createSpy('warning');
    const navigateByUrl = jasmine.createSpy('navigateByUrl');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        { provide: Router, useValue: { navigateByUrl } },
        { provide: ToastService, useValue: { warning, dismissPresentation: jasmine.createSpy('dismissPresentation') } },
      ],
    });
    const auth = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);
    sessionStorage.setItem('ls_token', 'credencial-sintetica');
    auth.user.set({ id: 'prueba', fullName: 'Usuario de prueba', role: 'ATHLETE' });

    const closing = auth.endSession();
    const request = http.expectOne('/api/auth/logout');
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer credencial-sintetica');
    expect(auth.token).toBeNull();
    expect(auth.user()).toBeNull();
    expect(navigateByUrl).toHaveBeenCalledWith('/login');
    request.error(new ProgressEvent('error'));
    await closing;
    expect(warning).toHaveBeenCalledWith('Saliste de esta pestaña. No pudimos confirmar el cierre en el servidor.');
    http.verify();
  });
});
