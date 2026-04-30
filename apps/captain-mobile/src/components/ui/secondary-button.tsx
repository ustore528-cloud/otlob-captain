import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, type ViewStyle } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  captainRadius,
  captainSpacing,
  captainTypography,
  captainUiTheme,
} from "@/theme/captain-ui-theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

type Props = {
  onPress: () => void;
  label: string;
  disabled?: boolean;
  icon?: IconName;
  compact?: boolean;
  style?: ViewStyle;
  testID?: string;
};

/** زر ثانوي بحدّ وخلفية فاتحة */
export function SecondaryButton({
  onPress,
  label,
  disabled,
  icon,
  compact,
  style,
  testID,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      accessibilityLabel={label}
      testID={testID}
      onPress={() => {
        if (disabled) return;
        onPress();
      }}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={compact ? 16 : 18} color={captainUiTheme.accent} /> : null}
      <Text style={[styles.label, compact && styles.labelCompact]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    paddingVertical: captainSpacing.sm,
    paddingHorizontal: captainSpacing.lg,
    borderRadius: captainRadius.md,
    backgroundColor: captainUiTheme.surface,
    borderWidth: 1,
    borderColor: captainUiTheme.border,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: captainSpacing.sm,
  },
  compact: {
    minHeight: 38,
    paddingVertical: captainSpacing.xs,
    paddingHorizontal: captainSpacing.md,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.9,
    backgroundColor: captainUiTheme.accentSoft,
  },
  label: {
    ...captainTypography.bodyStrong,
    color: captainUiTheme.accent,
    fontWeight: "800",
  },
  labelCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
});
