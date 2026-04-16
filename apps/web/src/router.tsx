import { createBrowserRouter, Navigate } from "react-router-dom";
import { RequireGuest } from "@/components/require-guest";
import { DashboardLayout } from "@/layouts/dashboard-layout";
import { CaptainsPage } from "@/pages/captains-page";
import { DistributionPage } from "@/pages/distribution-page";
import { HomePage } from "@/pages/home-page";
import { LoginPage } from "@/pages/login-page";
import { NewOrderPage } from "@/pages/new-order-page";
import { OrdersPage } from "@/pages/orders-page";
import { UsersPage } from "@/pages/users-page";
import {
  captainsLoader,
  distributionLoader,
  homeLoader,
  newOrderLoader,
  ordersLoader,
  usersLoader,
} from "@/router/loaders";

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
      { index: true, element: <HomePage />, loader: homeLoader },
      { path: "orders/new", element: <NewOrderPage />, loader: newOrderLoader },
      { path: "distribution", element: <DistributionPage />, loader: distributionLoader },
      { path: "orders", element: <OrdersPage />, loader: ordersLoader },
      { path: "captains", element: <CaptainsPage />, loader: captainsLoader },
      { path: "users", element: <UsersPage />, loader: usersLoader },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
