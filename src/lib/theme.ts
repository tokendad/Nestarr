// Theme configuration for Nestarr

import { STORAGE_KEYS } from "./constants";

export type ThemeMode = 'system' | 'dark' | 'light';
export type ColorPalette = 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'teal';

export interface ThemeConfig {
  mode: ThemeMode;
  colorPalette: ColorPalette;
}

const THEME_STORAGE_KEY = STORAGE_KEYS.THEME;

export const DEFAULT_THEME: ThemeConfig = {
  mode: 'system',
  colorPalette: 'blue',
};

export const COLOR_PALETTES: { code: ColorPalette; name: string; accent: string }[] = [
  { code: 'blue', name: 'Blue (Default)', accent: '#38bdf8' },
  { code: 'green', name: 'Green', accent: '#4ade80' },
  { code: 'red', name: 'Red', accent: '#f87171' },
  { code: 'purple', name: 'Purple', accent: '#a78bfa' },
  { code: 'orange', name: 'Orange', accent: '#fb923c' },
  { code: 'teal', name: 'Teal', accent: '#2dd4bf' },
];

export const THEME_MODES: { code: ThemeMode; name: string }[] = [
  { code: 'system', name: 'System Default' },
  { code: 'dark', name: 'Night (Dark)' },
  { code: 'light', name: 'Day (Light)' },
];

export function getThemeConfig(): ThemeConfig {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        mode: parsed.mode || DEFAULT_THEME.mode,
        colorPalette: parsed.colorPalette || DEFAULT_THEME.colorPalette,
      };
    }
  } catch {
    // Ignore parsing errors
  }
  return DEFAULT_THEME;
}

export function saveThemeConfig(config: ThemeConfig): void {
  localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(config));
}

export function resetThemeConfig(): void {
  localStorage.removeItem(THEME_STORAGE_KEY);
}

export function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function getResolvedThemeMode(mode: ThemeMode): 'dark' | 'light' {
  if (mode === 'system') {
    return getSystemPrefersDark() ? 'dark' : 'light';
  }
  return mode;
}

export function applyTheme(config: ThemeConfig): void {
  const root = document.documentElement;
  const resolvedMode = getResolvedThemeMode(config.mode);
  
  // Set theme mode data attribute
  root.setAttribute('data-theme', resolvedMode);
  root.setAttribute('data-color-palette', config.colorPalette);
}
