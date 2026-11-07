import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastContainer } from './core/toast-container';
import { ThemeToggle } from './core/theme-toggle';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainer, ThemeToggle],
  template: '<router-outlet /><app-theme-toggle /><app-toast-container />'
})
export class App {}