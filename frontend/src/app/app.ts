import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastContainer } from './core/toast-container';
import { ThemeToggle } from './core/theme-toggle';
import { SessionWatcher } from './core/session-watcher';
import { LoadingBar } from './core/loading';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainer, ThemeToggle, LoadingBar],
  template: '<app-loading-bar /><router-outlet /><app-theme-toggle /><app-toast-container />'
})
export class App {
  constructor() {
    inject(SessionWatcher).start();
  }
}