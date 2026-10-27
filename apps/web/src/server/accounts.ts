import "server-only";
import { container } from "./cosmos";
import { deletePhoto, movePhoto } from "./storage";

const ALL = (owner: string) => ({ query: "SELECT * FROM c WHERE c.deviceOrUserId = @o", parameters: [{ name: "@o", value: owner }] });

/** On first sign-in on a device: move that device's saved plants, checklist, alerts and alert settings to the account. */
export async function linkDevice(device: string, account: string) {
  const moved = { scans: 0, alerts: 0, checklist: false, alertsOn: false };

  const scans = container("scans");
  for (const s of (await scans.items.query<{ id: string; hasPhoto?: boolean }>(ALL(device), { partitionKey: device }).fetchAll()).resources) {
    if (s.hasPhoto) await movePhoto(device, account, s.id);
    await scans.items.upsert({ ...s, deviceOrUserId: account });
    await scans.item(s.id, device).delete();
    moved.scans++;
  }

  const alerts = container("alerts");
  for (const a of (await alerts.items.query<{ id: string }>(ALL(device), { partitionKey: device }).fetchAll()).resources) {
    await alerts.items.upsert({ ...a, deviceOrUserId: account });
    await alerts.item(a.id, device).delete();
    moved.alerts++;
  }

  // Checklist: keep everything ticked on either side.
  const checklists = container("checklists");
  const { resource: fromDevice } = await checklists.item(device, device).read<{ done: Record<string, boolean>; percent: number; communityId?: string }>();
  if (fromDevice) {
    const { resource: existing } = await checklists.item(account, account).read<{ done: Record<string, boolean> }>();
    await checklists.items.upsert({ ...fromDevice, id: account, deviceOrUserId: account, done: { ...existing?.done, ...fromDevice.done }, updatedAt: new Date().toISOString() });
    await checklists.item(device, device).delete();
    moved.checklist = true;
  }

  // Alert subscription follows the device's browser; re-key it to the account.
  const subs = container("pushSubscriptions");
  const { resource: sub } = await subs.item(device, device).read<Record<string, unknown>>();
  if (sub) {
    await subs.items.upsert({ ...sub, id: account, deviceOrUserId: account });
    await subs.item(device, device).delete();
    moved.alertsOn = true;
  }
  return moved;
}

/** Deletes everything Sylvia stores for an account (Profile → Delete my data). */
export async function deleteAccountData(account: string) {
  const scans = container("scans");
  for (const s of (await scans.items.query<{ id: string }>(ALL(account), { partitionKey: account }).fetchAll()).resources) {
    await deletePhoto(account, s.id);
    await scans.item(s.id, account).delete();
  }
  const alerts = container("alerts");
  for (const a of (await alerts.items.query<{ id: string }>(ALL(account), { partitionKey: account }).fetchAll()).resources) await alerts.item(a.id, account).delete();
  await container("checklists").item(account, account).delete().catch(() => {});
  await container("pushSubscriptions").item(account, account).delete().catch(() => {});
}
