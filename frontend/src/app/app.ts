import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastContainer } from './core/toast-container';
import { ThemeToggle } from './core/theme-toggle';
import { SessionWatcher } from './core/session-watcher';
import { LoadingBar } from './core/loading';
import { startFx } from './core/fx';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainer, ThemeToggle, LoadingBar],
  template: '<app-loading-bar /><app-toast-container /><router-outlet /><app-theme-toggle />'
})
export class App {
  constructor() {
    inject(SessionWatcher).start();
    startFx();
  }
}