import { Image, StyleSheet, Text, View } from "react-native";
import { homeTheme } from "@/features/home/theme";

/** Centered motivational waiting state while polling continues in background. */
export function AssignmentEmptyState() {
  return (
    <View style={styles.wrap}>
      <Image source={require("../../../../assets/captain-waiting.png")} style={styles.heroImage} resizeMode="contain" />
      <Text style={styles.line}>خذ لك دقيقة راحة، رزقك بالطريق</Text>
      <Text style={styles.sub}>جاهزين نعرض أول طلب جديد لحظة وصوله</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 320,
    paddingHorizontal: 18,
    paddingVertical: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  heroImage: {
    width: "100%",
    maxWidth: 340,
    height: 190,
    marginBottom: 16,
  },
  line: {
    color: homeTheme.text,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 34,
  },
  sub: {
    marginTop: 10,
    color: homeTheme.textSubtle,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
});
