import { Redirect } from "expo-router";

/** فتح مجموعة التبويبات يوجّه مباشرةً إلى «الطلبات المتاحة» */
export default function TabsIndexRedirect() {
  return <Redirect href="/(app)/(tabs)/orders" />;
}
