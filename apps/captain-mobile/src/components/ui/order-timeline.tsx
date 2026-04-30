import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { captainSpacing, captainTypography, captainUiTheme } from "@/theme/captain-ui-theme";

export type OrderTimelineStepState = "done" | "current" | "upcoming";

export type OrderTimelineStep = {
  /** مفتاح ثابت للقائمة — ليس عنوانًا للعرض */
  key: string;
  /** عنوان معروض (من المستدعي ومترجم) */
  title: string;
  subtitle?: string;
  state: OrderTimelineStepState;
};

type Props = {
  steps: OrderTimelineStep[];
  style?: ViewStyle;
};

/**
 * Timeline بصري فقط — المنطق يبقى عند الشاشة (تحديد الخطوة الحالية).
 */
export function OrderTimeline({ steps, style }: Props) {
  return (
    <View style={[styles.wrapper, style]} accessibilityRole="list">
      {steps.map((step, index) => {
        const last = index === steps.length - 1;
        return (
          <View key={step.key} style={styles.row} accessibilityRole="text">
            <View style={styles.leftRail}>
              <View style={[styles.dot, dotStyle(step.state)]} />
              {!last ? <View style={[styles.line, lineStyle(step.state)]} /> : null}
            </View>
            <View style={styles.content}>
              <Text style={[styles.title, titleStyle(step.state)]}>{step.title}</Text>
              {step.subtitle ? (
                <Text style={[styles.sub, subtitleStyle(step.state)]}>{step.subtitle}</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function dotStyle(state: OrderTimelineStepState): ViewStyle {
  switch (state) {
    case "done":
      return { backgroundColor: captainUiTheme.accent, borderColor: captainUiTheme.accent };
    case "current":
      return {
        backgroundColor: captainUiTheme.surfaceElevated,
        borderColor: captainUiTheme.accent,
        borderWidth: 2,
      };
    default:
      return {
        backgroundColor: captainUiTheme.border,
        borderColor: captainUiTheme.borderStrong,
      };
  }
}

function lineStyle(state: OrderTimelineStepState): ViewStyle {
  if (state === "done") {
    return { backgroundColor: captainUiTheme.accentMuted };
  }
  return { backgroundColor: captainUiTheme.border };
}

function titleStyle(state: OrderTimelineStepState): { color: string } {
  if (state === "upcoming") {
    return { color: captainUiTheme.textMuted };
  }
  return { color: captainUiTheme.text };
}

function subtitleStyle(state: OrderTimelineStepState): { color: string } {
  if (state === "upcoming") {
    return { color: captainUiTheme.textSubtle };
  }
  return { color: captainUiTheme.textMuted };
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 0,
    paddingVertical: captainSpacing.sm,
    paddingHorizontal: captainSpacing.xs,
  },
  row: {
    flexDirection: "row-reverse",
    alignItems: "stretch",
    minHeight: 44,
  },
  leftRail: {
    width: 22,
    alignItems: "center",
    marginLeft: captainSpacing.sm,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 6,
    zIndex: 1,
  },
  line: {
    flex: 1,
    width: 2,
    marginTop: 2,
    minHeight: 18,
    borderRadius: 1,
  },
  content: {
    flex: 1,
    paddingBottom: captainSpacing.lg,
    alignItems: "flex-end",
  },
  title: {
    ...captainTypography.bodyStrong,
    textAlign: "right",
    width: "100%",
  },
  sub: {
    ...captainTypography.body,
    fontSize: 13,
    marginTop: captainSpacing.xs,
    textAlign: "right",
    width: "100%",
  },
});
