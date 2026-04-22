import { Suspense, lazy } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { RequireGuest } from "@/components/require-guest";
import { DashboardLayout } from "@/layouts/dashboard-layout";
import { CaptainsPage } from "@/pages/captains-page";
import { IncubatorHostPage } from "@/pages/incubator-host-page";
import { LoginPage } from "@/pages/login-page";
import { NewOrderPage } from "@/pages/new-order-page";
import {
  captainsLoader,
  distributionLoader,
  homeLoader,
  incubatorHostLoader,
  newOrderLoader,
  ordersLoader,
  usersLoader,
} from "@/router/loaders";

const HomePageLazy = lazy(() => import("@/pages/home-page").then((m) => ({ default: m.HomePage })));
const DistributionPageLazy = lazy(() =>
  import("@/pages/distribution-page").then((m) => ({ default: m.DistributionPage })),
);
const OrdersPageLazy = lazy(() => import("@/pages/orders-page").then((m) => ({ default: m.OrdersPage })));
const UsersPageLazy = lazy(() => import("@/pages/users-page").then((m) => ({ default: m.UsersPage })));

function RouteSectionSkeleton() {
  return <div className="h-24 animate-pulse rounded-2xl border border-card-border bg-card/60" aria-hidden="true" />;
}

export const router = createBrowserRouter([
  {
    path: "/login",
    element: (
      <RequireGuest>
        <LoginPage />
      </RequireGuest>
    ),
  },
  {
    path: "/",
    element: <DashboardLayout />,
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<RouteSectionSkeleton />}>
            <HomePageLazy />
          </Suspense>
        ),
        loader: homeLoader,
      },
      { path: "orders/new", element: <NewOrderPage />, loader: newOrderLoader },
      {
        path: "distribution",
        element: (
          <Suspense fallback={<RouteSectionSkeleton />}>
            <DistributionPageLazy />
          </Suspense>
        ),
        loader: distributionLoader,
      },
      { path: "incubator-host", element: <IncubatorHostPage />, loader: incubatorHostLoader },
      {
        path: "orders",
        element: (
          <Suspense fallback={<RouteSectionSkeleton />}>
            <OrdersPageLazy />
          </Suspense>
        ),
        loader: ordersLoader,
      },
      { path: "captains", element: <CaptainsPage />, loader: captainsLoader },
      {
        path: "users",
        element: (
          <Suspense fallback={<RouteSectionSkeleton />}>
            <UsersPageLazy />
          </Suspense>
        ),
        loader: usersLoader,
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
