import Ionicons from "@expo/vector-icons/Ionicons";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { CaptainActionResult } from "../utils/captain-order-actions";
import { homeTheme } from "@/features/home/theme";

type Props = {
  actions: CaptainActionResult;
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
  onAdvance: () => void;
};

export function AssignmentActionsBar({ actions, busy, onAccept, onReject, onAdvance }: Props) {
  if (actions.mode === "none" && !actions.readOnly) {
    return null;
  }

  if (actions.mode === "none" && actions.readOnly) {
    return (
      <View style={styles.readOnly}>
        <Text style={styles.readOnlyText}>لا تتوفر إجراءات على هذا الطلب في وضعك الحالي.</Text>
      </View>
    );
  }

  if (actions.mode === "offer") {
    return (
      <View style={styles.col}>
        <Pressable
          style={({ pressed }) => [styles.btnPrimary, pressed && styles.pressed, busy && styles.disabled]}
          onPress={onAccept}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#0f172a" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={22} color="#0f172a" />
              <Text style={styles.btnPrimaryText}>قبول الطلب</Text>
            </>
          )}
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.btnDanger, pressed && styles.pressed, busy && styles.disabled]}
          onPress={onReject}
          disabled={busy}
        >
          <Ionicons name="close-circle-outline" size={22} color="#fecaca" />
          <Text style={styles.btnDangerText}>رفض العرض</Text>
        </Pressable>
      </View>
    );
  }

  if (actions.mode === "active_patch") {
    return (
      <Pressable
        style={({ pressed }) => [styles.btnPrimary, pressed && styles.pressed, busy && styles.disabled]}
        onPress={onAdvance}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color="#0f172a" />
        ) : (
          <>
            <Ionicons name="arrow-forward-circle-outline" size={22} color="#0f172a" />
            <Text style={styles.btnPrimaryText}>{actions.labelAr}</Text>
          </>
        )}
      </Pressable>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  col: { gap: 12 },
  readOnly: {
    padding: 14,
    borderRadius: homeTheme.radiusMd,
    backgroundColor: "rgba(148, 163, 184, 0.08)",
    borderWidth: 1,
    borderColor: homeTheme.border,
  },
  readOnlyText: {
    color: homeTheme.textMuted,
    fontSize: 14,
    textAlign: "right",
    lineHeight: 22,
  },
  btnPrimary: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: homeTheme.accent,
    paddingVertical: 16,
    borderRadius: homeTheme.radiusMd,
    minHeight: 54,
  },
  btnDanger: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "rgba(248, 113, 113, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.45)",
    paddingVertical: 16,
    borderRadius: homeTheme.radiusMd,
    minHeight: 54,
  },
  pressed: { opacity: 0.9 },
  disabled: { opacity: 0.6 },
  btnPrimaryText: { color: "#0f172a", fontSize: 16, fontWeight: "900" },
  btnDangerText: { color: "#fecaca", fontSize: 16, fontWeight: "800" },
});
