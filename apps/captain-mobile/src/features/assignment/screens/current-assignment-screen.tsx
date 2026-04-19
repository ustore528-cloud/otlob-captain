import { useCallback } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { homeTheme } from "@/features/home/theme";
import { screenStyles } from "@/theme/screen-styles";
import { WorkStatusBanner } from "@/features/work-status";
import { useCaptainAssignmentWorkbench } from "../hooks/use-captain-assignment-workbench";

export function CurrentAssignmentScreen() {
  const { bodyContent, dock, refreshing, onRefresh } = useCaptainAssignmentWorkbench();

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
          <Text style={styles.title}>الطلب الحالي</Text>
          <Text style={styles.sub}>التعيين النشط من الخادم — يتبع دورة حياة الطلب</Text>
          {bodyContent}
        </ScrollView>
        {dock}
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
    marginBottom: 4,
  },
  sub: {
    color: homeTheme.textSubtle,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "right",
    marginBottom: 12,
  },
});
