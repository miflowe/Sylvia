import { app } from "@azure/functions";

// Liveness probe for deploy smoke tests. Data-ingestion timers arrive in step 4.
app.http("health", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async () => ({ jsonBody: { ok: true, service: "sylvia-functions" } }),
});
