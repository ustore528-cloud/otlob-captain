import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { homeTheme } from "@/features/home/theme";

type Props = {
  title: string;
  subtitle?: string;
  children?: ReactNode;
};

export function Screen({ title, subtitle, children }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.inner}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: homeTheme.bgSubtle },
  inner: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: homeTheme.text,
    textAlign: "right",
    writingDirection: "rtl",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: homeTheme.textMuted,
    textAlign: "right",
    writingDirection: "rtl",
  },
});
