"use client";

// Anonymous device id: random, kept in this browser, sent as x-sylvia-device. If storage is blocked (private
// mode), it lasts for this visit only.
let memory: string | undefined;

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem("sylvia.device");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("sylvia.device", id);
    }
    return id;
  } catch {
    memory ??= crypto.randomUUID();
    return memory;
  }
}

/** Request options with the device id, plus the account's ID token when signed in (the account then owns the data). */
export async function withDevice(init: RequestInit = {}): Promise<RequestInit> {
  const { idToken } = await import("./auth");
  const token = await idToken();
  return {
    ...init,
    headers: { ...(init.headers ?? {}), "x-sylvia-device": getDeviceId(), ...(token ? { authorization: `Bearer ${token}` } : {}) },
  };
}

/** One-off location fix, only when the person taps a button that needs it. */
export function getLocation(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("Location isn't available on this device."));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (e) =>
        reject(new Error(e.code === e.PERMISSION_DENIED ? "Location permission was turned off. You can allow it in your browser settings." : "I couldn't get your location. Try again outside or near a window.")),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60 * 1000 },
    );
  });
}
