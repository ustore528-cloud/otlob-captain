import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { homeTheme } from "@/features/home/theme";

const SIDE = 88;

type Props = {
  title: string;
  /** When omitted, the bar is title-only (e.g. tab root) — same chrome, no trailing control. */
  onBack?: () => void;
  backLabel?: string;
};

/**
 * Page header inside Safe Area: optional back + title in one bar (not a floating overlay).
 * Parent should wrap the screen in `SafeAreaView` with top edge.
 */
export function ScreenHeader({ title, onBack, backLabel = "رجوع" }: Props) {
  return (
    <View style={styles.shell}>
      <View style={styles.row} accessibilityRole="header">
        <View style={[styles.side, styles.sideStart]}>
          {onBack ? (
            <Pressable
              onPress={onBack}
              hitSlop={10}
              style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
              accessibilityRole="button"
              accessibilityLabel={backLabel}
            >
              <Ionicons name="chevron-forward" size={22} color={homeTheme.text} />
              <Text style={styles.backText}>{backLabel}</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.side} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: homeTheme.cardWhite,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: homeTheme.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    minHeight: 44,
  },
  side: {
    width: SIDE,
    minHeight: 44,
    justifyContent: "center",
  },
  /** Back column: align control to the outer edge (RTL: visual start of the bar). */
  sideStart: {
    alignItems: "flex-end",
  },
  back: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
  },
  backPressed: { opacity: 0.75 },
  backText: {
    color: homeTheme.accent,
    fontSize: 15,
    fontWeight: "700",
  },
  title: {
    flex: 1,
    textAlign: "center",
    color: homeTheme.text,
    fontSize: 17,
    fontWeight: "800",
  },
});
