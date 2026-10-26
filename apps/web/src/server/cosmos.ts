import "server-only";
import { CosmosClient, type Container } from "@azure/cosmos";
import { env } from "./env";

let client: CosmosClient | undefined;

export function container(name: string): Container {
  client ??= new CosmosClient({ endpoint: env("COSMOS_ENDPOINT"), key: env("COSMOS_KEY") });
  return client.database("sylvia").container(name);
}
