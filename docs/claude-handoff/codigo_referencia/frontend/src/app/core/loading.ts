import { Component, Injectable, computed, inject, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private count = signal(0);
  readonly busy = computed(() => this.count() > 0);
  start() { this.count.update((c) => c + 1); }
  end() { this.count.update((c) => Math.max(0, c - 1)); }
}

@Component({
  selector: 'app-loading-bar',
  template: `@if (loading.busy()) { <div class="loadbar" aria-hidden="true"></div> }`
})
export class LoadingBar {
  loading = inject(LoadingService);
}