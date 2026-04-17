import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { homeTheme } from "../theme";

export type QuickActionId = "orders" | "earnings" | "tracking" | "notifications" | "profile";

type Item = {
  id: QuickActionId;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  hint: string;
};

const ITEMS: Item[] = [
  { id: "orders", label: "الطلبات", icon: "list-outline", hint: "العروض والحالة" },
  { id: "earnings", label: "الأرباح", icon: "wallet-outline", hint: "ملخص التحصيل" },
  { id: "tracking", label: "التتبع", icon: "navigate-outline", hint: "مشاركة الموقع" },
  { id: "notifications", label: "التنبيهات", icon: "notifications-outline", hint: "آخر الإشعارات" },
  { id: "profile", label: "حسابي", icon: "person-outline", hint: "الملف والخروج" },
];

type Props = {
  onAction: (id: QuickActionId) => void;
};

export function QuickActions({ onAction }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>اختصارات</Text>
      <View style={styles.grid}>
        {ITEMS.map((item) => (
          <Pressable
            key={item.id}
            style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
            onPress={() => onAction(item.id)}
          >
            <View style={styles.iconWrap}>
              <Ionicons name={item.icon} size={26} color={homeTheme.accent} />
            </View>
            <Text style={styles.tileTitle}>{item.label}</Text>
            <Text style={styles.tileHint} numberOfLines={1}>
              {item.hint}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4 },
  title: {
    color: homeTheme.text,
    fontSize: 17,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: 12,
  },
  grid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
  },
  tile: {
    width: "48%",
    backgroundColor: homeTheme.surfaceElevated,
    borderRadius: homeTheme.radiusMd,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: homeTheme.border,
    alignItems: "center",
  },
  tilePressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: homeTheme.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  tileTitle: {
    color: homeTheme.text,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  tileHint: {
    color: homeTheme.textSubtle,
    fontSize: 11,
    marginTop: 4,
    textAlign: "center",
  },
});
