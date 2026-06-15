/**
 * Locale configuration and management
 */

import { STORAGE_KEYS } from "./constants";

export interface LocaleConfig {
  locale: string;
  currency: string;
  currencySymbolPosition: 'before' | 'after';
  dateFormat: 'short' | 'medium' | 'long' | 'full';
}

const LOCALE_STORAGE_KEY = STORAGE_KEYS.LOCALE_CONFIG;

const DEFAULT_CONFIG: LocaleConfig = {
  locale: navigator.language || 'en-US',
  currency: 'USD',
  currencySymbolPosition: 'before',
  dateFormat: 'medium',
};

/**
 * Date format options for the settings UI
 */
export const DATE_FORMAT_OPTIONS = [
  { value: 'short', label: 'Short (1/31/25)' },
  { value: 'medium', label: 'Medium (Jan 31, 2025)' },
  { value: 'long', label: 'Long (January 31, 2025)' },
  { value: 'full', label: 'Full (Friday, January 31, 2025)' },
] as const;

/**
 * Currency symbol position options
 */
export const CURRENCY_POSITION_OPTIONS = [
  { value: 'before', label: 'Before Amount ($100.00)' },
  { value: 'after', label: 'After Amount (100.00$)' },
] as const;

/**
 * Get the current locale configuration from localStorage or defaults
 * @returns The current locale configuration
 */
export function getLocaleConfig(): LocaleConfig {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.warn('Failed to load locale config from localStorage:', error);
  }
  return DEFAULT_CONFIG;
}

/**
 * Save locale configuration to localStorage
 * @param config - The locale configuration to save
 */
export function saveLocaleConfig(config: Partial<LocaleConfig>): void {
  try {
    const current = getLocaleConfig();
    const updated = { ...current, ...config };
    localStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.warn('Failed to save locale config to localStorage:', error);
  }
}

/**
 * Reset locale configuration to browser defaults
 */
export function resetLocaleConfig(): void {
  try {
    localStorage.removeItem(LOCALE_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to reset locale config:', error);
  }
}

/**
 * List of common currencies with their names
 */
export const COMMON_CURRENCIES = [
  { code: 'USD', name: 'US Dollar ($)' },
  { code: 'EUR', name: 'Euro (€)' },
  { code: 'GBP', name: 'British Pound (£)' },
  { code: 'JPY', name: 'Japanese Yen (¥)' },
  { code: 'CAD', name: 'Canadian Dollar (C$)' },
  { code: 'AUD', name: 'Australian Dollar (A$)' },
  { code: 'CHF', name: 'Swiss Franc (CHF)' },
  { code: 'CNY', name: 'Chinese Yuan (CN¥)' },
  { code: 'INR', name: 'Indian Rupee (₹)' },
  { code: 'MXN', name: 'Mexican Peso (MX$)' },
  { code: 'BRL', name: 'Brazilian Real (R$)' },
  { code: 'ZAR', name: 'South African Rand (R)' },
  { code: 'SEK', name: 'Swedish Krona (kr)' },
  { code: 'NOK', name: 'Norwegian Krone (kr)' },
  { code: 'DKK', name: 'Danish Krone (kr)' },
  { code: 'NZD', name: 'New Zealand Dollar (NZ$)' },
  { code: 'SGD', name: 'Singapore Dollar (S$)' },
  { code: 'HKD', name: 'Hong Kong Dollar (HK$)' },
  { code: 'KRW', name: 'South Korean Won (₩)' },
  { code: 'TRY', name: 'Turkish Lira (₺)' },
] as const;

/**
 * List of common locales with their names
 */
export const COMMON_LOCALES = [
  { code: 'en-US', name: 'English (United States)' },
  { code: 'en-GB', name: 'English (United Kingdom)' },
  { code: 'en-CA', name: 'English (Canada)' },
  { code: 'en-AU', name: 'English (Australia)' },
  { code: 'es-ES', name: 'Spanish (Spain)' },
  { code: 'es-MX', name: 'Spanish (Mexico)' },
  { code: 'fr-FR', name: 'French (France)' },
  { code: 'fr-CA', name: 'French (Canada)' },
  { code: 'de-DE', name: 'German (Germany)' },
  { code: 'it-IT', name: 'Italian (Italy)' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)' },
  { code: 'pt-PT', name: 'Portuguese (Portugal)' },
  { code: 'ja-JP', name: 'Japanese (Japan)' },
  { code: 'zh-CN', name: 'Chinese (China)' },
  { code: 'zh-TW', name: 'Chinese (Taiwan)' },
  { code: 'ko-KR', name: 'Korean (South Korea)' },
  { code: 'ru-RU', name: 'Russian (Russia)' },
  { code: 'ar-SA', name: 'Arabic (Saudi Arabia)' },
  { code: 'hi-IN', name: 'Hindi (India)' },
  { code: 'sv-SE', name: 'Swedish (Sweden)' },
  { code: 'no-NO', name: 'Norwegian (Norway)' },
  { code: 'da-DK', name: 'Danish (Denmark)' },
  { code: 'nl-NL', name: 'Dutch (Netherlands)' },
  { code: 'pl-PL', name: 'Polish (Poland)' },
  { code: 'tr-TR', name: 'Turkish (Turkey)' },
] as const;
