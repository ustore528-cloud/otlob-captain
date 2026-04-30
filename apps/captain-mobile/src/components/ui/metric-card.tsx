import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import type { ReactNode } from "react";
import {
  captainSpacing,
  captainTypography,
  captainUiTheme,
} from "@/theme/captain-ui-theme";

type Props = {
  title: string;
  value: string;
  hint?: string;
  /** أيقونة اختيارية من المستدعي */
  accessory?: ReactNode;
  dense?: boolean;
  style?: ViewStyle;
};

export function MetricCard({ title, value, hint, accessory, dense, style }: Props) {
  return (
    <View style={[styles.card, dense && styles.cardDense, captainUiTheme.cardShadow, style]}>
      <View style={styles.top}>
        <View style={styles.textBlock}>
          <Text style={[styles.title, dense && styles.titleDense]} numberOfLines={2}>
            {title}
          </Text>
          <Text style={[styles.value, dense && styles.valueDense]} numberOfLines={2}>
            {value}
          </Text>
          {hint ? (
            <Text style={[styles.hint, dense && styles.hintDense]} numberOfLines={3}>
              {hint}
            </Text>
          ) : null}
        </View>
        {accessory ? <View style={styles.acc}>{accessory}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: captainUiTheme.surfaceElevated,
    borderRadius: captainUiTheme.radiusLg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: captainUiTheme.border,
    paddingHorizontal: captainSpacing.lg,
    paddingVertical: captainSpacing.md,
  },
  cardDense: {
    paddingHorizontal: captainSpacing.md,
    paddingVertical: captainSpacing.sm,
    borderRadius: captainUiTheme.radiusMd,
  },
  top: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: captainSpacing.sm,
  },
  textBlock: {
    flex: 1,
    gap: captainSpacing.xs,
    alignItems: "flex-end",
  },
  acc: {
    paddingTop: 2,
    justifyContent: "center",
  },
  title: {
    ...captainTypography.caption,
    color: captainUiTheme.textSubtle,
    textAlign: "right",
    width: "100%",
    textTransform: "none",
    fontWeight: "700",
  },
  titleDense: {
    fontSize: 11,
    lineHeight: 14,
  },
  value: {
    ...captainTypography.sectionTitle,
    color: captainUiTheme.accent,
    textAlign: "right",
    width: "100%",
  },
  valueDense: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
  },
  hint: {
    ...captainTypography.body,
    fontSize: 13,
    color: captainUiTheme.textMuted,
    textAlign: "right",
    width: "100%",
  },
  hintDense: {
    fontSize: 12,
    lineHeight: 18,
  },
});
