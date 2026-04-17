import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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
  safe: { flex: 1, backgroundColor: "#0f172a" },
  inner: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#f8fafc",
    textAlign: "right",
    writingDirection: "rtl",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "right",
    writingDirection: "rtl",
  },
});
