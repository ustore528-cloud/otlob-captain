import { StyleSheet, Text, type TextStyle } from "react-native";
import { captainRadius, captainSpacing, captainTypography, captainUiTheme } from "@/theme/captain-ui-theme";

/** قيم مرئية فقط — تطابق أسماء حالات الطلب/التوفر من السيرفر دون تغيير العقد */
export type StatusBadgeVariant =
  | "OFFER"
  | "ACTIVE"
  | "ACCEPTED"
  | "ASSIGNED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "CANCELLED"
  | "EXPIRED"
  | "AVAILABLE"
  | "NONE"
  | "PENDING"
  | "CONFIRMED"
  | "BUSY"
  | "OFFLINE"
  | "ON_DELIVERY";

type Props = {
  variant: StatusBadgeVariant;
  /** النص المعروض (مترجم من الشاشة) */
  label: string;
  compact?: boolean;
  style?: TextStyle;
};

function colorsForVariant(
  variant: StatusBadgeVariant,
): { bg: string; border: string; fg: string } {
  switch (variant) {
    case "OFFER":
      return {
        bg: captainUiTheme.statusOfferSoft,
        border: captainUiTheme.statusOfferBorder,
        fg: captainUiTheme.statusOfferText,
      };
    case "ACTIVE":
    case "ACCEPTED":
    case "ASSIGNED":
    case "CONFIRMED":
      return {
        bg: captainUiTheme.statusAcceptedSoft,
        border: captainUiTheme.statusAcceptedBorder,
        fg: captainUiTheme.statusAcceptedText,
      };
    case "PICKED_UP":
    case "IN_TRANSIT":
    case "BUSY":
    case "ON_DELIVERY":
      return {
        bg: captainUiTheme.statusTransitSoft,
        border: captainUiTheme.statusTransitBorder,
        fg: captainUiTheme.statusTransitText,
      };
    case "DELIVERED":
      return {
        bg: captainUiTheme.successSoft,
        border: captainUiTheme.successBorder,
        fg: captainUiTheme.successText,
      };
    case "CANCELLED":
    case "EXPIRED":
      return {
        bg: captainUiTheme.dangerSoft,
        border: captainUiTheme.dangerBorder,
        fg: captainUiTheme.dangerText,
      };
    case "AVAILABLE":
      return {
        bg: captainUiTheme.successSoft,
        border: captainUiTheme.successBorder,
        fg: captainUiTheme.successText,
      };
    case "OFFLINE":
    case "NONE":
    case "PENDING":
    default:
      return {
        bg: captainUiTheme.neutralSoft,
        border: captainUiTheme.border,
        fg: captainUiTheme.textMuted,
      };
  }
}

export function StatusBadge({ variant, label, compact, style }: Props) {
  const c = colorsForVariant(variant);
  const themed: TextStyle = {
    backgroundColor: c.bg,
    borderColor: c.border,
    color: c.fg,
  };
  return (
    <Text
      accessibilityRole="text"
      numberOfLines={1}
      style={[
        styles.badge,
        compact && styles.badgeCompact,
        themed,
        style,
      ]}
    >
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  badge: {
    ...captainTypography.caption,
    alignSelf: "flex-start",
    paddingHorizontal: captainSpacing.sm,
    paddingVertical: captainSpacing.xs,
    borderRadius: captainRadius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    textAlign: "center",
    maxWidth: "100%",
  },
  badgeCompact: {
    fontSize: 11,
    lineHeight: 14,
    paddingHorizontal: captainSpacing.sm,
    paddingVertical: 2,
  },
});
