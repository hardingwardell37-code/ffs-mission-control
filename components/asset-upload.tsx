"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/browser";
import { registerAsset } from "@/lib/actions";

const BUCKET = "campaign-assets";

export function AssetUploadForm({
  campaignId,
  organizationId,
}: {
  campaignId: string;
  organizationId: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = (form.elements.namedItem("file") as HTMLInputElement)?.files?.[0];
    let storagePath = String(fd.get("storagePath") ?? "").trim();
    let storageUrl = String(fd.get("storageUrl") ?? "").trim();
    let mimeType = String(fd.get("mimeType") ?? "").trim();
    let fileSize = String(fd.get("fileSize") ?? "").trim();

    if (file) {
      mimeType = file.type || mimeType;
      fileSize = String(file.size);
      if (!String(fd.get("title") ?? "").trim()) {
        fd.set("title", file.name);
      }
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
      const path = `${organizationId}/${campaignId}/${Date.now()}-${safeName}`;
      try {
        const supabase = createClient();
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
          contentType: file.type || undefined,
          upsert: false,
        });
        if (error) {
          setMessage(`Storage upload skipped (${error.message}). Registering metadata only — create the "${BUCKET}" bucket and policies in Supabase, then re-upload.`);
          storagePath = storagePath || path;
        } else {
          storagePath = path;
          const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
          storageUrl = data.publicUrl;
          setMessage(`Uploaded to ${BUCKET}/${path}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Storage unavailable";
        setMessage(`Storage unavailable (${msg}). Metadata will be saved with the intended path.`);
        storagePath = storagePath || path;
      }
    }

    fd.set("campaignId", campaignId);
    if (storagePath) fd.set("storagePath", storagePath);
    if (storageUrl) fd.set("storageUrl", storageUrl);
    if (mimeType) fd.set("mimeType", mimeType);
    if (fileSize) fd.set("fileSize", fileSize);
    if (!fd.get("origin")) fd.set("origin", file ? "upload" : (fd.get("sourceUrl") ? "url" : "upload"));

    startTransition(async () => {
      try {
        await registerAsset(fd);
        form.reset();
        setMessage((m) => m ?? "Asset registered.");
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Failed to register asset");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="form panel">
      <div className="eyebrow">Provenance required</div>
      <h2>Register / upload asset</h2>
      <p className="muted">Bucket: <code>{BUCKET}</code>. If the bucket is not configured, path/URL metadata still saves.</p>
      <div className="form-grid">
        <label>Title<input name="title" maxLength={200} placeholder="Product hero PNG" /></label>
        <label>Role
          <select name="role" required defaultValue="source">
            <option value="source">source</option>
            <option value="reference">reference</option>
            <option value="locked">locked</option>
            <option value="generated">generated</option>
          </select>
        </label>
        <label>Ownership
          <select name="ownershipStatus" required defaultValue="owned">
            <option value="owned">owned</option>
            <option value="licensed">licensed</option>
            <option value="generated">generated</option>
            <option value="unknown">unknown</option>
          </select>
        </label>
        <label>Origin
          <select name="origin" defaultValue="upload">
            <option value="upload">upload</option>
            <option value="url">url</option>
            <option value="import">import</option>
            <option value="generated">generated</option>
          </select>
        </label>
      </div>
      <label>File<input name="file" type="file" /></label>
      <div className="form-grid">
        <label>Source URL<input name="sourceUrl" type="url" placeholder="https://…" /></label>
        <label>Storage path (optional)<input name="storagePath" placeholder="org/campaign/file.png" /></label>
        <label>Storage URL (optional)<input name="storageUrl" type="url" /></label>
        <label>MIME type<input name="mimeType" placeholder="image/png" /></label>
      </div>
      <label>Usage notes<textarea name="usageNotes" rows={2} maxLength={4000} placeholder="Authorized for production / reference only / identity-locked" /></label>
      <input type="hidden" name="fileSize" value="" />
      <button className="button" type="submit" disabled={pending}>{pending ? "Saving…" : "Save asset"}</button>
      {message && <p className="muted">{message}</p>}
    </form>
  );
}
