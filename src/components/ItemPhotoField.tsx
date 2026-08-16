"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { setItemPhoto, removeItemPhoto } from "@/actions/photos";
import { getDictionary, t } from "@/i18n";

const d = getDictionary("en");

export function ItemPhotoField({ itemId, photoUrl }: { itemId: string; photoUrl: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/photo/upload",
        clientPayload: JSON.stringify({ itemId }),
      });
      const res = await setItemPhoto({ itemId, url: blob.url, pathname: blob.pathname });
      if (!res.ok) setError(res.error);
      else router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  async function onRemove() {
    setBusy(true);
    setError(null);
    const res = await removeItemPhoto(itemId);
    setBusy(false);
    if (!res.ok) setError(res.error);
    else router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-bold text-text">{t(d, "catalog.items.photo")}</span>
      <div className="flex items-center gap-3">
        {photoUrl ? (
          <img src={photoUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-neutral text-text/40">
            —
          </div>
        )}
        <div className="flex flex-col gap-1">
          <input type="file" accept="image/*" disabled={busy} onChange={onFile} className="text-sm" />
          {photoUrl && (
            <button
              type="button"
              onClick={onRemove}
              disabled={busy}
              className="text-left text-sm text-red-600 hover:underline"
            >
              {t(d, "catalog.items.removePhoto")}
            </button>
          )}
        </div>
      </div>
      {busy && <p className="text-sm text-text/60">{t(d, "catalog.items.uploading")}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
