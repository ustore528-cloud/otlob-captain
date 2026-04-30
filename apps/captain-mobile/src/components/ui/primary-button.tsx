import type { ComponentProps, ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  captainPalette,
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
  loading?: boolean;
  /** أيقونة يسار النص المرئية في RTL (= بداية الصف المعكوسة) */
  icon?: IconName;
  fullWidth?: boolean;
  style?: ViewStyle;
  testID?: string;
};

/** زر أساسي — أحمر غامق؛ النص والـ accessibility من المستدعي */
export function PrimaryButton({
  onPress,
  label,
  disabled,
  loading,
  icon,
  fullWidth,
  style,
  testID,
}: Props) {
  const blocked = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(blocked) }}
      accessibilityLabel={label}
      testID={testID}
      onPress={() => {
        if (blocked) return;
        onPress();
      }}
      style={({ pressed }) => [
        styles.base,
        fullWidth && styles.fullWidth,
        blocked && styles.disabled,
        pressed && !blocked && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={captainUiTheme.onAccent} size="small" />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={captainUiTheme.onAccent} /> : null}
          <Text style={styles.label}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingVertical: captainSpacing.sm,
    paddingHorizontal: captainSpacing.xl,
    borderRadius: captainRadius.md,
    backgroundColor: captainPalette.brandRedDark,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: captainSpacing.sm,
  },
  fullWidth: {
    alignSelf: "stretch",
    width: "100%",
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.88,
  },
  label: {
    ...captainTypography.bodyStrong,
    fontWeight: "800",
    color: captainUiTheme.onAccent,
  },
});
