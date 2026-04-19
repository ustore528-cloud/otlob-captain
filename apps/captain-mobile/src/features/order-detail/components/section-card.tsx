import type { ComponentProps, ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { homeTheme } from "@/features/home/theme";

type Props = {
  title: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  children: ReactNode;
  /** تقليل الحشو والخطوط — شاشة تفاصيل الطلب */
  compact?: boolean;
};

export function SectionCard({ title, icon, children, compact }: Props) {
  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <View style={[styles.head, compact && styles.headCompact]}>
        <Ionicons name={icon} size={compact ? 16 : 20} color={homeTheme.accent} />
        <Text style={[styles.title, compact && styles.titleCompact]}>{title}</Text>
      </View>
      <View style={[styles.body, compact && styles.bodyCompact]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: homeTheme.surfaceElevated,
    borderRadius: homeTheme.radiusLg,
    borderWidth: 1,
    borderColor: homeTheme.border,
    overflow: "hidden",
  },
  cardCompact: {
    borderRadius: homeTheme.radiusMd,
  },
  head: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: homeTheme.cardHeaderTint,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: homeTheme.border,
  },
  headCompact: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  title: {
    flex: 1,
    color: homeTheme.text,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "right",
  },
  titleCompact: {
    fontSize: 13,
    fontWeight: "800",
  },
  body: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    paddingTop: 4,
  },
  bodyCompact: {
    paddingHorizontal: 12,
    paddingBottom: 6,
    paddingTop: 2,
  },
});
