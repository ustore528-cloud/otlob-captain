import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter, type Href } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ScreenHeader } from "@/components/screen-header";
import { ScreenContainer } from "@/components/ui/screen-container";
import { useInnerToolBack } from "@/hooks/use-inner-tool-back";
import { useAuth } from "@/hooks/use-auth";
import { isRtlLng } from "@/i18n/i18n";
import { captainSpacing, captainTypography, captainUiTheme } from "@/theme/captain-ui-theme";

export function DeleteAccountScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const goBack = useInnerToolBack();
  const { deleteAccount } = useAuth();
  const rtl = isRtlLng(i18n.resolvedLanguage ?? i18n.language);

  const [reason, setReason] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runDelete = useCallback(async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteAccount(reason.trim() || null);
      router.replace("/(auth)/login" as Href);
    } catch {
      setError(t("accountDelete.errorGeneric"));
    } finally {
      setDeleting(false);
      setModalOpen(false);
    }
  }, [deleteAccount, reason, router, t]);

  const openFinalAlert = useCallback(() => {
    Alert.alert(t("accountDelete.finalTitle"), t("accountDelete.finalMessage"), [
      { text: t("accountDelete.finalCancel"), style: "cancel" },
      {
        text: t("accountDelete.finalConfirm"),
        style: "destructive",
        onPress: () => {
          void runDelete();
        },
      },
    ]);
  }, [runDelete, t]);

  return (
    <ScreenContainer edges={["top", "left", "right"]} contentStyle={styles.flex} padded>
      <ScreenHeader title={t("accountDelete.title")} onBack={goBack} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={[styles.intro, { textAlign: rtl ? "right" : "left" }]}>{t("accountDelete.intro")}</Text>

        <Text style={[styles.label, { textAlign: rtl ? "right" : "left" }]}>{t("accountDelete.reasonLabel")}</Text>
        <TextInput
          style={[styles.input, { textAlign: rtl ? "right" : "left" }]}
          value={reason}
          onChangeText={setReason}
          placeholder={t("accountDelete.reasonPlaceholder")}
          placeholderTextColor={captainUiTheme.textMuted}
          multiline
          maxLength={2000}
          editable={!deleting}
        />

        <Pressable
          style={[styles.checkRow, rtl ? styles.checkRowRtl : styles.checkRowLtr]}
          onPress={() => {
            setUnderstood((v) => !v);
          }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: understood }}
        >
          <Ionicons
            name={understood ? "checkbox" : "square-outline"}
            size={24}
            color={understood ? captainUiTheme.danger : captainUiTheme.textSubtle}
          />
          <Text style={[styles.checkLabel, { textAlign: rtl ? "right" : "left" }]}>{t("accountDelete.understandLabel")}</Text>
        </Pressable>

        {error ? (
          <View style={styles.errBox}>
            <Text style={[styles.errText, { textAlign: rtl ? "right" : "left" }]}>{error}</Text>
          </View>
        ) : null}

        <Pressable
          style={[styles.destructiveBtn, (!understood || deleting) && styles.destructiveBtnDisabled]}
          disabled={!understood || deleting}
          onPress={() => {
            setModalOpen(true);
          }}
        >
          {deleting ? (
            <ActivityIndicator color={captainUiTheme.onAccent} />
          ) : (
            <Text style={styles.destructiveBtnText}>{t("accountDelete.openConfirm")}</Text>
          )}
        </Pressable>
      </ScrollView>

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { direction: rtl ? "rtl" : "ltr" }]}>
            <Text style={styles.modalTitle}>{t("accountDelete.modalTitle")}</Text>
            <Text style={styles.modalBody}>{t("accountDelete.modalBody")}</Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalSecondary} onPress={() => setModalOpen(false)}>
                <Text style={styles.modalSecondaryText}>{t("accountDelete.modalCancel")}</Text>
              </Pressable>
              <Pressable
                style={styles.modalPrimary}
                onPress={() => {
                  setModalOpen(false);
                  openFinalAlert();
                }}
              >
                <Text style={styles.modalPrimaryText}>{t("accountDelete.modalContinue")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingBottom: captainSpacing.xxxl, gap: captainSpacing.md },
  intro: {
    ...captainTypography.body,
    color: captainUiTheme.textSubtle,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: captainSpacing.sm,
  },
  label: {
    ...captainTypography.caption,
    color: captainUiTheme.textMuted,
    marginTop: captainSpacing.sm,
  },
  input: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: captainUiTheme.border,
    borderRadius: 12,
    padding: captainSpacing.md,
    backgroundColor: captainUiTheme.surface,
    color: captainUiTheme.text,
    fontSize: 15,
  },
  checkRow: {
    alignItems: "flex-start",
    gap: captainSpacing.sm,
    marginTop: captainSpacing.md,
  },
  checkRowLtr: { flexDirection: "row" },
  checkRowRtl: { flexDirection: "row-reverse" },
  checkLabel: {
    ...captainTypography.body,
    flex: 1,
    color: captainUiTheme.text,
    fontSize: 15,
    lineHeight: 22,
  },
  errBox: {
    backgroundColor: captainUiTheme.dangerSoft,
    borderRadius: 12,
    padding: captainSpacing.md,
    borderWidth: 1,
    borderColor: captainUiTheme.dangerBorder,
  },
  errText: { color: captainUiTheme.dangerText, fontSize: 14, lineHeight: 20 },
  destructiveBtn: {
    marginTop: captainSpacing.lg,
    backgroundColor: captainUiTheme.danger,
    paddingVertical: captainSpacing.md + 2,
    borderRadius: 14,
    alignItems: "center",
    minHeight: 52,
    justifyContent: "center",
  },
  destructiveBtnDisabled: { opacity: 0.5 },
  destructiveBtnText: {
    ...captainTypography.bodyStrong,
    color: captainUiTheme.onAccent,
    fontSize: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: captainSpacing.lg,
  },
  modalCard: {
    backgroundColor: captainUiTheme.surfaceElevated,
    borderRadius: 16,
    padding: captainSpacing.lg,
    gap: captainSpacing.md,
  },
  modalTitle: {
    ...captainTypography.cardTitle,
    fontSize: 18,
    color: captainUiTheme.text,
  },
  modalBody: {
    ...captainTypography.body,
    color: captainUiTheme.textSubtle,
    fontSize: 14,
    lineHeight: 22,
  },
  modalActions: { flexDirection: "row", flexWrap: "wrap", gap: captainSpacing.sm, marginTop: captainSpacing.md },
  modalSecondary: {
    flex: 1,
    paddingVertical: captainSpacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: captainUiTheme.border,
    alignItems: "center",
  },
  modalSecondaryText: { ...captainTypography.bodyStrong, color: captainUiTheme.text },
  modalPrimary: {
    flex: 1,
    paddingVertical: captainSpacing.md,
    borderRadius: 12,
    backgroundColor: captainUiTheme.danger,
    alignItems: "center",
  },
  modalPrimaryText: { ...captainTypography.bodyStrong, color: captainUiTheme.onAccent },
});
