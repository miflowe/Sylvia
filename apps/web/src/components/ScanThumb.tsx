"use client";
import { useEffect, useState } from "react";
import { withDevice } from "@/lib/device";

/** A saved scan's photo. Photos need the owner's headers, so they're fetched and shown as a local blob URL. */
export function ScanThumb({ id, hasPhoto, className }: { id: string; hasPhoto: boolean; className?: string }) {
  const [src, setSrc] = useState<string | undefined>();
  useEffect(() => {
    if (!hasPhoto) return;
    let url: string | undefined;
    withDevice()
      .then((init) => fetch(`/api/scans/${id}/photo`, init))
      .then(async (r) => {
        if (r.ok) setSrc((url = URL.createObjectURL(await r.blob())));
      })
      .catch(() => {});
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, hasPhoto]);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="" className={className} /> : <span className={className} aria-hidden="true" />;
}
