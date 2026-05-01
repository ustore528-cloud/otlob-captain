import type { ViewStyle } from "react-native";

/** Typical tablet / large fold breakpoint — phone layouts stay unchanged below this width. */
export const CAPTAIN_TABLET_MIN_WIDTH = 768;

/** Centered content column on large screens (e.g. 13\" tablets). */
export const CAPTAIN_MAX_CONTENT_WIDTH = 720;

export const captainWideContentStyle: ViewStyle = {
  maxWidth: CAPTAIN_MAX_CONTENT_WIDTH,
  width: "100%",
  alignSelf: "center",
};
