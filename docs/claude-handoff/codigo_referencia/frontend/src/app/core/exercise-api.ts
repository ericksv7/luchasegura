import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export const COMPONENTS = ['Movilidad', 'Estabilidad', 'Fuerza', 'Técnica'] as const;

export interface Exercise {
  id: string;
  component: string;
  name: string;
  description: string | null;
  dosage: string | null;
  zone: string | null;
  mediaUrl: string | null;
  assigned?: number;
}
export interface Assignment {
  id: string;
  dosage: string | null;
  note: string | null;
  createdAt: string;
  assignedBy: string | null;
  exercise: Exercise;
}
export interface ExerciseInput {
  component: string;
  name: string;
  description: string | null;
  dosage: string | null;
  zone: string | null;
  mediaUrl: string | null;
}

export interface Media {
  kind: 'youtube' | 'vimeo' | 'image';
  thumb: string | null;
  src: string | null;
  embed: string | null;
}

const IMG = /\.(jpe?g|png|gif|webp)$/i;
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const okId = (v: string | null | undefined) => (v && YT_ID.test(v) ? v : null);

// Reconoce enlaces de YouTube, Vimeo o imágenes. El resto no se acepta.
export function mediaOf(raw: string | null | undefined): Media | null {
  if (!raw) return null;
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== 'https:') return null;

  const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '');
  let yt: string | null = null;
  if (host === 'youtu.be') {
    yt = okId(u.pathname.slice(1).split('/')[0]);
  } else if (host === 'youtube.com') {
    const parts = u.pathname.split('/').filter(Boolean);
    yt = okId(u.searchParams.get('v')) ?? (['embed', 'shorts', 'live'].includes(parts[0]) ? okId(parts[1]) : null);
  }
  if (yt) {
    return {
      kind: 'youtube',
      thumb: `https://img.youtube.com/vi/${yt}/mqdefault.jpg`,
      src: null,
      embed: `https://www.youtube-nocookie.com/embed/${yt}?rel=0`
    };
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const n = u.pathname.split('/').filter(Boolean).find((p) => /^\d+$/.test(p));
    if (n) return { kind: 'vimeo', thumb: null, src: null, embed: `https://player.vimeo.com/video/${n}` };
  }
  if (IMG.test(u.pathname)) return { kind: 'image', thumb: u.href, src: u.href, embed: null };
  return null;
}

@Injectable({ providedIn: 'root' })
export class ExerciseApi {
  private http = inject(HttpClient);

  list() { return this.http.get<Exercise[]>('/api/exercises'); }
  create(b: ExerciseInput) { return this.http.post<Exercise>('/api/exercises', b); }
  update(id: string, b: ExerciseInput) { return this.http.patch<Exercise>(`/api/exercises/${id}`, b); }
  remove(id: string) { return this.http.delete<{ archived: boolean }>(`/api/exercises/${id}`); }
  assign(b: { athleteId: string; exerciseId: string; dosage: string | null; note: string | null }) {
    return this.http.post<Assignment>('/api/exercises/assignments', b);
  }
  unassign(id: string) { return this.http.delete(`/api/exercises/assignments/${id}`); }
  forAthlete(athleteId: string) { return this.http.get<Assignment[]>(`/api/exercises/athlete/${athleteId}`); }
  mine() { return this.http.get<Assignment[]>('/api/exercises/mine'); }
}