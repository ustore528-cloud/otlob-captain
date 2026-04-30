import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/ui/empty-state";
import { captainSpacing, captainRadius, captainUiTheme } from "@/theme/captain-ui-theme";

/** Centered waiting state while polling continues in background. */
export function AssignmentEmptyState() {
  const { t } = useTranslation();

  const icon = (
    <View style={styles.iconBubble}>
      <Ionicons name="hourglass-outline" size={28} color={captainUiTheme.accent} />
    </View>
  );

  return (
    <EmptyState
      icon={icon}
      title={t("assignmentEmpty.line1")}
      body={t("assignmentEmpty.line2")}
      minHeight={320}
      style={styles.emptyWrap}
    />
  );
}

const styles = StyleSheet.create({
  emptyWrap: {
    paddingHorizontal: 0,
    paddingVertical: captainSpacing.sm,
    width: "100%",
  },
  iconBubble: {
    width: 60,
    height: 60,
    borderRadius: captainRadius.md,
    marginBottom: captainSpacing.sm + 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: captainUiTheme.accentSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: captainUiTheme.border,
  },
});
