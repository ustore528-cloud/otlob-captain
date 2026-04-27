import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { AssignmentLogEntryDto } from "@/services/api/dto";
import { formatLogTime } from "@/lib/order-timestamps";
import { assignmentResponseLabel } from "@/lib/assignment-log-i18n";
import { homeTheme } from "@/features/home/theme";

type Props = {
  logs: AssignmentLogEntryDto[] | undefined;
  compact?: boolean;
};

export function AssignmentLogsTimeline({ logs, compact }: Props) {
  const { t } = useTranslation();
  if (!logs?.length) return null;

  const sorted = [...logs].sort(
    (a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime(),
  );
  const slice = sorted.slice(0, compact ? 5 : 8);

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Text style={[styles.title, compact && styles.titleCompact]}>{t("assignmentLog.title")}</Text>
      {slice.map((log, index) => {
        const when = formatLogTime(log.assignedAt);
        const exp = log.expiredAt ? formatLogTime(log.expiredAt) : null;
        return (
          <View key={log.id} style={[styles.row, compact && styles.rowCompact, index === 0 && styles.rowFirst]}>
            <View style={[styles.dot, compact && styles.dotCompact]} />
            <View style={styles.textCol}>
              <Text style={[styles.status, compact && styles.statusCompact]}>{assignmentResponseLabel(log.responseStatus, t)}</Text>
              <Text style={[styles.meta, compact && styles.metaCompact]}>
                {when ?? log.assignedAt}
                {exp ? t("assignmentLog.expiresAt", { time: exp }) : ""}
              </Text>
              {log.notes ? <Text style={[styles.notes, compact && styles.notesCompact]}>{log.notes}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: homeTheme.surfaceElevated,
    borderRadius: homeTheme.radiusLg,
    borderWidth: 1,
    borderColor: homeTheme.border,
    padding: 16,
  },
  wrapCompact: {
    padding: 10,
    borderRadius: homeTheme.radiusMd,
  },
  title: {
    color: homeTheme.text,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: 12,
  },
  titleCompact: {
    fontSize: 12,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: homeTheme.border,
  },
  rowCompact: {
    paddingVertical: 5,
    gap: 6,
  },
  rowFirst: {
    borderTopWidth: 0,
    paddingTop: 0,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    backgroundColor: homeTheme.accentMuted,
  },
  dotCompact: {
    width: 6,
    height: 6,
    marginTop: 4,
  },
  textCol: { flex: 1, minWidth: 0 },
  status: {
    color: homeTheme.text,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "right",
  },
  statusCompact: { fontSize: 12 },
  meta: {
    color: homeTheme.textMuted,
    fontSize: 12,
    marginTop: 2,
    textAlign: "right",
  },
  metaCompact: { fontSize: 10 },
  notes: {
    color: homeTheme.textSubtle,
    fontSize: 12,
    marginTop: 4,
    textAlign: "right",
    lineHeight: 18,
  },
  notesCompact: { fontSize: 10 },
});
