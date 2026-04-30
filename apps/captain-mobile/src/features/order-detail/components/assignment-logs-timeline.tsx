import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { AssignmentLogEntryDto } from "@/services/api/dto";
import { formatLogTime } from "@/lib/order-timestamps";
import { assignmentResponseLabel } from "@/lib/assignment-log-i18n";
import { captainSpacing, captainTypography, captainUiTheme } from "@/theme/captain-ui-theme";
import { SectionCard } from "@/components/ui";

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
    <SectionCard title={t("assignmentLog.title")} icon="layers-outline" compact>
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
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: captainSpacing.sm + 2,
    paddingVertical: captainSpacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: captainUiTheme.border,
  },
  rowCompact: {
    paddingVertical: 5,
    gap: captainSpacing.sm - 2,
  },
  rowFirst: {
    borderTopWidth: 0,
    paddingTop: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    backgroundColor: captainUiTheme.accentMuted,
  },
  dotCompact: {
    width: 6,
    height: 6,
    marginTop: 4,
  },
  textCol: { flex: 1, minWidth: 0 },
  status: {
    ...captainTypography.bodyStrong,
    fontSize: 14,
    color: captainUiTheme.text,
    fontWeight: "800",
    textAlign: "right",
  },
  statusCompact: { fontSize: 12 },
  meta: {
    color: captainUiTheme.textMuted,
    fontSize: 12,
    marginTop: 2,
    textAlign: "right",
  },
  metaCompact: { fontSize: 10 },
  notes: {
    color: captainUiTheme.textSubtle,
    fontSize: 12,
    marginTop: captainSpacing.xs,
    textAlign: "right",
    lineHeight: 18,
  },
  notesCompact: { fontSize: 10 },
});
