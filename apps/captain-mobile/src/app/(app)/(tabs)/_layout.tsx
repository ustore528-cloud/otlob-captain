import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { Platform, StyleSheet } from "react-native";
import { OrdersTabBarLabel } from "@/components/navigation/orders-tab-label";
import { homeTheme } from "@/features/home/theme";

const TAB_ICON_FOCUS_BUMP = 1;

export default function TabsLayout() {
  const { t } = useTranslation();
  return (
    <Tabs
      initialRouteName="orders"
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: homeTheme.pageBackground },
        tabBarActiveTintColor: homeTheme.tabBarActive,
        tabBarInactiveTintColor: homeTheme.tabBarInactive,
        tabBarStyle: {
          backgroundColor: homeTheme.tabBarBg,
          borderTopColor: homeTheme.tabBarBorder,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: Platform.OS === "ios" ? 88 : 72,
          paddingTop: 6,
          paddingBottom: Platform.OS === "ios" ? 28 : 10,
          ...Platform.select({
            ios: {
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.07,
              shadowRadius: 8,
            },
            android: { elevation: 6 },
          }),
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600", marginTop: 2 },
        tabBarItemStyle: { paddingVertical: 2 },
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
