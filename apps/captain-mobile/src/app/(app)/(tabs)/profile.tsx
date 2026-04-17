import { useMemo, useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  AvailabilityControl,
  availabilityLabel,
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
  const { user, captain, signOut, isAuthenticated } = useAuth();
  const meQuery = useCaptainMe({ enabled: isAuthenticated, staleTime: 20_000 });
  const updateAv = useUpdateAvailability();

  const currentAvailability: CaptainAvailabilityStatus = useMemo(() => {
    const raw = meQuery.data?.captain.availabilityStatus ?? captain?.availabilityStatus;
    return parseAvailabilityStatus(raw ?? "") ?? "OFFLINE";
  }, [meQuery.data?.captain.availabilityStatus, captain?.availabilityStatus]);

  const onAvailability = useCallback(
    (next: CaptainAvailabilityStatus) => {
      updateAv.mutate(next, {
        onError: (e) => alertMutationError("تعذّر التحديث", e, "حاول مرة أخرى."),
      });
    },
    [updateAv],
  );

  return (
    <SafeAreaView style={screenStyles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.screenTitle}>حسابي</Text>
        <Text style={styles.screenSub}>بياناتك وحالة التوفر</Text>

        <View style={styles.card}>
          <Row label="الاسم" value={user?.fullName ?? "—"} />
          <Row label="الجوال" value={user?.phone ?? "—"} />
          <Row label="البريد" value={user?.email ?? "—"} />
          <Row label="المنطقة" value={captain?.area ?? "—"} />
          <Row label="التوفر الحالي" value={availabilityLabel[currentAvailability]} />
        </View>

        <View style={{ height: 16 }} />

        <AvailabilityControl
          value={currentAvailability}
          pending={updateAv.isPending}
          onChange={onAvailability}
          title="تغيير حالة التوفر"
          subtitle="نفس الإعدادات كما في لوحة الكابتن — تُحدَّث فورًا"
          compact
        />

        <Pressable
          style={styles.out}
          onPress={() => {
            void signOut();
          }}
        >
          <Text style={styles.outText}>تسجيل الخروج</Text>
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
  scroll: { paddingHorizontal: 20, paddingBottom: 32, paddingTop: 8 },
  screenTitle: {
    color: homeTheme.text,
    fontSize: 24,
    fontWeight: "900",
    textAlign: "right",
  },
  screenSub: {
    color: homeTheme.textSubtle,
    fontSize: 14,
    textAlign: "right",
    marginTop: 6,
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
