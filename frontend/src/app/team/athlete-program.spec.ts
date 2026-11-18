import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from '../core/auth.service';
import { AthleteDetail } from '../core/team-athlete-api';
import { AthleteProgram } from './athlete-program';

const athlete: AthleteDetail = { id:'athlete',name:'Deportista',email:'test@example.test',coachName:null,
  profile:{birthDate:null,weightKg:null,category:null,style:null,yearsExperience:null,notes:null},
  program:{id:'program',name:'Programa de prueba',weeks:8,sessionsPerWeek:3,currentWeek:0,startedAt:null,sessions:[]},
  compliance:0,planned:0,done:0,weekBars:[],injuries:[] };

describe('Inicio real de intervención', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports:[AthleteProgram], providers:[provideHttpClient(),provideHttpClientTesting(),
    {provide:AuthService,useValue:{user:()=>({role:'PHYSIO'})}}] }));
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  it('conserva la fecha ante un error de red y evita envíos repetidos mientras guarda', async () => {
    const fixture=TestBed.createComponent(AthleteProgram);
    fixture.componentRef.setInput('athlete',athlete);fixture.detectChanges();
    const component=fixture.componentInstance, http=TestBed.inject(HttpTestingController);
    component.form.setValue({startedAt:'2026-11-01'});
    let saved=0;component.saved.subscribe(()=>saved++);
    await component.save();await component.save();
    const request=http.expectOne('/api/team/athletes/athlete/program-start');
    expect(request.request.body).toEqual({startedAt:'2026-11-01',expectedStartedAt:null});
    request.error(new ProgressEvent('error'));
    expect(component.form.getRawValue().startedAt).toBe('2026-11-01');
    expect(component.saving()).toBeFalse();expect(component.error()).toContain('conectar');expect(saved).toBe(0);
    await component.save();http.expectOne('/api/team/athletes/athlete/program-start').flush({startedAt:'2026-11-01'});
    http.expectOne('/api/team/overview').flush({stats:{athletes:0,avgCompliance:0,newAlerts:0,lowAdherence:0},athletes:[],alerts:[]});
    expect(saved).toBe(1);
  });
  it('no envía una fecha vacía', async () => {
    const fixture=TestBed.createComponent(AthleteProgram);fixture.componentRef.setInput('athlete',athlete);fixture.detectChanges();
    await fixture.componentInstance.save();
    TestBed.inject(HttpTestingController).expectNone('/api/team/athletes/athlete/program-start');
    expect(fixture.componentInstance.form.controls.startedAt.touched).toBeTrue();
  });
});
