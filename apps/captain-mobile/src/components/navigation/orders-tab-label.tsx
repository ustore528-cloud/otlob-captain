import { useTranslation } from "react-i18next";
import { Platform, Text } from "react-native";

type Props = {
  color: string;
  focused: boolean;
};

/**
 * Two-line label for the orders tab — font scaling for narrow Android tab bars.
 */
export function OrdersTabBarLabel({ color, focused: _focused }: Props) {
  const { t } = useTranslation();
  return (
    <Text
      accessibilityLabel={t("ordersTabLabel.a11y")}
      accessibilityRole="text"
      allowFontScaling
      maxFontSizeMultiplier={1.15}
      numberOfLines={2}
      adjustsFontSizeToFit
      minimumFontScale={Platform.OS === "android" ? 0.76 : 0.84}
      style={{
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
      {t("ordersTabLabel.line1")}
      {"\n"}
      {t("ordersTabLabel.line2")}
    </Text>
  );
}
