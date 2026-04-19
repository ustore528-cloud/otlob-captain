import { useCallback } from "react";
import { Alert, BackHandler, Platform } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

/**
 * On Android hardware back while the Orders tab is focused, confirm before exiting the app.
 */
export function useAndroidOrdersTabBackConfirm(): void {
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") {
        return undefined;
      }
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        Alert.alert(
          "Do you want to leave this page?",
          undefined,
          [
            { text: "Cancel", style: "cancel" },
            { text: "Leave", onPress: () => BackHandler.exitApp() },
          ],
          { cancelable: true },
        );
        return true;
      });
      return () => sub.remove();
    }, []),
  );
}
