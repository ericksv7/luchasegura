import { DatePipe } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { afterNextRender, Component, computed, DestroyRef, ElementRef, inject, Injector, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { apiError, AuthService } from '../core/auth.service';
import { formatHistoryDay } from '../core/civil-date';
import { StateView } from '../core/state';
import { SurveyReview } from './survey-review';

type Kind = 'INITIAL' | 'FINAL' | 'COACH';
type Answer = string | number;
export type Answers = Partial<Record<string, Answer>>;
type Question = {
  id: string; label: string; group: string; type: 'choice' | 'count' | 'text';
  options?: [string, string][]; required?: boolean; when?: string;
};
export type Catalogue = { version: string; reference: { from: string; to: string }; questions: Question[] };
type SurveyRecord = {
  id: string; kind: Kind; programId: string; programName: string; startedOn: string; version: number;
  submittedAt: string | null; catalogueVersion: string; updatedAt: string; catalogue: Catalogue | null; answers: Answers | null;
  sportContext: { experience?: number | null; category?: string | null; style?: string | null } | null;
};
type Slot = {
  kind: Kind; programId: string; startedOn: string; opensOn: string | null;
  writable: boolean; catalogue: Catalogue; sportContext: SurveyRecord['sportContext']; record: SurveyRecord | null;
};
type Overview = {
  enabled: boolean; eligible: boolean; consent: boolean; revoked: boolean; today: string;
  notice: { version: string; text: string } | null; context: { programId: string; startedOn: string } | null;
  slots: Slot[]; records: SurveyRecord[]; next: string | null;
};
type Revision = { version: number; answers: Answers; recordedAt: string };

@Component({
  selector: 'app-surveys',
  imports: [DatePipe, RouterLink, StateView, SurveyReview],
  templateUrl: './surveys.page.html',
  styleUrl: './surveys.page.scss',
})
export class SurveysPage {
  private readonly http = inject(HttpClient);
  private readonly destroy = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly route = inject(ActivatedRoute);
  readonly athleteId = this.route.snapshot.paramMap.get('id');
  readonly role = inject(AuthService).user()?.role;
  private readonly url = '/api/preventive-surveys/' + (this.athleteId ? 'team/' + encodeURIComponent(this.athleteId) : 'me');
  private readonly stepHeading = viewChild<ElementRef<HTMLElement>>('stepHeading');
  private readonly feedback = viewChild<ElementRef<HTMLElement>>('feedback');
  private readonly listHeading = viewChild<ElementRef<HTMLElement>>('listHeading');
  private pendingOperation?: { key: string; id: string };
  readonly data = signal<Overview | null>(null);
  readonly busy = signal(false);
  readonly issue = signal('');
  readonly invalid = signal<string[]>([]);
  readonly notice = signal('');
  readonly accepted = signal(false);
  readonly withdrawing = signal(false);
  readonly confirmed = signal(false);
  readonly editing = signal<Slot | null>(null);
  readonly reading = signal<SurveyRecord | null>(null);
  readonly conflict = signal(false);
  readonly saved = signal<Slot | null>(null);
  readonly history = signal<{ revisions: Revision[]; next: number | null } | null>(null);
  readonly step = signal(0);
  readonly answers = signal<Answers>({});
  readonly formatDay = formatHistoryDay;
  readonly labels = { INITIAL: 'Encuesta inicial', FINAL: 'Encuesta final', COACH: 'Cuestionario del entrenador' };
  readonly groups = computed(() => [...new Set(this.editing()?.catalogue.questions
    .filter(question => this.applies(question, this.answers())).map(question => question.group))]);
  readonly currentGroup = computed(() => this.groups().at(this.step()));
  readonly stepQuestions = computed(() => this.editing()?.catalogue.questions.filter(question =>
    question.group === this.groups()[this.step()] && this.applies(question, this.answers())) ?? []);
  readonly older = computed(() => {
    const data = this.data();
    return data?.records.filter(record => !data.slots.some(slot => slot.record?.id === record.id)) ?? [];
  });

  constructor() { this.load(); }

  applies(question: Question, answers: Answers) { return !question.when || answers[question.when] === 'yes'; }

  status(slot: Slot, today: string) {
    if (slot.record?.submittedAt) return 'Completada';
    if (slot.record) return slot.writable ? 'Borrador' : 'Borrador · periodo cerrado';
    if (slot.kind === 'INITIAL' && today >= slot.startedOn) return 'Fuera de semana 0 · inicial pendiente';
    if (slot.opensOn && today < slot.opensOn) return 'Disponible desde ' + this.formatDay(slot.opensOn);
    return 'Pendiente';
  }

  private focus(target: () => ElementRef<HTMLElement> | undefined) {
    afterNextRender(() => target()?.nativeElement.focus(), { injector: this.injector });
  }

  load(cursor?: string, resolving = false) {
    this.busy.set(true); this.issue.set('');
    const params = cursor ? new HttpParams().set('cursor', cursor) : undefined;
    this.http.get<Overview>(this.url, { params }).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: data => {
        const previous = this.data();
        this.data.set(cursor && previous ? { ...data, records: [...previous.records, ...data.records] } : data);
        if (resolving) {
          const editing = this.editing();
          const current = data.slots.find(slot => slot.kind === editing?.kind &&
            slot.programId === editing.programId && slot.startedOn === editing.startedOn) ?? null;
          this.saved.set(current);
          if (!current?.writable) this.notice.set('El borrador local queda visible para consulta. Ya no se puede guardar en esta intervención.');
        }
        this.busy.set(false);
      },
      error: error => this.fail(error),
    });
  }

  consent(revoke = false) {
    const version = this.data()?.notice?.version;
    if (this.busy() || (!revoke && (!version || !this.accepted()))) return;
    this.busy.set(true); this.issue.set('');
    const request = revoke ? this.http.delete(this.url + '/consent')
      : this.http.put(this.url + '/consent', { accepted: true, version });
    request.pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: () => {
        this.withdrawing.set(false);
        if (revoke) {
          this.data.set(null); this.editing.set(null); this.reading.set(null); this.answers.set({}); this.history.set(null);
        }
        this.notice.set(revoke ? 'Autorización retirada.' : 'Autorización de demostración guardada.');
        this.load();
      },
      error: error => this.fail(error),
    });
  }

  open(slot: Slot) {
    this.editing.set(slot); this.reading.set(null);
    this.answers.set({ ...slot.record?.answers });
    this.history.set(null); this.step.set(0); this.confirmed.set(false); this.invalid.set([]);
    this.conflict.set(false); this.saved.set(null); this.issue.set(''); this.notice.set('');
    this.pendingOperation = undefined;
    this.focus(this.stepHeading);
  }

  see(record: SurveyRecord) {
    this.reading.set(record); this.editing.set(null); this.history.set(null);
    this.issue.set(''); this.focus(this.stepHeading);
  }

  close() {
    this.editing.set(null); this.reading.set(null); this.saved.set(null); this.history.set(null);
    this.conflict.set(false); this.issue.set(''); this.focus(this.listHeading);
  }

  go(step: number) { this.step.set(step); this.confirmed.set(false); this.focus(this.stepHeading); }

  change(question: Question, event: Event) {
    const raw = (event.target as HTMLInputElement).value;
    const answers = { ...this.answers() };
    if (raw === '') delete answers[question.id];
    else answers[question.id] = question.type === 'count' ? Number(raw) : raw;
    for (const item of this.editing()?.catalogue.questions ?? []) {
      if (!this.applies(item, answers)) delete answers[item.id];
    }
    this.answers.set(answers); this.confirmed.set(false);
    this.invalid.update(ids => ids.filter(id => id !== question.id));
  }

  resolve(useSaved: boolean) {
    const slot = this.saved();
    if (!slot?.writable || (!useSaved && this.editing()?.catalogue.reference.from !== slot.catalogue.reference.from)) return;
    if (useSaved) this.answers.set({ ...slot.record?.answers });
    this.editing.set(slot); this.conflict.set(false); this.saved.set(null);
    this.confirmed.set(false); this.issue.set('');
    this.notice.set(useSaved ? 'Se cargaron las respuestas guardadas.' : 'Se mantuvieron tus respuestas locales. Revísalas antes de guardar.');
  }

  save(submit: boolean) {
    const slot = this.editing();
    if (!slot || this.busy() || this.conflict() || (submit && !this.confirmed())) return;
    const body = {
      kind: slot.kind, programId: slot.programId, startedOn: slot.startedOn, catalogueVersion: slot.catalogue.version,
      referenceFrom: slot.catalogue.reference.from, expectedVersion: slot.record?.version ?? 0, submit, answers: this.answers(),
    };
    const key = JSON.stringify(body);
    if (this.pendingOperation?.key !== key) this.pendingOperation = { key, id: crypto.randomUUID() };
    this.busy.set(true); this.issue.set(''); this.invalid.set([]);
    this.http.put<SurveyRecord>(this.url, { ...body, operationId: this.pendingOperation.id })
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: record => {
          this.notice.set(submit ? 'Encuesta presentada.' : 'Borrador guardado.');
          if (submit) this.see(record);
          else this.editing.set({ ...slot, record });
          this.load();
        },
        error: (error: HttpErrorResponse) => {
          if (error.status === 409) this.conflict.set(true);
          if (error.status === 422) this.invalid.set(error.error?.invalid ?? []);
          this.fail(error);
        },
      });
  }

  loadHistory(id: string, before?: number) {
    this.busy.set(true); this.issue.set('');
    const params = before ? new HttpParams().set('before', before) : undefined;
    this.http.get<{ revisions: Revision[]; next: number | null }>(this.url + '/' + id + '/history', { params })
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: page => {
          const revisions = before ? this.history()?.revisions ?? [] : [];
          this.history.set({ ...page, revisions: [...revisions, ...page.revisions] });
          this.busy.set(false);
        },
        error: error => this.fail(error),
      });
  }

  private fail(error: HttpErrorResponse) {
    this.busy.set(false);
    this.issue.set(error.status === 403 || error.status === 404
      ? 'Las encuestas no están disponibles para esta cuenta.' : apiError(error));
    this.focus(this.feedback);
  }
}
