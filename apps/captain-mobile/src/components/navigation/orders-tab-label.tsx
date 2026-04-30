import { useTranslation } from "react-i18next";
import { Platform, Text } from "react-native";
import { captainSpacing, captainTypography, captainUiTheme } from "@/theme/captain-ui-theme";

type Props = {
  color: string;
  focused: boolean;
};

/**
 * Two-line label for the orders tab — font scaling for narrow Android tab bars.
 */
export function OrdersTabBarLabel({ color, focused }: Props) {
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
        ...captainTypography.tabLabel,
        fontWeight: focused ? "800" : captainTypography.tabLabel.fontWeight,
        fontSize: focused ? 11.5 : captainTypography.tabLabel.fontSize,
        color,
        textAlign: "center",
        lineHeight: focused ? 14 : 13,
        paddingHorizontal: captainSpacing.xs / 4,
        maxWidth: Platform.OS === "android" ? 82 : 90,
        ...(Platform.OS === "android" ? { includeFontPadding: false } : {}),
        ...(focused
          ? {
              textShadowColor: captainUiTheme.accentSoft,
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 3,
            }
          : {}),
      }}
    >
      {t("ordersTabLabel.line1")}
      {"\n"}
      {t("ordersTabLabel.line2")}
    </Text>
  );
}
