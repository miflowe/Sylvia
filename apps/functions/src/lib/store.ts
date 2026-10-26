import { CosmosClient, BulkOperationType, type JSONObject, type OperationInput } from "@azure/cosmos";
import type { Observation } from "@sylvia/core";

let client: CosmosClient | undefined;
function observations() {
  client ??= new CosmosClient({ endpoint: process.env.COSMOS_ENDPOINT!, key: process.env.COSMOS_KEY! });
  return client.database("sylvia").container("observations");
}

/** Upserts in batches of 100 (Cosmos DB bulk limit). Returns how many failed. */
export async function upsertObservations(items: Observation[]): Promise<number> {
  let failed = 0;
  for (let i = 0; i < items.length; i += 100) {
    const ops: OperationInput[] = items.slice(i, i + 100).map((o) => ({
      operationType: BulkOperationType.Upsert,
      partitionKey: o.cellId,
      resourceBody: o as unknown as JSONObject,
    }));
    const res = await observations().items.bulk(ops, { continueOnError: true });
    failed += res.filter((r) => r.statusCode >= 300).length;
  }
  return failed;
}
