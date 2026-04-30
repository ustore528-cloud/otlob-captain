import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { Platform, StyleSheet, type ViewStyle } from "react-native";
import { OrdersTabBarLabel } from "@/components/navigation/orders-tab-label";
import {
  captainRadius,
  captainSpacing,
  captainTypography,
  captainUiTheme,
} from "@/theme/captain-ui-theme";

const TAB_ICON_FOCUS_BUMP = 1;

export default function TabsLayout() {
  const { t } = useTranslation();
  return (
    <Tabs
      initialRouteName="orders"
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: captainUiTheme.pageBackground },
        tabBarActiveTintColor: captainUiTheme.tabBarActive,
        tabBarInactiveTintColor: captainUiTheme.tabBarInactive,
        tabBarStyle: {
          backgroundColor: captainUiTheme.tabBarBg,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: captainUiTheme.tabBarBorder,
          borderTopLeftRadius: captainRadius.xl,
          borderTopRightRadius: captainRadius.xl,
          height: Platform.OS === "ios" ? 90 : 74,
          paddingTop: captainSpacing.tabBarPaddingTop,
          paddingHorizontal: captainSpacing.sm,
          paddingBottom: Platform.OS === "ios" ? captainSpacing.tabBarIosBottom : captainSpacing.tabBarAndroidBottom,
          ...Platform.select<ViewStyle>({
            ios: {
              ...captainUiTheme.tabBarIosShadow,
              shadowColor: captainUiTheme.cardShadow.shadowColor,
              shadowOpacity: Math.min(0.12, (captainUiTheme.cardShadow.shadowOpacity ?? 0) + 0.02),
              shadowRadius: (captainUiTheme.cardShadow.shadowRadius ?? 0) + 2,
            },
            android: {
              elevation: captainUiTheme.tabBarAndroidElevation + 2,
            },
          }),
        },
        tabBarLabelStyle: {
          ...captainTypography.tabLabel,
          marginTop: captainSpacing.xs / 2,
        },
        tabBarItemStyle: {
          paddingVertical: captainSpacing.xs / 2,
          paddingHorizontal: captainSpacing.xs / 2,
          borderRadius: captainRadius.sm,
          marginHorizontal: captainSpacing.xs / 4,
        },
      }}
    >
      <Tabs.Screen
        name="orders"
        options={{
          title: t("tabs.currentOrder"),
          tabBarLabel: ({ color, focused }) => <OrdersTabBarLabel color={color} focused={focused} />,
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={focused ? "file-tray-stacked" : "file-tray-stacked-outline"}
              color={color}
              size={focused ? size + TAB_ICON_FOCUS_BUMP : size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="archive"
        options={{
          title: t("tabs.archive"),
          tabBarLabel: t("tabs.archive"),
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={focused ? "archive" : "archive-outline"}
              color={color}
              size={focused ? size + TAB_ICON_FOCUS_BUMP : size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: t("tabs.notifications"),
          tabBarLabel: t("tabs.notifications"),
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={focused ? "notifications" : "notifications-outline"}
              color={color}
              size={focused ? size + TAB_ICON_FOCUS_BUMP : size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tabs.settings"),
          tabBarLabel: t("tabs.settings"),
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={focused ? "settings" : "settings-outline"}
              color={color}
              size={focused ? size + TAB_ICON_FOCUS_BUMP : size}
            />
          ),
        }}
      />

      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="home" options={{ href: null }} />
      <Tabs.Screen name="assignment" options={{ href: null }} />
      <Tabs.Screen name="earnings" options={{ href: null }} />
      <Tabs.Screen name="tracking" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}
