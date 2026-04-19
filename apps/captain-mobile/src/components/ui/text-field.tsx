import type { ReactNode } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { homeTheme } from "@/features/home/theme";

type Props = TextInputProps & {
  label: string;
  error?: string | null;
  rightAccessory?: ReactNode;
};

export function TextField({ label, error, rightAccessory, style, ...rest }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <TextInput
          placeholderTextColor={homeTheme.textSubtle}
          style={[styles.input, style]}
          textAlign="right"
          {...rest}
        />
        {rightAccessory ? <View style={styles.acc}>{rightAccessory}</View> : null}
      </View>
      {error ? <Text style={styles.err}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: {
    color: homeTheme.textMuted,
    fontSize: 13,
    marginBottom: 8,
    textAlign: "right",
    writingDirection: "rtl",
  },
  row: { position: "relative" },
  input: {
    borderWidth: 1,
    borderColor: homeTheme.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: homeTheme.text,
    backgroundColor: homeTheme.inputBg,
  },
  acc: {
    position: "absolute",
    left: 12,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  err: {
    marginTop: 6,
    color: homeTheme.dangerText,
    fontSize: 12,
    textAlign: "right",
    writingDirection: "rtl",
  },
});
