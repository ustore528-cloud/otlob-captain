import { Platform, Text } from "react-native";

type Props = {
  color: string;
  focused: boolean;
};

/**
 * Long Arabic label — two lines + font scaling so it stays readable on narrow Android tab bars.
 */
export function OrdersTabBarLabel({ color, focused: _focused }: Props) {
  return (
    <Text
      accessibilityLabel="الطلبات المتاحة"
      accessibilityRole="text"
      allowFontScaling
      maxFontSizeMultiplier={1.15}
      numberOfLines={2}
      adjustsFontSizeToFit
      minimumFontScale={Platform.OS === "android" ? 0.76 : 0.84}
      style={{
        /** Base size; `adjustsFontSizeToFit` + `minimumFontScale` shrink on very narrow tabs. */
        fontSize: 10.5,
        fontWeight: "800",
        color,
        textAlign: "center",
        lineHeight: 13,
        paddingHorizontal: 1,
        maxWidth: Platform.OS === "android" ? 82 : 90,
        ...(Platform.OS === "android" ? { includeFontPadding: false } : {}),
      }}
    >
      {"الطلبات\nالمتاحة"}
    </Text>
  );
}
