const MAX_RAW_APPEND = 3500;

/**
 * يدمج ملاحظات المعاينة مع نص اللصق الأصلي للأرشفة التشغيلية (ضمن حدود الملاحظات).
 */
export function buildIncubatorOrderNotes(draftNotes: string, rawPaste: string): string | undefined {
  const d = draftNotes.trim();
  const raw = rawPaste.trim();
  const blocks: string[] = [];
  if (d) blocks.push(d);
  if (raw) {
    const clipped = raw.length > MAX_RAW_APPEND ? `${raw.slice(0, MAX_RAW_APPEND)}\n…(مختصر)` : raw;
    blocks.push(`--- نص لصق الأصل (الأم الحاضنة) ---\n${clipped}`);
  }
  if (blocks.length === 0) return undefined;
  return blocks.join("\n\n");
}
