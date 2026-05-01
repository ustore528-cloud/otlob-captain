import { Outlet } from "react-router-dom";
import { CustomerPushRegistrar } from "@/components/customer-push-registrar";

export function RootAppShell() {
  return (
    <>
      <CustomerPushRegistrar />
      <Outlet />
    </>
  );
}
