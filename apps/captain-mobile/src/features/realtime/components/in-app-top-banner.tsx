import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { homeTheme } from "@/features/home/theme";
import { useInAppTopBannerStore } from "@/store/in-app-top-banner-store";

const AUTO_DISMISS_MS = 7_000;

export function InAppTopBanner() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const current = useInAppTopBannerStore((s) => s.current);
  const dismissBanner = useInAppTopBannerStore((s) => s.dismissBanner);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-14)).current;

  useEffect(() => {
    if (!current) return;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();

    const t = setTimeout(() => {
      dismissBanner(current.id);
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [current, dismissBanner, opacity, translateY]);

  useEffect(() => {
    if (current) return;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -14, duration: 140, useNativeDriver: true }),
    ]).start();
  }, [current, opacity, translateY]);

  if (!current) return null;

  const iconName =
    current.kind === "order"
      ? "notifications-outline"
      : current.kind === "alert"
        ? "warning-outline"
        : "information-circle-outline";
  const top = Math.max(insets.top, 10) + 6;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.overlay,
          {
            top,
            opacity,
            transform: [{ translateY }],
          },
        ]}
        pointerEvents="box-none"
      >
        <View style={styles.card} pointerEvents="auto">
          <View style={styles.row}>
            <View style={styles.iconWrap}>
              <Ionicons name={iconName} size={16} color={homeTheme.accent} />
            </View>
            <View style={styles.textCol}>
              <Text style={styles.title} numberOfLines={1}>
                {current.title}
              </Text>
              <Text style={styles.message} numberOfLines={2}>
                {current.message}
              </Text>
            </View>
            <Pressable
              onPress={() => dismissBanner(current.id)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("realtime.dismissBannerA11y")}
              style={({ pressed }) => [styles.dismiss, pressed && styles.pressed]}
            >
              <Ionicons name="close" size={16} color={homeTheme.textSubtle} />
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 10,
    right: 10,
    zIndex: 60,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: homeTheme.border,
    backgroundColor: homeTheme.cardWhite,
    paddingHorizontal: 10,
    paddingVertical: 9,
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FDEBEC",
  },
  textCol: {
    flex: 1,
    alignItems: "flex-end",
    minWidth: 0,
  },
  title: {
    color: homeTheme.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    textAlign: "right",
  },
  message: {
    marginTop: 1,
    color: homeTheme.textMuted,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "right",
  },
  dismiss: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: homeTheme.neutralSoft,
  },
  pressed: { opacity: 0.85 },
});
