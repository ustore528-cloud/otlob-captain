import { StyleSheet, Text, View } from "react-native";
import { homeTheme } from "@/features/home/theme";

/** Minimal copy-only empty state — no framed panels or decorative icons. */
export function AssignmentEmptyState() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.line}>خذ لك دقيقة راحة</Text>
      <Text style={styles.sub}>والرزقة في الطريق</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: "flex-end",
  },
  line: {
    color: homeTheme.textMuted,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "right",
  },
  sub: {
    marginTop: 4,
    color: homeTheme.textSubtle,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "right",
  },
});
