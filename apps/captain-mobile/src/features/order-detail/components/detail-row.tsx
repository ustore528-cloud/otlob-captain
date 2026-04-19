import { Pressable, StyleSheet, Text, View } from "react-native";
import { homeTheme } from "@/features/home/theme";

type Props = {
  label: string;
  value: string;
  /** أيقونة اختيارية من نص (رمز بسيط) */
  hint?: string;
  /** أول صف في القسم — بدون خط علوي */
  isFirst?: boolean;
  compact?: boolean;
  /** عند الضغط — يُظهر القيمة كرابط (هاتف / خريطة) */
  onPressValue?: () => void;
  valueAccessibilityHint?: string;
};

export function DetailRow({ label, value, hint, isFirst, compact, onPressValue, valueAccessibilityHint }: Props) {
  const valueNode = onPressValue ? (
    <Pressable
      onPress={onPressValue}
      hitSlop={6}
      accessibilityRole="link"
      accessibilityHint={valueAccessibilityHint}
      style={({ pressed }) => [styles.valuePressable, pressed && styles.valuePressed]}
    >
      <Text style={[styles.value, compact && styles.valueCompact, styles.valueLink]}>{value}</Text>
    </Pressable>
  ) : (
    <Text style={[styles.value, compact && styles.valueCompact]}>{value}</Text>
  );

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact, isFirst && styles.wrapFirst]}>
      <Text style={[styles.label, compact && styles.labelCompact]}>{label}</Text>
      {hint ? <Text style={[styles.hint, compact && styles.hintCompact]}>{hint}</Text> : null}
      {valueNode}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: homeTheme.border,
  },
  wrapCompact: {
    paddingVertical: 6,
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
  labelCompact: {
    fontSize: 10,
    marginBottom: 2,
  },
  hint: {
    color: homeTheme.textMuted,
    fontSize: 11,
    textAlign: "right",
    marginBottom: 4,
  },
  hintCompact: {
    fontSize: 10,
    marginBottom: 2,
  },
  value: {
    color: homeTheme.text,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "right",
    lineHeight: 22,
  },
  valueCompact: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  valueLink: {
    color: homeTheme.accent,
    textDecorationLine: "underline",
    textDecorationColor: homeTheme.accentMuted,
  },
  valuePressable: {
    alignSelf: "stretch",
    alignItems: "flex-end",
    paddingVertical: 2,
  },
  valuePressed: { opacity: 0.85 },
});
