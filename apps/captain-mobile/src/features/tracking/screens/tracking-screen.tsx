import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ScreenHeader } from "@/components/screen-header";
import { WorkStatusBanner } from "@/features/work-status";
import { homeTheme } from "@/features/home/theme";
import { screenStyles } from "@/theme/screen-styles";
import { useInnerToolBack } from "@/hooks/use-inner-tool-back";
import { useAuth } from "@/hooks/use-auth";
import { formatLocaleDateTimeMs } from "@/features/home/utils/format";
import { useCaptainTracking } from "@/features/tracking";

function issueIcon(kind: string): keyof typeof Ionicons.glyphMap {
  switch (kind) {
    case "permission_denied":
      return "hand-left-outline";
    case "gps_unavailable":
      return "navigate-outline";
    case "network":
      return "cloud-offline-outline";
    default:
      return "alert-circle-outline";
  }
}

export function TrackingScreen() {
  const { t } = useTranslation();
  const goBack = useInnerToolBack();
  const { isAuthenticated } = useAuth();
  const { snapshot, refreshPermission } = useCaptainTracking();

  const reachabilityLabel = useMemo(() => {
    switch (snapshot.reachability) {
      case "online":
        return t("tracking.reachabilityOnline");
      case "offline":
        return t("tracking.reachabilityOffline");
      default:
        return t("tracking.reachabilityUnknown");
    }
  }, [snapshot.reachability, t]);

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={screenStyles.safe} edges={["top", "left", "right"]}>
        <WorkStatusBanner />
        <ScreenHeader title={t("tracking.title")} onBack={goBack} />
        <Text style={[styles.muted, styles.guestPad]}>{t("tracking.guest")}</Text>
      </SafeAreaView>
    );
  }

  const trackingCaption = snapshot.sessionEnabled ? t("tracking.trackingOnCaption") : t("tracking.trackingOffCaption");

  return (
    <SafeAreaView style={screenStyles.safe} edges={["top", "left", "right"]}>
      <WorkStatusBanner />
      <ScreenHeader title={t("tracking.title")} onBack={goBack} />
      <ScrollView style={styles.scrollFlex} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sub}>{t("tracking.intro")}</Text>
        <Text style={styles.subSecondary}>{t("tracking.subAvailabilityDriven")}</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("tracking.sectionTrackingControl")}</Text>
          <View style={styles.availabilityRow}>
            <Ionicons
              name={snapshot.sessionEnabled ? "radio-button-on-outline" : "radio-button-off-outline"}
              size={22}
              color={snapshot.sessionEnabled ? homeTheme.success : homeTheme.textMuted}
            />
            <Text style={styles.availabilityCaption}>{trackingCaption}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("tracking.sectionPermissions")}</Text>
          <StatusRow
            label={t("tracking.permissionLabel")}
            value={
              snapshot.permission === "granted"
                ? t("tracking.permissionGranted")
                : snapshot.permission === "denied"
                  ? t("tracking.permissionDenied")
                  : t("tracking.permissionUnknown")
            }
            ok={snapshot.permission === "granted"}
          />
          {snapshot.permission !== "granted" ? (
            <Text style={styles.permissionCallout}>{t("tracking.permissionCallout")}</Text>
          ) : null}
          <View style={styles.btnRow}>
            <Pressable style={styles.btnSecondary} onPress={() => void refreshPermission()}>
              <Text style={styles.btnSecondaryText}>{t("tracking.btnRequestAgain")}</Text>
            </Pressable>
            <Pressable style={styles.btnSecondary} onPress={() => void Linking.openSettings()}>
              <Text style={styles.btnSecondaryText}>{t("tracking.btnAppSettings")}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("tracking.sectionStatus")}</Text>
          <StatusRow
            label={t("tracking.labelNetwork")}
            value={reachabilityLabel}
            ok={snapshot.reachability === "online"}
          />
          <StatusRow
            label={t("tracking.labelApp")}
            value={snapshot.appInForeground ? t("tracking.appForeground") : t("tracking.appBackground")}
            ok={snapshot.appInForeground}
          />
          <StatusRow
            label={t("tracking.labelOutbox")}
            value={String(snapshot.pendingInOutbox)}
            ok={snapshot.pendingInOutbox === 0}
          />
        </View>

        {snapshot.lastFix ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t("tracking.sectionLastGps")}</Text>
            <Text style={styles.mono}>
              {snapshot.lastFix.latitude.toFixed(5)}, {snapshot.lastFix.longitude.toFixed(5)}
            </Text>
            <Text style={styles.time}>{formatLocaleDateTimeMs(snapshot.lastFix.recordedAtMs)}</Text>
          </View>
        ) : null}

        {snapshot.lastServerAck ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t("tracking.sectionLastServer")}</Text>
            <Text style={styles.mono}>
              {snapshot.lastServerAck.latitude.toFixed(5)}, {snapshot.lastServerAck.longitude.toFixed(5)}
            </Text>
            <Text style={styles.time}>
              {formatLocaleDateTimeMs(new Date(snapshot.lastServerAck.recordedAt).getTime())}
            </Text>
          </View>
        ) : null}

        {snapshot.lastIssue ? (
          <View style={[styles.card, styles.issueCard]}>
            <View style={styles.issueHead}>
              <Ionicons name={issueIcon(snapshot.lastIssue.kind)} size={22} color={homeTheme.gold} />
              <Text style={styles.issueTitle}>{t("tracking.issueTitle")}</Text>
            </View>
            <Text style={styles.issueBody}>{snapshot.lastIssue.message}</Text>
          </View>
        ) : null}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <View style={styles.statusRow}>
      <Text style={styles.statusLabel}>{label}</Text>
      <View style={styles.statusRight}>
        <Ionicons
          name={ok ? "checkmark-circle" : "ellipse-outline"}
          size={18}
          color={ok ? homeTheme.success : homeTheme.textMuted}
        />
        <Text style={styles.statusValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollFlex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
  guestPad: { paddingHorizontal: 20, paddingTop: 12 },
  sub: {
    color: homeTheme.textSubtle,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "right",
    marginTop: 8,
    marginBottom: 8,
  },
  subSecondary: {
    color: homeTheme.textMuted,
    fontSize: 13,
    lineHeight: 21,
    textAlign: "right",
    marginBottom: 16,
  },
  muted: { color: homeTheme.textMuted, textAlign: "right", marginTop: 8 },
  card: {
    backgroundColor: homeTheme.surfaceElevated,
    borderRadius: homeTheme.radiusLg,
    padding: 16,
    borderWidth: 1,
    borderColor: homeTheme.border,
    marginBottom: 12,
    ...homeTheme.cardShadow,
  },
  sectionTitle: {
    color: homeTheme.text,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: 10,
  },
  availabilityRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
  },
  availabilityCaption: {
    flex: 1,
    color: homeTheme.text,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "right",
  },
  permissionCallout: {
    color: homeTheme.textMuted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "right",
    marginTop: 8,
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: homeTheme.border,
  },
  statusLabel: { color: homeTheme.textSubtle, fontSize: 13 },
  statusRight: { flexDirection: "row-reverse", alignItems: "center", gap: 6, maxWidth: "58%" },
  statusValue: { color: homeTheme.text, fontSize: 13, fontWeight: "600", textAlign: "right", flex: 1 },
  btnRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginTop: 12 },
  btnSecondary: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: homeTheme.radiusMd,
    borderWidth: 1,
    borderColor: homeTheme.border,
    backgroundColor: homeTheme.surface,
  },
  btnSecondaryText: { color: homeTheme.accent, fontWeight: "700", fontSize: 13 },
  mono: {
    color: homeTheme.text,
    fontSize: 14,
    fontFamily: "monospace",
    textAlign: "right",
    marginTop: 4,
  },
  time: { color: homeTheme.textMuted, fontSize: 12, textAlign: "right", marginTop: 6 },
  issueCard: {
    borderColor: homeTheme.goldMuted,
    backgroundColor: homeTheme.goldSoft,
  },
  issueHead: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  issueTitle: { color: homeTheme.gold, fontWeight: "800", fontSize: 16 },
  issueBody: { color: homeTheme.textMuted, fontSize: 14, lineHeight: 22, textAlign: "right" },
});
