import { StyleSheet, Text, View } from "react-native";
import type { AssignmentLogEntryDto } from "@/services/api/dto";
import { formatLastSeenAr } from "@/features/home/utils/format";
import { assignmentResponseStatusAr } from "@/lib/order-status-ar";
import { homeTheme } from "@/features/home/theme";

type Props = {
  logs: AssignmentLogEntryDto[] | undefined;
};

function labelForResponse(s: string): string {
  return assignmentResponseStatusAr[s] ?? s;
}

export function AssignmentLogsTimeline({ logs }: Props) {
  if (!logs?.length) return null;

  const sorted = [...logs].sort(
    (a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime(),
  );
  const slice = sorted.slice(0, 8);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>سجل التعيينات</Text>
      {slice.map((log, index) => {
        const when = formatLastSeenAr(log.assignedAt);
        return (
          <View key={log.id} style={[styles.row, index === 0 && styles.rowFirst]}>
            <View style={styles.dot} />
            <View style={styles.textCol}>
              <Text style={styles.status}>{labelForResponse(log.responseStatus)}</Text>
              <Text style={styles.meta}>
                {when ?? log.assignedAt}
                {log.expiredAt ? ` · ينتهي ${formatLastSeenAr(log.expiredAt) ?? ""}` : ""}
              </Text>
              {log.notes ? <Text style={styles.notes}>{log.notes}</Text> : null}
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
  title: {
    color: homeTheme.text,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: 12,
  },
  row: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: homeTheme.border,
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
    backgroundColor: homeTheme.accent,
  },
  textCol: { flex: 1 },
  status: {
    color: homeTheme.text,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
  },
  meta: {
    color: homeTheme.textMuted,
    fontSize: 12,
    marginTop: 4,
    textAlign: "right",
  },
  notes: {
    color: homeTheme.textSubtle,
    fontSize: 12,
    marginTop: 6,
    textAlign: "right",
    lineHeight: 18,
  },
});
