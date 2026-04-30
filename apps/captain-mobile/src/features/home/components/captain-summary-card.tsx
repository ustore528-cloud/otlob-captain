import { Text, View, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { CaptainAvailabilityStatus, CaptainPrepaidSummaryDto, CaptainProfileDto, SessionUserDto } from "@/services/api/dto";
import { captainSpacing, captainTypography, captainUiTheme } from "@/theme/captain-ui-theme";
import { parseAvailabilityStatus } from "../labels";
import { availabilityLabelT } from "@/lib/availability-text";
import { formatLogTime } from "@/lib/order-timestamps";
import { MetricCard, SectionCard, StatusBadge, type StatusBadgeVariant } from "@/components/ui";
import { formatOrderAmountAr } from "@/lib/order-currency";

type Props = {
  user: SessionUserDto;
  captain: CaptainProfileDto;
  prepaidBalance?: CaptainPrepaidSummaryDto | null;
};

function mapAvailabilityToBadgeVariant(av: CaptainAvailabilityStatus): StatusBadgeVariant {
  switch (av) {
    case "AVAILABLE":
      return "AVAILABLE";
    case "OFFLINE":
      return "OFFLINE";
    case "BUSY":
      return "BUSY";
    case "ON_DELIVERY":
      return "ON_DELIVERY";
    default:
      return "OFFLINE";
  }
}

export function CaptainSummaryCard({ user, captain, prepaidBalance }: Props) {
  const { t } = useTranslation();
  const av = parseAvailabilityStatus(captain.availabilityStatus) ?? "OFFLINE";
  const initial = user.fullName.trim().charAt(0) || t("common.placeholderInitial");
  const lastSeen = formatLogTime(captain.lastSeenAt);

  return (
    <SectionCard title={t("profile.title")} subtitle={t("profile.sub")} icon="person-outline" compact>
      <View style={styles.row}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.meta}>
          <Text style={styles.name} numberOfLines={1}>
            {user.fullName}
          </Text>
          <View style={styles.badgeWrap}>
            <StatusBadge variant={mapAvailabilityToBadgeVariant(av)} label={availabilityLabelT(av, t)} compact />
          </View>
        </View>
      </View>

      {prepaidBalance ? (
        <>
          <View style={styles.divider} />
          <View style={styles.metricGrid}>
            <MetricCard
              dense
              style={styles.metricCell}
              title={t("prepaid.labelRemaining")}
              value={formatOrderAmountAr(prepaidBalance.readAlignment?.displayBalance ?? prepaidBalance.currentBalance)}
              accessory={<Ionicons name="wallet-outline" size={18} color={captainUiTheme.accent} />}
            />
            <MetricCard
              dense
              style={styles.metricCell}
              title={t("prepaid.metricCommission")}
              value={`${prepaidBalance.commissionPercent}%`}
              accessory={<Ionicons name="pie-chart-outline" size={18} color={captainUiTheme.gold} />}
            />
            <MetricCard
              dense
              style={styles.metricCell}
              title={t("prepaid.metricEstimatedOrders")}
              value={
                prepaidBalance.estimatedRemainingOrders == null
                  ? t("prepaid.estimatedByFees")
                  : String(prepaidBalance.estimatedRemainingOrders)
              }
              accessory={<Ionicons name="layers-outline" size={18} color={captainUiTheme.gold} />}
            />
          </View>
        </>
      ) : null}

      <View style={styles.divider} />

      <View style={styles.lines}>
        <Text style={styles.lineMuted}>{t("homeProfile.area")}</Text>
        <Text style={styles.lineValue}>{captain.area ?? t("common.emDash")}</Text>
      </View>

      <View style={styles.lines}>
        <Text style={styles.lineMuted}>{t("homeProfile.vehicle")}</Text>
        <Text style={styles.lineValue}>{captain.vehicleType}</Text>
      </View>

      {lastSeen ? (
        <View style={styles.lines}>
          <Text style={styles.lineMuted}>{t("homeProfile.lastSeen")}</Text>
          <Text style={styles.lineValue}>{lastSeen}</Text>
        </View>
      ) : null}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  sectionShell: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    overflow: "visible",
  },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: captainSpacing.md - 2,
    paddingHorizontal: captainSpacing.md,
    paddingTop: captainSpacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: captainUiTheme.radiusMd + 4,
    backgroundColor: captainUiTheme.accentSoft,
    borderWidth: 1,
    borderColor: captainUiTheme.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 22,
    fontWeight: "800",
    color: captainUiTheme.accent,
  },
  meta: { flex: 1, alignItems: "flex-end", gap: captainSpacing.sm },
  name: {
    ...captainTypography.sectionTitle,
    color: captainUiTheme.text,
    textAlign: "right",
    width: "100%",
  },
  badgeWrap: {
    alignSelf: "flex-end",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: captainUiTheme.border,
    marginVertical: captainSpacing.md,
  },
  metricGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: captainSpacing.sm,
    justifyContent: "flex-end",
  },
  metricCell: {
    flexGrow: 1,
    flexBasis: "28%",
    minWidth: 104,
    maxWidth: "100%",
  },
  lines: { marginBottom: captainSpacing.sm + 2 },
  lineMuted: {
    color: captainUiTheme.textSubtle,
    fontSize: 12,
    textAlign: "right",
    marginBottom: captainSpacing.xs,
  },
  lineValue: {
    color: captainUiTheme.text,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "right",
  },
});
