import "server-only";
import { BlobServiceClient, type ContainerClient } from "@azure/storage-blob";
import { env } from "./env";

// Saved-scan photos live in the private `photos` container. A lifecycle rule deletes them after 30 days; the app
// serves them through /api/scans/[id]/photo, never with public links.
let photos: ContainerClient | undefined;
function container() {
  photos ??= BlobServiceClient.fromConnectionString(env("STORAGE_CONNECTION")).getContainerClient("photos");
  return photos;
}

const blobName = (device: string, scanId: string) => `photos/${device}/${scanId}.jpg`;

export async function putPhoto(device: string, scanId: string, jpeg: Buffer): Promise<string> {
  const name = blobName(device, scanId);
  await container().getBlockBlobClient(name).uploadData(jpeg, { blobHTTPHeaders: { blobContentType: "image/jpeg" } });
  return name;
}

export async function getPhoto(device: string, scanId: string): Promise<Buffer | undefined> {
  try {
    return await container().getBlockBlobClient(blobName(device, scanId)).downloadToBuffer();
  } catch {
    return undefined; // deleted by the 30-day rule, or never saved
  }
}

export async function deletePhoto(device: string, scanId: string): Promise<void> {
  await container().getBlockBlobClient(blobName(device, scanId)).deleteIfExists();
}
