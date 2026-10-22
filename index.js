const {
  express,
  cluster,
  logByte,
  cron,
} = require("./provider/dependency.map");
const {
  clusterInterceptor,
  markClusterShuttingDown,
  replicate,
  cronLayer,
} = require("./provider/interceptor.map");
const {
  host,
  port,
  SHUTDOWN_TIMEOUT,
  REPLICA,
  clustering,
  replicas,
} = require("./provider/config.map");
const { middleware, errorMiddleware } = require("./middleware.loader");
const {
  gracefulShutdown,
  registerClusterPrimaryShutdown,
  registerWorkerShutdownMessage,
  triggerGracefulShutdown,
} = require("./layers/graceful.shutdown.layer");

const [core, userService] = [
  require("./core/core"),
  require("./database/user.service"),
];
const [Res, user] = [new core(), new userService()];
const app = express();

if (clustering && cluster.isPrimary) {
  clusterInterceptor();

  registerClusterPrimaryShutdown({
    shutdownTimeout: SHUTDOWN_TIMEOUT,
    markClusterShuttingDown,
  });
} else {
  const activeRequests = new Set();

  cronLayer(cron);
  middleware(app);

  app.use((req, res, next) => {
    activeRequests.add(res);

    res.once("finish", () => {
      activeRequests.delete(res);
    });

    res.once("close", () => {
      activeRequests.delete(res);
    });

    next();
  });

  app.get("/", (_, res) => {
    res.json({ message: "hello world" });
  });

  app.post("/create", async (req, res) => {
    const match = await user.get({
      name: req.body.name,
      mobile: req.body.mobile,
      email: req.body.email,
      username: req.body.username,
    });

    if (match) res.json(Res.apiResponse("Conflict", req.body));
    else {
      const x = await user.create(req.body);
      res.json(
        x
          ? Res.apiResponse("OK", req.body)
          : Res.apiResponse("Internal Server Error", null),
      );
    }
  });

  app.post("/create/payment", async (req, res) => {
    const p = await user.userPayment(req.body);
    res.json(
      p
        ? Res.apiResponse("OK", req.body)
        : Res.apiResponse("Internal Server Error", null),
    );
  });

  app.post("/add/budget", async (req, res) => {
    const a = await user.addBudget(req.body);
    res.json(
      a
        ? Res.apiResponse("OK", req.body)
        : Res.apiResponse("Internal Server Error", null),
    );
  });

  app.post("/get/account", async (req, res) => {
    if (req.body.username || req.body.mobile) {
      const g = await user.get(req.body);
      g != null
        ? res.json(Res.apiResponse("OK", g))
        : res.json(Res.apiResponse("Not Found", null));
    } else res.json(Res.apiResponse("Bad Request", null));
  });

  app.post("/get/txn", async (req, res) => {
    res.json(Res.apiResponse("OK", await user.getTxn(req.body)));
  });

  app.post("/get/budget", async (req, res) => {
    res.json(Res.apiResponse("OK", await user.getBudget(req.body)));
  });

  app.post("/update/budget", async (req, res) => {
    res.json(Res.apiResponse("OK", await user.updateBudget(req.body)));
  });

  app.post("/update/user", async (req, res) => {
    res.json(Res.apiResponse("OK", await user.updateUser(req.body)));
  });

  app.post("/get/txn/statistics", async (req, res) => {
    res.json(Res.apiResponse("OK", await user.getTxnDataTimeWise(req.body)));
  });

  app.post("/get/monthly/txn", async (req, res) => {
    res.json(Res.apiResponse("OK", await user.getMonthlySpends(req.body)));
  });

  app.get("/send/report/", async (_, res) => {
    res.json(Res.apiResponse("OK", await user.sendDailyReport()));
  });

  app.post("/get/qr", async (req, res) => {
    res.json(Res.apiResponse("OK", await user.getUpiQr(req.body)));
  });

  app.use((_, res) => {
    res.status(404).json({
      status: false,
      statusCode: 404,
      message: "Not Found",
    });
  });

  errorMiddleware(app);

  const serverName = clustering ? "Express worker" : "Express";
  const servers = replicate(app, host, port, REPLICA, replicas);

  for (const server of servers) {
    gracefulShutdown({
      server,
      name: serverName,
      shutdownTimeout: SHUTDOWN_TIMEOUT,
      activeRequests,
      onShutdown: () => {
        logByte.warn(`${serverName}: shutdown started`);
      },
    });
  }

  if (clustering) {
    registerWorkerShutdownMessage(() => {
      triggerGracefulShutdown("shutdown");
    });
  }
}
module.exports = app;
