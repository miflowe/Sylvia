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

/** Moves a photo to a new owner (used when a device's data joins an account). */
export async function movePhoto(fromOwner: string, toOwner: string, scanId: string): Promise<void> {
  const photo = await getPhoto(fromOwner, scanId);
  if (!photo) return;
  await putPhoto(toOwner, scanId, photo);
  await deletePhoto(fromOwner, scanId);
}

// Resident report photos: served only while their report exists (6 hours); a lifecycle rule deletes them after a day.
const reportBlob = (id: string) => `photos/reports/${id}.jpg`;

export async function putReportPhoto(id: string, jpeg: Buffer): Promise<void> {
  await container().getBlockBlobClient(reportBlob(id)).uploadData(jpeg, { blobHTTPHeaders: { blobContentType: "image/jpeg" } });
}

export async function getReportPhoto(id: string): Promise<Buffer | undefined> {
  try {
    return await container().getBlockBlobClient(reportBlob(id)).downloadToBuffer();
  } catch {
    return undefined;
  }
}
