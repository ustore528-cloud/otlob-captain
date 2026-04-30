import { Pressable, StyleSheet, Text, View } from "react-native";
import { captainSpacing, captainUiTheme } from "@/theme/captain-ui-theme";

type Props = {
  label: string;
  value: string;
  /** أيقونة اختيارية من نص (رمز بسيط) */
  hint?: string;
  /** أول صف في القسم — بدون خط علوي */
  isFirst?: boolean;
  compact?: boolean;
  /** إبراز خاص لصفوف العنوان (Pickup/Dropoff) لقراءة أسرع على الشاشات الصغيرة */
  addressEmphasis?: boolean;
  /** عند الضغط — يُظهر القيمة كرابط (هاتف / خريطة) */
  onPressValue?: () => void;
  valueAccessibilityHint?: string;
};

export function DetailRow({
  label,
  value,
  hint,
  isFirst,
  compact,
  addressEmphasis,
  onPressValue,
  valueAccessibilityHint,
}: Props) {
  const valueNode = onPressValue ? (
    <Pressable
      onPress={onPressValue}
      hitSlop={6}
      accessibilityRole="link"
      accessibilityHint={valueAccessibilityHint}
      style={({ pressed }) => [styles.valuePressable, pressed && styles.valuePressed]}
    >
      <Text
        style={[
          styles.value,
          compact && styles.valueCompact,
          addressEmphasis && styles.valueAddress,
          compact && addressEmphasis && styles.valueAddressCompact,
          styles.valueLink,
        ]}
      >
        {value}
      </Text>
    </Pressable>
  ) : (
    <Text
      style={[
        styles.value,
        compact && styles.valueCompact,
        addressEmphasis && styles.valueAddress,
        compact && addressEmphasis && styles.valueAddressCompact,
      ]}
    >
      {value}
    </Text>
  );

  return (
    <View
      style={[
        styles.wrap,
        compact && styles.wrapCompact,
        isFirst && styles.wrapFirst,
        addressEmphasis && styles.wrapAddress,
        compact && addressEmphasis && styles.wrapAddressCompact,
      ]}
    >
      <Text style={[styles.label, compact && styles.labelCompact, addressEmphasis && styles.labelAddress]}>{label}</Text>
      {hint ? (
        <Text style={[styles.hint, compact && styles.hintCompact, addressEmphasis && styles.hintAddress]}>{hint}</Text>
      ) : null}
      {valueNode}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: captainUiTheme.border,
  },
  wrapCompact: {
    paddingVertical: 6,
  },
  wrapFirst: {
    borderTopWidth: 0,
  },
  wrapAddress: {
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: captainUiTheme.border,
    backgroundColor: captainUiTheme.neutralSoft,
    paddingHorizontal: captainSpacing.sm - 2,
    marginTop: 4,
  },
  wrapAddressCompact: {
    paddingVertical: 8,
    paddingHorizontal: 9,
  },
  label: {
    color: captainUiTheme.textSubtle,
    fontSize: 12,
    textAlign: "right",
    marginBottom: 4,
  },
  labelCompact: {
    fontSize: 10,
    marginBottom: 2,
  },
  labelAddress: {
    fontWeight: "800",
    fontSize: 12,
    color: captainUiTheme.textMuted,
    marginBottom: 3,
  },
  hint: {
    color: captainUiTheme.textMuted,
    fontSize: 11,
    textAlign: "right",
    marginBottom: 4,
  },
  hintCompact: {
    fontSize: 10,
    marginBottom: 2,
  },
  hintAddress: {
    fontSize: 11,
    marginBottom: 4,
  },
  value: {
    color: captainUiTheme.text,
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
  valueAddress: {
    fontSize: 17,
    lineHeight: 25,
    fontWeight: "700",
  },
  valueAddressCompact: {
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "700",
  },
  valueLink: {
    color: captainUiTheme.accent,
    textDecorationLine: "underline",
    textDecorationColor: captainUiTheme.accentMuted,
  },
  valuePressable: {
    alignSelf: "stretch",
    alignItems: "flex-end",
    paddingVertical: 2,
  },
  valuePressed: { opacity: 0.85 },
});
