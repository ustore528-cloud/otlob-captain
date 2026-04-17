import type { ComponentProps, ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { homeTheme } from "@/features/home/theme";

type Props = {
  title: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  children: ReactNode;
};

export function SectionCard({ title, icon, children }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Ionicons name={icon} size={20} color={homeTheme.accent} />
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.body}>{children}</View>
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
  head: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(56, 189, 248, 0.06)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: homeTheme.border,
  },
  title: {
    flex: 1,
    color: homeTheme.text,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "right",
  },
  body: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    paddingTop: 4,
  },
});
