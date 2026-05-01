import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { parseAvailabilityStatus } from "@/features/home/labels";
import { useCaptainMe } from "@/hooks/api/use-captain-me";
import { useCaptainWorkStatus } from "@/hooks/api/use-captain-work-status";
import { useAuth } from "@/hooks/use-auth";
import type { QuickWorkStatusCode } from "@/services/api/dto/captain.dto";
import { homeTheme } from "@/features/home/theme";
import { WORK_STATUS_PALETTE } from "./work-status-palette";

const DEMAND_I18N_KEY: Record<QuickWorkStatusCode, string> = {
  PRESSURE: "captain.status.pressure",
  LOW_ACTIVITY: "captain.status.normalDemand",
  RAISE_READINESS: "captain.status.raiseReadiness",
  ON_FIRE: "captain.status.highDemand",
};

const MOVEMENT_MODE_KEY = "captain.status.movementMode";

/**
 * Full-width strip under the safe area when the admin quick work-status signal is active.
 */
export function WorkStatusBanner() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { data, isError } = useCaptainWorkStatus();
  const meQuery = useCaptainMe({
    enabled: isAuthenticated,
    staleTime: 25_000,
  });

  if (isError || !data || !data.active) {
    return null;
  }

  const palette = WORK_STATUS_PALETTE[data.code] ?? WORK_STATUS_PALETTE.PRESSURE;
  const demandKey = DEMAND_I18N_KEY[data.code];
  const demandText = t(demandKey);
  const displayDemand = demandText !== demandKey ? demandText : data.code;

  const movementLabel = t(MOVEMENT_MODE_KEY);

  const availability = meQuery.isSuccess
    ? (parseAvailabilityStatus(meQuery.data.captain.availabilityStatus) ?? "OFFLINE")
    : null;
  const isOffline = availability === "OFFLINE";
  const metaLine =
    availability != null
      ? t("captain.status.detailLine", {
          net: t(isOffline ? "captain.status.offline" : "captain.status.online"),
          activity: t(isOffline ? "captain.status.inactive" : "captain.status.active"),
        })
      : null;

  const a11y =
    availability != null
      ? t("captain.status.a11yFull", {
          movementMode: movementLabel,
          demand: displayDemand,
          net: t(isOffline ? "captain.status.offline" : "captain.status.online"),
          activity: t(isOffline ? "captain.status.inactive" : "captain.status.active"),
        })
      : t("captain.status.a11yDemandOnly", {
          movementMode: movementLabel,
          demand: displayDemand,
        });

  return (
    <View
      style={[styles.wrap, { backgroundColor: palette.bg, borderColor: palette.border }]}
      accessibilityRole="alert"
      accessibilityLabel={a11y}
    >
      <Ionicons name={palette.icon} size={18} color={palette.text} style={styles.icon} />
      <View style={styles.textCol}>
        <Text style={[styles.kicker, { color: palette.text }]} numberOfLines={1}>
          {movementLabel}
        </Text>
        <Text style={[styles.text, { color: palette.text }]} numberOfLines={2}>
          {displayDemand}
        </Text>
        {metaLine ? (
          <Text style={[styles.meta, { color: palette.text }]} numberOfLines={1}>
            {metaLine}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: homeTheme.border,
  },
  icon: { marginTop: 2 },
  textCol: { flex: 1, gap: 2 },
  kicker: {
    fontSize: 11,
    fontWeight: "700",
    textAlign: "right",
    opacity: 0.92,
  },
  text: {
    fontSize: 13,
    fontWeight: "800",
    textAlign: "right",
    lineHeight: 19,
  },
  meta: {
    fontSize: 11,
    fontWeight: "700",
    textAlign: "right",
    opacity: 0.9,
    marginTop: 2,
  },
});
