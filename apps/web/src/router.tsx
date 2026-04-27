import { Suspense, lazy } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { RequireGuest } from "@/components/require-guest";
import { DashboardLayout } from "@/layouts/dashboard-layout";
import { CaptainsPage } from "@/pages/captains-page";
import { StoresPage } from "@/pages/stores-page";
import { IncubatorHostPage } from "@/pages/incubator-host-page";
import { LoginPage } from "@/pages/login-page";
import { PublicRequestPage } from "@/pages/public-request-page";
import { NewOrderPage } from "@/pages/new-order-page";
import {
  captainsLoader,
  storesLoader,
  distributionLoader,
  homeLoader,
  incubatorHostLoader,
  newOrderLoader,
  ordersLoader,
  reportsLoader,
  usersLoader,
} from "@/router/loaders";

const HomePageLazy = lazy(() => import("@/pages/home-page").then((m) => ({ default: m.HomePage })));
const FinancePageLazy = lazy(() => import("@/pages/finance-page").then((m) => ({ default: m.FinancePage })));
const ReportsPageLazy = lazy(() => import("@/pages/reports-page").then((m) => ({ default: m.ReportsPage })));
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
    path: "/request/:ownerCode",
    element: <PublicRequestPage />,
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
      { path: "stores", element: <StoresPage />, loader: storesLoader },
      {
        path: "users",
        element: (
          <Suspense fallback={<RouteSectionSkeleton />}>
            <UsersPageLazy />
          </Suspense>
        ),
        loader: usersLoader,
      },
      {
        path: "finance",
        element: (
          <Suspense fallback={<RouteSectionSkeleton />}>
            <FinancePageLazy />
          </Suspense>
        ),
      },
      {
        path: "reports",
        element: (
          <Suspense fallback={<RouteSectionSkeleton />}>
            <ReportsPageLazy />
          </Suspense>
        ),
        loader: reportsLoader,
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
