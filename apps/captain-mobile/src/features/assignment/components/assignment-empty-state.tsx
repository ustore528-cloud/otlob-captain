import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";
import { homeTheme } from "@/features/home/theme";

export function AssignmentEmptyState() {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconCircle}>
        <Ionicons name="cube-outline" size={48} color={homeTheme.textSubtle} />
      </View>
      <Text style={styles.title}>لا يوجد طلب حالي</Text>
      <Text style={styles.body}>
        عند وصول عرض جديد أو قبول طلب، ستظهر التفاصيل هنا تلقائيًا. يمكنك أيضًا فتح طلب من إشعار أو رابط
        مباشر.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 12,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 32,
    backgroundColor: "rgba(148, 163, 184, 0.08)",
    borderWidth: 1,
    borderColor: homeTheme.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    color: homeTheme.text,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 10,
  },
  body: {
    color: homeTheme.textMuted,
    fontSize: 14,
    lineHeight: 24,
    textAlign: "center",
  },
});
