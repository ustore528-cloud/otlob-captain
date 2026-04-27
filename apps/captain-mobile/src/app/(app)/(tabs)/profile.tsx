import { useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/screen-header";
import { WorkStatusBanner } from "@/features/work-status";
import { useInnerToolBack } from "@/hooks/use-inner-tool-back";
import {
  AvailabilityControl,
  availabilityLabelT,
  parseAvailabilityStatus,
  useUpdateAvailability,
} from "@/features/availability";
import { homeTheme } from "@/features/home/theme";
import { alertMutationError } from "@/lib/alert-mutation-error";
import { screenStyles } from "@/theme/screen-styles";
import { useCaptainMe } from "@/hooks/api/use-captain-me";
import { useAuth } from "@/hooks/use-auth";
import type { CaptainAvailabilityStatus } from "@/services/api/dto";

export default function ProfileTab() {
  const { t } = useTranslation();
  const { user, captain, signOut, isAuthenticated } = useAuth();
  const goBack = useInnerToolBack();
  const meQuery = useCaptainMe({ enabled: isAuthenticated, staleTime: 20_000 });
  const updateAv = useUpdateAvailability();

  const currentAvailability: CaptainAvailabilityStatus = useMemo(() => {
    const raw = meQuery.data?.captain.availabilityStatus ?? captain?.availabilityStatus;
    return parseAvailabilityStatus(raw ?? "") ?? "OFFLINE";
  }, [meQuery.data?.captain.availabilityStatus, captain?.availabilityStatus]);

  const onAvailability = useCallback(
    (next: CaptainAvailabilityStatus) => {
      updateAv.mutate(next, {
        onError: (e) => alertMutationError(t("profile.updateErrorTitle"), e, t("profile.updateErrorHint")),
      });
    },
    [updateAv, t],
  );

  return (
    <SafeAreaView style={screenStyles.safe} edges={["top", "left", "right"]}>
      <WorkStatusBanner />
      <ScreenHeader title={t("profile.title")} onBack={goBack} />
      <ScrollView style={styles.scrollFlex} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.screenSub}>{t("profile.sub")}</Text>

        <View style={styles.card}>
          <Row label={t("profile.name")} value={user?.fullName ?? t("common.emDash")} />
          <Row label={t("profile.phone")} value={user?.phone ?? t("common.emDash")} />
          <Row label={t("profile.email")} value={user?.email ?? t("common.emDash")} />
          <Row label={t("profile.area")} value={captain?.area ?? t("common.emDash")} />
          <Row label={t("profile.currentAvailability")} value={availabilityLabelT(currentAvailability, t)} />
        </View>

        <View style={{ height: 16 }} />

        <AvailabilityControl
          value={currentAvailability}
          pending={updateAv.isPending}
          onChange={onAvailability}
          title={t("profile.availabilityChangeTitle")}
          subtitle={t("profile.availabilityChangeSubtitle")}
          compact
        />

        <Pressable
          style={styles.out}
          onPress={() => {
            void signOut();
          }}
        >
          <Text style={styles.outText}>{t("profile.signOut")}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollFlex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 32, paddingTop: 8 },
  screenSub: {
    color: homeTheme.textSubtle,
    fontSize: 14,
    textAlign: "right",
    marginBottom: 16,
  },
  card: {
    backgroundColor: homeTheme.surfaceElevated,
    borderRadius: homeTheme.radiusLg,
    padding: 16,
    borderWidth: 1,
    borderColor: homeTheme.border,
    gap: 12,
  },
  row: { gap: 4 },
  label: {
    color: homeTheme.textSubtle,
    fontSize: 12,
    textAlign: "right",
    writingDirection: "rtl",
  },
  value: {
    color: homeTheme.text,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "right",
    writingDirection: "rtl",
  },
  out: {
    marginTop: 24,
    alignSelf: "stretch",
    paddingVertical: 14,
    borderRadius: homeTheme.radiusMd,
    borderWidth: 1,
    borderColor: homeTheme.border,
    alignItems: "center",
    backgroundColor: homeTheme.surface,
  },
  outText: { color: homeTheme.danger, fontWeight: "700", fontSize: 15 },
});
