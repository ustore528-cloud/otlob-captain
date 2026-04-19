import http from "http";
import { env } from "./config/env.js";
import { app } from "./app.js";
import { attachSocketIo } from "./realtime/socket-server.js";
import { distributionService } from "./services/distribution/index.js";

const httpServer = http.createServer(app);

attachSocketIo(httpServer);

/** يمنع تداخل دورات `tickExpired` في **نفس العملية** إذا تأخرت قاعدة البيانات — لا يحل تعدد نسخ API. */
let distributionTickInFlight = false;

setInterval(() => {
  if (distributionTickInFlight) {
    // eslint-disable-next-line no-console
    console.warn("[Distribution] tickExpired skipped: previous tick still in flight");
    return;
  }
  distributionTickInFlight = true;
  void distributionService
    .tickExpired()
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[Distribution] tickExpired", err);
    })
    .finally(() => {
      distributionTickInFlight = false;
    });
}, env.DISTRIBUTION_POLL_MS);

const HOST = "0.0.0.0";

httpServer.listen(env.PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://${HOST}:${env.PORT} (reachable on LAN for device QA)`);
});