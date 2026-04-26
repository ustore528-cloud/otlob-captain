/**
 * Locale for numeric date/time formatting in tables, CSV, and modals.
 * Keeps Western digits (0–9) per product default regardless of UI language.
 */
export function tableDateLocale(_lng: string): string {
  return "en-GB";
}
