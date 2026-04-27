import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { homeTheme } from "@/features/home/theme";

/** Centered waiting state while polling continues in background. */
export function AssignmentEmptyState() {
  const { t } = useTranslation();
  return (
    <View style={styles.wrap}>
      <View style={styles.iconBubble}>
        <Ionicons name="hourglass-outline" size={28} color={homeTheme.accent} />
      </View>
      <Text style={styles.line}>{t("assignmentEmpty.line1")}</Text>
      <Text style={styles.sub}>{t("assignmentEmpty.line2")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 320,
    paddingHorizontal: 18,
    paddingVertical: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  iconBubble: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: homeTheme.accentSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: homeTheme.border,
  },
  line: {
    color: homeTheme.text,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 34,
  },
  sub: {
    marginTop: 10,
    color: homeTheme.textSubtle,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
});
