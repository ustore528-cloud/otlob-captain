import Ionicons from "@expo/vector-icons/Ionicons";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { openWhatsAppChat } from "@/lib/open-external";

const WA_GREEN = "#25D366";
const WA_ON = "#FFFFFF";

type Props = {
  phone: string;
  /** Icon-only: large tap target; pill: icon + label (detail / hero rows) */
  variant?: "icon" | "pill";
  /** Default icon 20px; large 22px with bigger hit area */
  size?: "default" | "large";
  accessibilityHint?: string;
};

/**
 * High-contrast WhatsApp CTA — easier to see and tap than a bare glyph.
 */
export function WhatsAppActionButton({
  phone,
  variant = "icon",
  size = "default",
  accessibilityHint,
}: Props) {
  const isPill = variant === "pill";
  const large = size === "large";

  return (
    <Pressable
      onPress={() => void openWhatsAppChat(phone)}
      style={({ pressed }) => [
        styles.base,
        isPill ? styles.pill : large ? styles.iconOnlyLarge : styles.iconOnly,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`واتساب ${phone}`}
      accessibilityHint={accessibilityHint}
      hitSlop={isPill ? 6 : large ? 12 : 10}
    >
      <View style={styles.inner}>
        <Ionicons name="logo-whatsapp" size={isPill ? 18 : large ? 22 : 20} color={WA_ON} />
        {isPill ? (
          <Text style={styles.pillLabel} numberOfLines={1}>
            واتساب
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: "center",
    borderRadius: 12,
    backgroundColor: WA_GREEN,
  },
  iconOnly: {
    minWidth: 38,
    minHeight: 38,
    paddingHorizontal: 7,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.22,
        shadowRadius: 3,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  iconOnlyLarge: {
    minWidth: 42,
    minHeight: 42,
    paddingHorizontal: 8,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.24,
        shadowRadius: 4,
      },
      android: { elevation: 5 },
      default: {},
    }),
  },
  pill: {
    paddingVertical: 7,
    paddingHorizontal: 11,
    minHeight: 38,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  inner: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  pillLabel: {
    color: WA_ON,
    fontWeight: "900",
    fontSize: 15,
  },
  pressed: { opacity: 0.88 },
});
