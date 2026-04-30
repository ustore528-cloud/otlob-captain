import { I18nManager, Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import {
  captainRadius,
  captainSpacing,
  captainUiTheme,
} from "@/theme/captain-ui-theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

export type ActionRowItem = {
  key: string;
  icon: IconName;
  onPress: () => void;
  /** وصف الوصول يأتي من المستدعي (مفتاح ترجمة مُطبَّق خارجيًا). */
  accessibilityLabel: string;
  disabled?: boolean;
};

type Props = {
  items: ActionRowItem[];
  style?: ViewStyle;
};

/**
 * صف أزرار أيقونة — اتجاه مرآة حسب RTL.
 * لا يحتوي على نصوص جاهزة؛ تمرير `accessibilityLabel` فقط إن احتجت.
 */
export function ActionRow({ items, style }: Props) {
  return (
    <View
      style={[
        styles.row,
        { flexDirection: I18nManager.isRTL ? "row-reverse" : "row" },
        style,
      ]}
      accessibilityRole="toolbar"
    >
      {items.map((item) => (
        <Pressable
          key={item.key}
          accessibilityRole="button"
          accessibilityLabel={item.accessibilityLabel}
          accessibilityState={{ disabled: Boolean(item.disabled) }}
          disabled={item.disabled}
          onPress={item.onPress}
          hitSlop={10}
          style={({ pressed }) => [
            styles.btn,
            item.disabled && styles.btnDisabled,
            pressed && !item.disabled && styles.btnPressed,
          ]}
        >
          <Ionicons
            name={item.icon}
            size={20}
            color={item.disabled ? captainUiTheme.textSubtle : captainUiTheme.accent}
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
    gap: captainSpacing.md,
    paddingVertical: captainSpacing.sm,
  },
  btn: {
    width: 44,
    height: 44,
    borderRadius: captainRadius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: captainUiTheme.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: captainUiTheme.surfaceElevated,
    ...captainUiTheme.cardShadow,
  },
  btnDisabled: {
    opacity: 0.45,
    backgroundColor: captainUiTheme.neutralSoft,
  },
  btnPressed: {
    opacity: 0.88,
    backgroundColor: captainUiTheme.accentSoft,
  },
});
