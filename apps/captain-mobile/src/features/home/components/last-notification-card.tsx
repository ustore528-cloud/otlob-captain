import Ionicons from "@expo/vector-icons/Ionicons";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { homeTheme } from "../theme";
import { formatNotificationTime } from "../utils/format";

type Props = {
  title?: string;
  body?: string;
  createdAt?: string;
  loading: boolean;
  empty: boolean;
  onOpenNotifications?: () => void;
};

export function LastNotificationCard({
  title,
  body,
  createdAt,
  loading,
  empty,
  onOpenNotifications,
}: Props) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onOpenNotifications}
      disabled={!onOpenNotifications}
    >
      <View style={styles.head}>
        <View style={styles.headRow}>
          <Ionicons name="notifications-outline" size={20} color={homeTheme.accent} />
          <Text style={styles.headTitle}>آخر تنبيه</Text>
        </View>
        {onOpenNotifications ? (
          <Text style={styles.link}>عرض الكل</Text>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={homeTheme.accent} />
        </View>
      ) : empty ? (
        <Text style={styles.empty}>لا توجد تنبيهات حديثة</Text>
      ) : (
        <View>
          <Text style={styles.t} numberOfLines={2}>
            {title ?? "—"}
          </Text>
          {body ? (
            <Text style={styles.b} numberOfLines={2}>
              {body}
            </Text>
          ) : null}
          {createdAt ? (
            <Text style={styles.time}>{formatNotificationTime(createdAt)}</Text>
          ) : null}
        </View>
      )}
    </Pressable>
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
  pressed: { opacity: 0.94 },
  head: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  headTitle: { color: homeTheme.text, fontSize: 16, fontWeight: "800" },
  link: { color: homeTheme.accent, fontSize: 13, fontWeight: "600" },
  center: { paddingVertical: 12, alignItems: "center" },
  empty: {
    color: homeTheme.textMuted,
    fontSize: 14,
    textAlign: "right",
    lineHeight: 22,
  },
  t: {
    color: homeTheme.text,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "right",
    lineHeight: 22,
  },
  b: {
    color: homeTheme.textMuted,
    fontSize: 13,
    marginTop: 6,
    textAlign: "right",
    lineHeight: 20,
  },
  time: {
    color: homeTheme.textSubtle,
    fontSize: 12,
    marginTop: 10,
    textAlign: "right",
  },
});
