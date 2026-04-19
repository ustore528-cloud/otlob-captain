import { useMemo } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ScreenHeader } from "@/components/screen-header";
import { WorkStatusBanner } from "@/features/work-status";
import { homeTheme } from "@/features/home/theme";
import { screenStyles } from "@/theme/screen-styles";
import { useInnerToolBack } from "@/hooks/use-inner-tool-back";
import { useAuth } from "@/hooks/use-auth";
import { useCaptainTracking } from "../use-captain-tracking";

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
  const goBack = useInnerToolBack();
  const { isAuthenticated } = useAuth();
  const { snapshot, setSessionEnabled, refreshPermission } = useCaptainTracking();

  const reachabilityLabel = useMemo(() => {
    switch (snapshot.reachability) {
      case "online":
        return "متصل";
      case "offline":
        return "غير متصل";
      default:
        return "جارٍ التحقق…";
    }
  }, [snapshot.reachability]);

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={screenStyles.safe} edges={["top", "left", "right"]}>
        <WorkStatusBanner />
        <ScreenHeader title="التتبع" onBack={goBack} />
        <Text style={[styles.muted, styles.guestPad]}>سجّل الدخول لإرسال موقعك للخادم.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={screenStyles.safe} edges={["top", "left", "right"]}>
      <WorkStatusBanner />
      <ScreenHeader title="التتبع" onBack={goBack} />
      <ScrollView style={styles.scrollFlex} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sub}>
          إرسال موقعك دوريًا أثناء عمل التطبيق في المقدّمة. التتبع في الخلفية يُضاف لاحقًا عبر مهمة
          منفصلة.
        </Text>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={styles.rowStart}>
              <Text style={styles.cardTitle}>تتبع الموقع</Text>
              <Text style={styles.cardHint}>POST /mobile/captain/me/location كل ~30 ثانية</Text>
            </View>
            <Switch
              value={snapshot.sessionEnabled}
              onValueChange={setSessionEnabled}
              trackColor={{ false: "rgba(43, 43, 43, 0.22)", true: homeTheme.accentMuted }}
              thumbColor={snapshot.sessionEnabled ? homeTheme.accent : homeTheme.tabBarInactive}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>الصلاحيات</Text>
          <StatusRow
            label="إذن الموقع"
            value={
              snapshot.permission === "granted"
                ? "مسموح"
                : snapshot.permission === "denied"
                  ? "مرفوض"
                  : "غير محدد"
            }
            ok={snapshot.permission === "granted"}
          />
          <View style={styles.btnRow}>
            <Pressable style={styles.btnSecondary} onPress={() => void refreshPermission()}>
              <Text style={styles.btnSecondaryText}>إعادة طلب الإذن</Text>
            </Pressable>
            <Pressable style={styles.btnSecondary} onPress={() => void Linking.openSettings()}>
              <Text style={styles.btnSecondaryText}>إعدادات التطبيق</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>الحالة</Text>
          <StatusRow label="الشبكة" value={reachabilityLabel} ok={snapshot.reachability === "online"} />
          <StatusRow
            label="التطبيق"
            value={snapshot.appInForeground ? "في المقدّمة" : "في الخلفية — الإرسال متوقف مؤقتًا"}
            ok={snapshot.appInForeground}
          />
          <StatusRow
            label="في انتظار الإرسال"
            value={String(snapshot.pendingInOutbox)}
            ok={snapshot.pendingInOutbox === 0}
          />
        </View>

        {snapshot.lastFix ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>آخر قراءة GPS</Text>
            <Text style={styles.mono}>
              {snapshot.lastFix.latitude.toFixed(5)}, {snapshot.lastFix.longitude.toFixed(5)}
            </Text>
            <Text style={styles.time}>
              {new Date(snapshot.lastFix.recordedAtMs).toLocaleString("ar-SA")}
            </Text>
          </View>
        ) : null}

        {snapshot.lastServerAck ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>آخر تأكيد من الخادم</Text>
            <Text style={styles.mono}>
              {snapshot.lastServerAck.latitude.toFixed(5)}, {snapshot.lastServerAck.longitude.toFixed(5)}
            </Text>
            <Text style={styles.time}>{new Date(snapshot.lastServerAck.recordedAt).toLocaleString("ar-SA")}</Text>
          </View>
        ) : null}

        {snapshot.lastIssue ? (
          <View style={[styles.card, styles.issueCard]}>
            <View style={styles.issueHead}>
              <Ionicons name={issueIcon(snapshot.lastIssue.kind)} size={22} color={homeTheme.gold} />
              <Text style={styles.issueTitle}>تنبيه</Text>
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
  },
  rowBetween: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowStart: { flex: 1, alignItems: "flex-end" },
  cardTitle: { color: homeTheme.text, fontSize: 17, fontWeight: "800", textAlign: "right" },
  cardHint: { color: homeTheme.textMuted, fontSize: 12, textAlign: "right", marginTop: 4 },
  sectionTitle: {
    color: homeTheme.text,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: 10,
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
