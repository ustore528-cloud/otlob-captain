import http from "http";
import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { attachSocketIo } from "./realtime/socket-server.js";
import { distributionService } from "./services/distribution/index.js";

const app = createApp();
const httpServer = http.createServer(app);

attachSocketIo(httpServer);

setInterval(() => {
  void distributionService.tickExpired();
}, env.DISTRIBUTION_POLL_MS);

httpServer.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${env.PORT}`);
});
