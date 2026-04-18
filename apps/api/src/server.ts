import http from "http";
import { env } from "./config/env.js";
import { app } from "./app.js";
import { attachSocketIo } from "./realtime/socket-server.js";
import { distributionService } from "./services/distribution/index.js";

const httpServer = http.createServer(app);

attachSocketIo(httpServer);

setInterval(() => {
  void distributionService.tickExpired();
}, env.DISTRIBUTION_POLL_MS);

const HOST = "0.0.0.0";

httpServer.listen(env.PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://${HOST}:${env.PORT} (reachable on LAN for device QA)`);
});