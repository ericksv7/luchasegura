import { Component, input } from '@angular/core';

// Escudo con degradados definidos una sola vez en index.html (ids ls-g, ls-s, ls-l, ls-c)
@Component({
  selector: 'app-logo',
  template: `
    <span class="logo">
      <svg class="logo-mark" viewBox="0 0 100 100" [attr.width]="size()" [attr.height]="size()" aria-hidden="true">
        <path d="M50 6 86 18V48C86 71 71 86 50 95 29 86 14 71 14 48V18Z" fill="url(#ls-g)" />
        <g clip-path="url(#ls-c)"><path d="M0 0H100V50C70 38 30 38 0 54Z" fill="url(#ls-s)" /></g>
        <path d="M50 13 79 23V48C79 66 67 78 50 86 33 78 21 66 21 48V23Z" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.6" />
        <path d="M38 28H47V54H66V63H38Z" fill="#032a22" fill-opacity=".35" transform="translate(0 2)" />
        <path d="M38 28H47V54H66V63H38Z" fill="url(#ls-l)" />
      </svg>
      @if (text()) { <span class="logo-text">Lucha<b>Segura</b></span> }
    </span>
  `
})
export class Logo {
  size = input(32);
  text = input(true);
}