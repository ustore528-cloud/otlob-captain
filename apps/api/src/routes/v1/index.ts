import { Router } from "express";
import { authRoutes } from "./auth.routes.js";
import { usersRoutes } from "./users.routes.js";
import { storesRoutes } from "./stores.routes.js";
import { captainsRoutes } from "./captains.routes.js";
import { ordersRoutes } from "./orders.routes.js";
import { trackingRoutes } from "./tracking.routes.js";
import { notificationsRoutes } from "./notifications.routes.js";
import { activityRoutes } from "./activity.routes.js";
import { dashboardSettingsRoutes } from "./dashboard-settings.routes.js";
import { geocodeRoutes } from "./geocode.routes.js";
import { mobileRoutes } from "./mobile/index.js";

const v1Router = Router();

v1Router.use("/auth", authRoutes);
v1Router.use("/users", usersRoutes);
v1Router.use("/stores", storesRoutes);
v1Router.use("/captains", captainsRoutes);
v1Router.use("/orders", ordersRoutes);
v1Router.use("/tracking", trackingRoutes);
v1Router.use("/notifications", notificationsRoutes);
v1Router.use("/activity", activityRoutes);
v1Router.use("/dashboard-settings", dashboardSettingsRoutes);
v1Router.use("/geocode", geocodeRoutes);
v1Router.use("/mobile", mobileRoutes);

export { v1Router };
