import type { ComponentProps, ReactNode } from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  captainSpacing,
  captainTypography,
  captainUiTheme,
} from "@/theme/captain-ui-theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

type Props = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  icon?: IconName;
  /** صفّ إضافي في الرأس — أزرار دون نص ثابت */
  headerActions?: ReactNode;
  compact?: boolean;
  style?: ViewStyle;
};

/**
 * بطاقة قسم موحدة للمرحلة 4.
 * مختلفة عن `features/order-detail/components/section-card` (التي تبقى كما هي).
 */
export function SectionCard({
  children,
  title,
  subtitle,
  icon,
  headerActions,
  compact,
  style,
}: Props) {
  const showHeader =
    Boolean(title) || Boolean(subtitle) || Boolean(icon) || headerActions != null;

  return (
    <View
      style={[
        styles.card,
        compact && styles.cardCompact,
        captainUiTheme.cardShadow,
        style,
      ]}
    >
      {showHeader ? (
        <View style={[styles.head, compact && styles.headCompact]}>
          <View style={styles.headRow}>
            {icon ? (
              <Ionicons
                name={icon}
                size={compact ? 16 : 20}
                color={captainUiTheme.accent}
              />
            ) : (
              <View style={styles.iconSpacer} />
            )}
            <View style={styles.headTexts}>
              {title ? (
                <Text
                  style={[
                    styles.title,
                    compact && styles.titleCompact,
                  ]}
                  numberOfLines={2}
                >
                  {title}
                </Text>
              ) : null}
              {subtitle ? (
                <Text style={[styles.subtitle, compact && styles.subtitleCompact]} numberOfLines={3}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            {headerActions ? <View style={styles.actionsSlot}>{headerActions}</View> : null}
          </View>
        </View>
      ) : null}

      <View style={[styles.body, compact && styles.bodyCompact]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: captainUiTheme.surfaceElevated,
    borderRadius: captainUiTheme.radiusLg,
    borderWidth: 1,
    borderColor: captainUiTheme.border,
    overflow: "hidden",
  },
  cardCompact: {
    borderRadius: captainUiTheme.radiusMd,
  },
  head: {
    paddingHorizontal: captainSpacing.lg,
    paddingVertical: captainSpacing.md,
    backgroundColor: captainUiTheme.cardHeaderTint,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: captainUiTheme.border,
  },
  headCompact: {
    paddingHorizontal: captainSpacing.md,
    paddingVertical: captainSpacing.sm,
  },
  headRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: captainSpacing.sm,
  },
  headTexts: {
    flex: 1,
    gap: captainSpacing.xs,
    alignItems: "flex-end",
  },
  iconSpacer: { width: 4 },
  title: {
    ...captainTypography.cardTitle,
    color: captainUiTheme.text,
    textAlign: "right",
    width: "100%",
  },
  titleCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
  subtitle: {
    ...captainTypography.body,
    color: captainUiTheme.textSubtle,
    textAlign: "right",
    width: "100%",
  },
  subtitleCompact: {
    fontSize: 12,
    lineHeight: 18,
  },
  actionsSlot: {
    justifyContent: "center",
    minHeight: 32,
  },
  body: {
    paddingHorizontal: captainSpacing.lg,
    paddingBottom: captainSpacing.sm,
    paddingTop: captainSpacing.xs,
  },
  bodyCompact: {
    paddingHorizontal: captainSpacing.md,
    paddingBottom: captainSpacing.xs,
    paddingTop: 2,
  },
});
