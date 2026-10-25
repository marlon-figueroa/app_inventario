import { registerLocaleData } from '@angular/common';
import { isDevMode, LOCALE_ID, provideAppInitializer, inject } from '@angular/core';
import localeEsMx from '@angular/common/locales/es-MX';
import { defineCustomElements } from '@ionic/pwa-elements/loader';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideServiceWorker } from '@angular/service-worker';
import { PreloadAllModules, provideRouter, RouteReuseStrategy, withComponentInputBinding, withPreloading } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { DatabaseService } from './app/core/database/database.service';
import { ThemeService } from './app/core/theme/theme.service';

registerLocaleData(localeEsMx);
void defineCustomElements(window);

const isNativeApp = Capacitor.isNativePlatform();

if (isNativeApp && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      void registration.unregister();
    }
  });
  if (typeof caches !== 'undefined') {
    void caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))));
  }
}

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    { provide: LOCALE_ID, useValue: 'es-MX' },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules), withComponentInputBinding()),
    provideAppInitializer(() => inject(ThemeService).initialize()),
    provideAppInitializer(() => inject(DatabaseService).initialize()),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode() && !isNativeApp,
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
});
