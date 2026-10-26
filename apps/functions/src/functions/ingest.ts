import { app, type InvocationContext } from "@azure/functions";
import { FEEDS, type IngestResult } from "../lib/ingest";

async function run(feed: keyof typeof FEEDS, context: InvocationContext): Promise<IngestResult> {
  try {
    const r = await FEEDS[feed]();
    context.log(`ingest ${r.feed}: ${r.fetched} fetched, ${r.failed} failed${r.note ? ` (${r.note})` : ""}`);
    return r;
  } catch (e) {
    context.error(`ingest ${feed} failed`, e);
    return { feed, fetched: 0, failed: 0, note: e instanceof Error ? e.message : String(e) };
  }
}

// Schedules (NCRONTAB, UTC). FIRMS and PurpleAir change fastest; AQHI is published hourly.
app.timer("ingestFirms", { schedule: "0 */15 * * * *", handler: async (_t, c) => {
    await run("firms", c);
  } });
app.timer("ingestPurpleAir", { schedule: "0 5,20,35,50 * * * *", handler: async (_t, c) => {
    await run("purpleair", c);
  } });
app.timer("ingestCwfis", { schedule: "0 10 * * * *", handler: async (_t, c) => {
    await run("cwfis", c);
  } });
app.timer("ingestAqhi", { schedule: "0 25 * * * *", handler: async (_t, c) => {
    await run("aqhi", c);
  } });

// Manual run for testing and after deploys: POST /api/ingest?feed=firms (needs the function key).
app.http("ingestNow", {
  route: "ingest",
  methods: ["POST"],
  authLevel: "function",
  handler: async (req, context) => {
    const feed = req.query.get("feed");
    const feeds = feed && feed in FEEDS ? [feed as keyof typeof FEEDS] : (Object.keys(FEEDS) as (keyof typeof FEEDS)[]);
    const results = [];
    for (const f of feeds) results.push(await run(f, context));
    return { jsonBody: results };
  },
});
