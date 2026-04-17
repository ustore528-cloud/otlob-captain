import { StyleSheet, Text, View } from "react-native";
import { homeTheme } from "@/features/home/theme";

type Props = {
  label: string;
  value: string;
  /** أيقونة اختيارية من نص (رمز بسيط) */
  hint?: string;
  /** أول صف في القسم — بدون خط علوي */
  isFirst?: boolean;
};

export function DetailRow({ label, value, hint, isFirst }: Props) {
  return (
    <View style={[styles.wrap, isFirst && styles.wrapFirst]}>
      <Text style={styles.label}>{label}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: homeTheme.border,
  },
  wrapFirst: {
    borderTopWidth: 0,
  },
  label: {
    color: homeTheme.textSubtle,
    fontSize: 12,
    textAlign: "right",
    marginBottom: 4,
  },
  hint: {
    color: homeTheme.textMuted,
    fontSize: 11,
    textAlign: "right",
    marginBottom: 4,
  },
  value: {
    color: homeTheme.text,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "right",
    lineHeight: 22,
  },
});
