import i18n from "@/i18n/i18n";

const MAX_RAW_APPEND = 3500;

/**
 * Merges preview notes with the original paste for operational record (bounded).
 */
export function buildIncubatorOrderNotes(draftNotes: string, rawPaste: string): string | undefined {
  const d = draftNotes.trim();
  const raw = rawPaste.trim();
  const blocks: string[] = [];
  if (d) blocks.push(d);
  if (raw) {
    const clipped =
      raw.length > MAX_RAW_APPEND
        ? `${raw.slice(0, MAX_RAW_APPEND)}\n${String(i18n.t("incubator.notes.truncated"))}`
        : raw;
    blocks.push(`${String(i18n.t("incubator.notes.rawBlockHeader"))}\n${clipped}`);
  }
  if (blocks.length === 0) return undefined;
  return blocks.join("\n\n");
}
