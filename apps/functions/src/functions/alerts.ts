import { app } from "@azure/functions";
import { evaluateAll, ingestOfficial } from "../lib/alerting";

// Official evacuation orders and alerts (BC + Alert Ready) every 5 minutes, then a check of every subscribed home.
app.timer("ingestOfficial", {
  schedule: "0 */5 * * * *",
  handler: async (_t, context) => {
    try {
      const r = await ingestOfficial();
      context.log(`official: ${r.bc} BC, ${r.naad} Alert Ready, ${r.failed} failed`);
      const e = await evaluateAll();
      context.log(`alerts: ${e.alerts} new for ${e.homes} homes`);
    } catch (err) {
      context.error("official/alerts failed", err);
    }
  },
});

// Satellite, smoke and air data change every 15 minutes; check homes shortly after each ingest.
app.timer("evaluateAlerts", {
  schedule: "0 7,22,37,52 * * * *",
  handler: async (_t, context) => {
    const e = await evaluateAll().catch((err) => (context.error("evaluate failed", err), { homes: 0, alerts: 0 }));
    context.log(`alerts: ${e.alerts} new for ${e.homes} homes`);
  },
});
