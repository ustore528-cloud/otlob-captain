import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  captainRadius,
  captainSpacing,
  captainTypography,
  captainUiTheme,
} from "@/theme/captain-ui-theme";
import { ScreenContainer } from "@/components/ui/screen-container";
import { WorkStatusBanner } from "@/features/work-status";
import { useCaptainAssignmentWorkbench } from "@/features/assignment/hooks/use-captain-assignment-workbench";
import { AssignmentEmptyState } from "@/features/assignment/components/assignment-empty-state";
import { useAndroidOrdersTabBackConfirm } from "@/hooks/use-android-orders-tab-back-confirm";

/** Orders tab: current orders as returned by backend policy. */
export function OrdersLiveScreen() {
  const { t } = useTranslation();
  useAndroidOrdersTabBackConfirm();
  const {
    orders,
    renderOrderCard,
    isLoading,
    isError,
    errorMessage,
    retryLoadAssignment,
    refreshing,
    onRefresh,
  } = useCaptainAssignmentWorkbench();

  const refresh = useCallback(async () => {
    await onRefresh();
  }, [onRefresh]);

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <WorkStatusBanner />
      <View style={styles.accentBar} />
      <View style={styles.main}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void refresh()}
              tintColor={captainUiTheme.accent}
            />
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>{t("ordersLive.title")}</Text>
          <Text style={styles.sub}>{t("ordersLive.sub")}</Text>

          <View style={styles.assignmentBlock}>
            {isLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={captainUiTheme.accent} />
                <Text style={styles.muted}>{t("common.loading")}</Text>
              </View>
            ) : null}

            {isError && errorMessage ? (
              <View style={styles.inlineError}>
                <Text style={styles.inlineErrorText}>{errorMessage}</Text>
                <Pressable onPress={retryLoadAssignment} style={styles.inlineRetry}>
                  <Text style={styles.inlineRetryText}>{t("common.retry")}</Text>
                </Pressable>
              </View>
            ) : null}

            {!isLoading && !isError ? (
              orders.length > 0 ? (
                <View style={styles.cardsStack}>{orders.map((item) => renderOrderCard(item))}</View>
              ) : (
                <AssignmentEmptyState />
              )
            ) : null}
          </View>
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  accentBar: {
    height: captainSpacing.xs,
    marginHorizontal: captainSpacing.lg,
    borderRadius: captainRadius.sm,
    backgroundColor: captainUiTheme.accentSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: captainUiTheme.borderStrong,
  },
  main: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: captainSpacing.screenHorizontal,
    paddingTop: captainSpacing.sm,
    paddingBottom: captainSpacing.xl,
  },
  title: {
    ...captainTypography.sectionTitle,
    color: captainUiTheme.text,
    textAlign: "right",
    marginBottom: captainSpacing.xs,
  },
  sub: {
    ...captainTypography.caption,
    fontWeight: "500",
    color: captainUiTheme.textSubtle,
    lineHeight: 18,
    textAlign: "right",
    marginBottom: captainSpacing.md,
  },
  assignmentBlock: {
    gap: captainSpacing.sm + 2,
  },
  cardsStack: {
    gap: captainSpacing.md,
  },
  loadingRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: captainSpacing.sm + 2,
    paddingVertical: captainSpacing.sm,
  },
  muted: {
    color: captainUiTheme.textMuted,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: captainTypography.body.fontWeight,
  },
  inlineError: {
    paddingVertical: captainSpacing.sm,
    gap: captainSpacing.sm,
    alignItems: "flex-end",
  },
  inlineErrorText: {
    color: captainUiTheme.dangerText,
    fontSize: 13,
    fontWeight: captainTypography.body.fontWeight,
    textAlign: "right",
    lineHeight: 20,
  },
  inlineRetry: {
    paddingVertical: captainSpacing.xs,
  },
  inlineRetryText: {
    ...captainTypography.body,
    fontSize: 14,
    fontWeight: "800",
    color: captainUiTheme.accent,
  },
});
