import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { captainSpacing, captainTypography, captainUiTheme } from "@/theme/captain-ui-theme";
import { SectionCard } from "@/components/ui";
import { formatNotificationTime } from "../utils/format";

type Props = {
  title?: string;
  body?: string;
  createdAt?: string;
  loading: boolean;
  empty: boolean;
  onOpenNotifications?: () => void;
};

export function LastNotificationCard({
  title,
  body,
  createdAt,
  loading,
  empty,
  onOpenNotifications,
}: Props) {
  const { t } = useTranslation();

  const linkAction =
    onOpenNotifications != null ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("home.notificationsViewAll")}
        hitSlop={8}
        onPress={onOpenNotifications}
        style={({ pressed }) => [pressed && styles.linkPressed]}
      >
        <Text style={styles.link}>{t("home.notificationsViewAll")}</Text>
      </Pressable>
    ) : null;

  const bodySlot = loading ? (
    <View style={styles.center}>
      <ActivityIndicator color={captainUiTheme.accent} />
    </View>
  ) : empty ? (
    <Text style={styles.empty}>{t("home.notificationsEmpty")}</Text>
  ) : (
    <View>
      <Text style={styles.t} numberOfLines={2}>
        {title ?? t("common.emDash")}
      </Text>
      {body ? (
        <Text style={styles.b} numberOfLines={2}>
          {body}
        </Text>
      ) : null}
      {createdAt ? <Text style={styles.time}>{formatNotificationTime(createdAt)}</Text> : null}
    </View>
  );

  return (
    <Pressable
      style={({ pressed }) => [pressed && styles.pressed]}
      onPress={onOpenNotifications}
      disabled={onOpenNotifications == null}
      accessibilityRole={onOpenNotifications ? "button" : undefined}
    >
      <SectionCard
        title={t("home.lastNotificationSection")}
        icon="notifications-outline"
        compact
        headerActions={linkAction ?? undefined}
      >
        {bodySlot}
      </SectionCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.96 },
  linkPressed: { opacity: 0.85 },
  link: {
    color: captainUiTheme.accent,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
  },
  center: { paddingVertical: captainSpacing.md, alignItems: "center" },
  empty: {
    ...captainTypography.body,
    fontSize: 14,
    color: captainUiTheme.textMuted,
    textAlign: "right",
    lineHeight: 22,
  },
  t: {
    ...captainTypography.bodyStrong,
    color: captainUiTheme.text,
    fontSize: 15,
    textAlign: "right",
    lineHeight: 22,
  },
  b: {
    color: captainUiTheme.textMuted,
    fontSize: 13,
    marginTop: captainSpacing.sm - 2,
    textAlign: "right",
    lineHeight: 20,
  },
  time: {
    color: captainUiTheme.textSubtle,
    fontSize: 12,
    marginTop: captainSpacing.sm + 2,
    textAlign: "right",
  },
});
