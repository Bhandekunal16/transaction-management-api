module.exports = function cronLayer(cron) {
  cron.schedule("*/1 * * * *", async () => {
    console.log("Running test cron...");
  });

  cron.schedule("0 18 * * *", async () => await user.sendDailyReport(), {
    timezone: "Asia/Kolkata",
  });
};
