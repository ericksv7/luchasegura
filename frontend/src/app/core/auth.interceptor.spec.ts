import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('Respuestas de autenticación y sesión actual', () => {
  it('ignora el 401 de un token anterior y cierra la sesión si falla el token actual', () => {
    const auth = { token: 'token-anterior', logout: jasmine.createSpy('logout') };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth }
      ]
    });
    const client = TestBed.inject(HttpClient);
    const http = TestBed.inject(HttpTestingController);

    const request = () => {
      client.get('/api/auth/me').subscribe({ error: () => {} });
      return http.expectOne('/api/auth/me');
    };
    const expired = { status: 401, statusText: 'Unauthorized' };
    const previous = request();
    expect(previous.request.headers.get('Authorization')).toBe('Bearer token-anterior');
    auth.token = 'token-actual';
    previous.flush({}, expired);
    expect(auth.logout).not.toHaveBeenCalled();

    const current = request();
    expect(current.request.headers.get('Authorization')).toBe('Bearer token-actual');
    current.flush({}, expired);
    expect(auth.logout).toHaveBeenCalledTimes(1);
    http.verify();
  });
});
