import { Text, View, StyleSheet } from "react-native";
import type { CaptainProfileDto, SessionUserDto } from "@/services/api/dto";
import { homeTheme } from "../theme";
import { availabilityLabel, parseAvailabilityStatus } from "../labels";
import { formatLastSeenAr } from "../utils/format";

type Props = {
  user: SessionUserDto;
  captain: CaptainProfileDto;
};

const statusTone: Record<string, { bg: string; border: string; text: string }> = {
  AVAILABLE: { bg: "rgba(52, 211, 153, 0.12)", border: "rgba(52, 211, 153, 0.35)", text: "#6ee7b7" },
  OFFLINE: { bg: "rgba(148, 163, 184, 0.1)", border: "rgba(148, 163, 184, 0.25)", text: "#cbd5e1" },
  BUSY: { bg: "rgba(251, 191, 36, 0.12)", border: "rgba(251, 191, 36, 0.35)", text: "#fcd34d" },
  ON_DELIVERY: { bg: "rgba(56, 189, 248, 0.12)", border: "rgba(56, 189, 248, 0.35)", text: "#7dd3fc" },
};

export function CaptainSummaryCard({ user, captain }: Props) {
  const av = parseAvailabilityStatus(captain.availabilityStatus) ?? "OFFLINE";
  const tone = statusTone[av] ?? statusTone.OFFLINE;
  const initial = user.fullName.trim().charAt(0) || "؟";
  const lastSeen = formatLastSeenAr(captain.lastSeenAt);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.meta}>
          <Text style={styles.name} numberOfLines={1}>
            {user.fullName}
          </Text>
          <View style={[styles.badge, { backgroundColor: tone.bg, borderColor: tone.border }]}>
            <Text style={[styles.badgeText, { color: tone.text }]}>{availabilityLabel[av]}</Text>
          </View>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.lines}>
        <Text style={styles.lineMuted}>المنطقة</Text>
        <Text style={styles.lineValue}>{captain.area ?? "—"}</Text>
      </View>

      <View style={styles.lines}>
        <Text style={styles.lineMuted}>نوع المركبة</Text>
        <Text style={styles.lineValue}>{captain.vehicleType}</Text>
      </View>

      {lastSeen ? (
        <View style={styles.lines}>
          <Text style={styles.lineMuted}>آخر ظهور</Text>
          <Text style={styles.lineValue}>{lastSeen}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: homeTheme.surfaceElevated,
    borderRadius: homeTheme.radiusLg,
    padding: 18,
    borderWidth: 1,
    borderColor: homeTheme.border,
  },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: homeTheme.accentSoft,
    borderWidth: 1,
    borderColor: homeTheme.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 22,
    fontWeight: "800",
    color: homeTheme.accent,
  },
  meta: { flex: 1, alignItems: "flex-end", gap: 8 },
  name: {
    color: homeTheme.text,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "right",
    width: "100%",
  },
  badge: {
    alignSelf: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: { fontSize: 13, fontWeight: "700" },
  divider: {
    height: 1,
    backgroundColor: homeTheme.border,
    marginVertical: 14,
  },
  lines: { marginBottom: 10 },
  lineMuted: {
    color: homeTheme.textSubtle,
    fontSize: 12,
    textAlign: "right",
    marginBottom: 2,
  },
  lineValue: {
    color: homeTheme.text,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "right",
  },
});
