import type { ReactNode } from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import {
  captainSpacing,
  captainTypography,
  captainUiTheme,
} from "@/theme/captain-ui-theme";

type Props = {
  /** أيقونة من المستدعي — بدون نص ثابت */
  icon?: ReactNode;
  title: string;
  body?: string;
  /** زر أو صف إجراء من المستدعي — عادة مكوّن أزرار مترجم */
  action?: ReactNode;
  minHeight?: number;
  style?: ViewStyle;
};

export function EmptyState({ icon, title, body, action, minHeight = 260, style }: Props) {
  return (
    <View style={[styles.wrap, { minHeight }, style]} accessibilityRole="summary">
      {icon ? <View style={styles.iconSlot}>{icon}</View> : null}
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {action ? <View style={styles.actionSlot}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: captainSpacing.screenHorizontal,
    paddingVertical: captainSpacing.xxl,
    justifyContent: "center",
    alignItems: "center",
    gap: captainSpacing.sm,
  },
  iconSlot: {
    marginBottom: captainSpacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    ...captainTypography.sectionTitle,
    color: captainUiTheme.text,
    textAlign: "center",
  },
  body: {
    ...captainTypography.body,
    color: captainUiTheme.textSubtle,
    textAlign: "center",
    maxWidth: 320,
    marginTop: captainSpacing.xs,
  },
  actionSlot: {
    marginTop: captainSpacing.lg,
    width: "100%",
    alignItems: "stretch",
    maxWidth: 360,
    gap: captainSpacing.sm,
  },
});
