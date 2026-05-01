import type { ReactNode } from "react";
import type { Edge } from "react-native-safe-area-context";
import { StyleSheet, useWindowDimensions, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CAPTAIN_MAX_CONTENT_WIDTH, CAPTAIN_TABLET_MIN_WIDTH } from "@/theme/captain-wide-layout";
import { captainSpacing, captainUiTheme } from "@/theme/captain-ui-theme";
import { rtlLayout } from "@/theme/rtl";

type Props = {
  children: ReactNode;
  /** حواف SafeArea — نفس الافتراضي الشائع للشاشات */
  edges?: readonly Edge[];
  style?: ViewStyle;
  /** غلاف داخلي اختياري تحت SafeArea */
  contentStyle?: ViewStyle;
  /** يضيف padding أفقي من captainSpacing.screenHorizontal */
  padded?: boolean;
  /**
   * When true (default), wide screens get a centered max-width column so cards do not stretch edge-to-edge on tablets.
   */
  constrainWideLayout?: boolean;
};

const DEFAULT_EDGES: readonly Edge[] = ["top", "left", "right"];

/**
 * غلاف شاشة موحّد: خلفية pageWash + اتجاه RTL للتطبيق.
 * لا يستبدل `screenStyles.safe` تلقائيًا — للاستخدام تدريجيًا في المرحلة 4.
 */
export function ScreenContainer({
  children,
  edges = DEFAULT_EDGES,
  style,
  contentStyle,
  padded = false,
  constrainWideLayout = true,
}: Props) {
  const { width } = useWindowDimensions();
  const wide = constrainWideLayout && width >= CAPTAIN_TABLET_MIN_WIDTH;
  return (
    <SafeAreaView
      edges={edges}
      style={[styles.safe, style]}
      accessibilityRole="none"
    >
      <View
        style={[
          styles.inner,
          padded && { paddingHorizontal: captainSpacing.screenHorizontal },
          wide && { maxWidth: CAPTAIN_MAX_CONTENT_WIDTH, width: "100%", alignSelf: "center" },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: captainUiTheme.pageBackground,
    ...rtlLayout,
  },
  inner: {
    flex: 1,
  },
});
