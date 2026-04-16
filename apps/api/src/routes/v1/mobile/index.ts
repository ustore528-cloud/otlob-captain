import { Router } from "express";
import { captainMobileRoutes } from "./captain-mobile.routes.js";

const mobileRouter = Router();
mobileRouter.use("/captain", captainMobileRoutes);

export { mobileRouter as mobileRoutes };
