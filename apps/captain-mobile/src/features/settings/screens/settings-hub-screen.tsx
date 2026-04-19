import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter, type Href } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/screen-header";
import { WorkStatusBanner } from "@/features/work-status";
import { homeTheme } from "@/features/home/theme";
import { screenStyles } from "@/theme/screen-styles";

type Row = {
  href?: Href;
  label: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** صف غير تفاعلي — قريبًا */
  disabled?: boolean;
};

function SettingsSection({ title, rows }: { title: string; rows: Row[] }) {
  const router = useRouter();

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>
        {rows.map((row, i) => (
          <Pressable
            key={row.label}
            disabled={row.disabled || !row.href}
            style={({ pressed }) => [
              styles.row,
              i < rows.length - 1 && styles.rowBorder,
              pressed && row.href && !row.disabled && styles.rowPressed,
              row.disabled && styles.rowDisabled,
            ]}
            onPress={() => row.href && !row.disabled && router.push(row.href)}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={row.disabled ? homeTheme.textSubtle : homeTheme.textSubtle}
            />
            <View style={styles.rowText}>
              <Text style={[styles.rowLabel, row.disabled && styles.rowLabelMuted]}>{row.label}</Text>
              <Text style={styles.rowHint}>{row.hint}</Text>
            </View>
            <View style={[styles.iconBubble, row.disabled && styles.iconBubbleMuted]}>
              <Ionicons name={row.icon} size={22} color={row.disabled ? homeTheme.textSubtle : homeTheme.accent} />
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const ACCOUNT_ROWS: Row[] = [
  {
    href: "/(app)/(tabs)/profile" as Href,
    label: "الملف الشخصي",
    hint: "الاسم، الجهة، المنطقة",
    icon: "person-outline",
  },
  {
    href: "/(app)/(tabs)/profile" as Href,
    label: "حالة التوفر",
    hint: "متاح، مشغول، خارج الخدمة — من نفس شاشة الحساب",
    icon: "radio-button-on-outline",
  },
  {
    href: "/(app)/(tabs)/profile" as Href,
    label: "تسجيل الخروج",
    hint: "من أسفل شاشة الملف الشخصي",
    icon: "log-out-outline",
  },
];

const TOOLS_ROWS: Row[] = [
  {
    href: "/(app)/(tabs)/earnings" as Href,
    label: "الأرباح",
    hint: "ملخص التحصيل",
    icon: "wallet-outline",
  },
  {
    href: "/(app)/(tabs)/tracking" as Href,
    label: "تتبع الموقع",
    hint: "إذن الموقع وإرسال الإحداثيات",
    icon: "navigate-outline",
  },
];

const APP_ROWS: Row[] = [
  {
    disabled: true,
    label: "اللغة",
    hint: "قريبًا — العربية افتراضيًا",
    icon: "language-outline",
  },
  {
    disabled: true,
    label: "تنبيهات التطبيق",
    hint: "قريبًا — تفضيلات الصوت والظهور",
    icon: "notifications-outline",
  },
];

const EXTRA_ROWS: Row[] = [
  {
    href: "/(app)/(tabs)/home" as Href,
    label: "لوحة سريعة",
    hint: "ملخص الحالة وآخر تنبيه — اختياري",
    icon: "home-outline",
  },
];

export function SettingsHubScreen() {
  return (
    <SafeAreaView style={screenStyles.safe} edges={["top", "left", "right"]}>
      <WorkStatusBanner />
      <ScreenHeader title="الإعدادات" />
      <ScrollView style={styles.scrollFlex} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sub}>كل ما هو خارج تنفيذ الطلبات المباشر: حساب، أدوات، وتفضيلات</Text>

        <SettingsSection title="الحساب" rows={ACCOUNT_ROWS} />
        <SettingsSection title="أدوات" rows={TOOLS_ROWS} />
        <SettingsSection title="التطبيق" rows={APP_ROWS} />
        <SettingsSection title="إضافي" rows={EXTRA_ROWS} />

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollFlex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 32, paddingTop: 8 },
  sub: {
    color: homeTheme.textSubtle,
    fontSize: 14,
    textAlign: "right",
    marginBottom: 20,
    lineHeight: 22,
  },
  section: { marginBottom: 18 },
  sectionTitle: {
    color: homeTheme.textMuted,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: 8,
  },
  card: {
    backgroundColor: homeTheme.surfaceElevated,
    borderRadius: homeTheme.radiusLg,
    borderWidth: 1,
    borderColor: homeTheme.border,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: homeTheme.border,
  },
  rowPressed: { opacity: 0.92 },
  rowDisabled: { opacity: 0.75 },
  rowText: { flex: 1, alignItems: "flex-end" },
  rowLabel: {
    color: homeTheme.text,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "right",
  },
  rowLabelMuted: {
    color: homeTheme.textMuted,
  },
  rowHint: {
    color: homeTheme.textSubtle,
    fontSize: 12,
    textAlign: "right",
    marginTop: 2,
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: homeTheme.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBubbleMuted: {
    backgroundColor: homeTheme.neutralSoft,
  },
});
