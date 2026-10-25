import { computed, Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'inventario-theme';
const DARK_CLASS = 'ion-palette-dark';

const LIGHT_CHROME = '#ffffff';
const DARK_CHROME = '#000000';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  private preferenceSignal = signal<ThemePreference>(readPreference());

  readonly preference = this.preferenceSignal.asReadonly();
  readonly resolved = computed<ResolvedTheme>(() => resolveTheme(this.preferenceSignal()));
  readonly logoSrc = computed(() =>
    this.resolved() === 'dark' ? 'assets/icon/logo-dark.png' : 'assets/icon/logo-light.png',
  );

  constructor() {
    this.media?.addEventListener('change', () => {
      if (this.preferenceSignal() === 'system') {
        this.apply();
      }
    });
  }

  initialize(): void {
    this.preferenceSignal.set(readPreference());
    this.apply();
  }

  setPreference(preference: ThemePreference): void {
    this.preferenceSignal.set(preference);
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      /* ignore quota / private mode */
    }
    this.apply();
  }

  apply(): void {
    const dark = this.resolved() === 'dark';
    document.documentElement.classList.toggle(DARK_CLASS, dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';

    const chrome = dark ? DARK_CHROME : LIGHT_CHROME;
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    themeMeta?.setAttribute('content', chrome);

    void this.syncStatusBar(chrome, dark);
  }

  private async syncStatusBar(color: string, dark: boolean): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    try {
      await StatusBar.setBackgroundColor({ color });
      await StatusBar.setStyle({ style: dark ? Style.Light : Style.Dark });
    } catch {
      /* StatusBar is optional on some platforms */
    }
  }
}

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch {
    /* ignore */
  }
  return 'system';
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'light' || preference === 'dark') {
    return preference;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
