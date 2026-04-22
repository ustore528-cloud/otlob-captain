import { useCallback } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { homeTheme } from "@/features/home/theme";
import { screenStyles } from "@/theme/screen-styles";
import { WorkStatusBanner } from "@/features/work-status";
import { useCaptainAssignmentWorkbench } from "../hooks/use-captain-assignment-workbench";
import { AssignmentEmptyState } from "../components/assignment-empty-state";

/** Hidden tab route: renders current orders from backend assignment + overflow snapshot. */
export function CurrentAssignmentScreen() {
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
    <SafeAreaView style={screenStyles.safe} edges={["top", "left", "right"]}>
      <WorkStatusBanner />
      <View style={styles.accentBar} />
      <View style={styles.main}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={homeTheme.accent} />
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>الطلبات الحالية</Text>
          <Text style={styles.sub}>تعرض الشاشة الطلبات الحالية كما يعيدها الخادم، وكل طلب في بطاقة مستقلة.</Text>
          <View style={styles.assignmentBlock}>
            {isLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={homeTheme.accent} />
                <Text style={styles.muted}>Loading…</Text>
              </View>
            ) : null}

            {isError && errorMessage ? (
              <View style={styles.inlineError}>
                <Text style={styles.inlineErrorText}>{errorMessage}</Text>
                <Pressable onPress={retryLoadAssignment} style={styles.inlineRetry}>
                  <Text style={styles.inlineRetryText}>Retry</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  accentBar: {
    height: 3,
    marginHorizontal: 16,
    borderRadius: 3,
    backgroundColor: homeTheme.accent,
    opacity: 0.35,
  },
  main: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12 },
  title: {
    color: homeTheme.text,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "right",
    marginBottom: 6,
  },
  sub: {
    color: homeTheme.textSubtle,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "right",
    marginBottom: 14,
  },
  assignmentBlock: {
    gap: 10,
  },
  cardsStack: {
    gap: 12,
  },
  loadingRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    paddingVertical: 8,
  },
  muted: { color: homeTheme.textMuted, fontSize: 13 },
  inlineError: {
    paddingVertical: 8,
    gap: 8,
    alignItems: "flex-end",
  },
  inlineErrorText: {
    color: homeTheme.dangerText,
    fontSize: 13,
    textAlign: "right",
    lineHeight: 20,
  },
  inlineRetry: {
    paddingVertical: 4,
  },
  inlineRetryText: {
    color: homeTheme.accent,
    fontWeight: "800",
    fontSize: 14,
  },
});
