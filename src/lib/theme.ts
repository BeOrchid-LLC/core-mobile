import { Platform, useColorScheme } from 'react-native';

/**
 * The same tokens as core-web's globals.css, in the form React Native can use.
 *
 * Kept name-for-name with the stylesheet rather than renamed to mobile
 * conventions: the two reference apps are read side by side, and a reviewer
 * comparing a granted chip on web with a granted chip on mobile should not have
 * to work out which colour is which.
 */
export interface Palette {
  bg: string;
  surface: string;
  ink: string;
  inkSoft: string;
  inkFaint: string;
  rule: string;
  accent: string;
  ok: string;
  okBg: string;
  deny: string;
  denyBg: string;
  warn: string;
  warnBg: string;
}

const light: Palette = {
  bg: '#f6f6f8',
  surface: '#ffffff',
  ink: '#1a1823',
  inkSoft: '#56525f',
  inkFaint: '#837e8e',
  rule: '#e1dfe7',
  accent: '#6d4c8c',
  ok: '#2e7d5b',
  okBg: '#e3f0ea',
  deny: '#a33a45',
  denyBg: '#f7e6e8',
  warn: '#8a5e18',
  warnBg: '#f5ecdc',
};

const dark: Palette = {
  bg: '#131218',
  surface: '#1b1922',
  ink: '#e9e7ef',
  inkSoft: '#a9a4b6',
  inkFaint: '#7c7689',
  rule: '#2c2937',
  accent: '#b98fe0',
  ok: '#6ecb9f',
  okBg: '#17281f',
  deny: '#e5808c',
  denyBg: '#2e1b1e',
  warn: '#d8a85a',
  warnBg: '#2a2113',
};

/** app.json sets userInterfaceStyle to automatic, matching the web media query. */
export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

export const mono = Platform.select({ ios: 'Menlo', default: 'monospace' });
