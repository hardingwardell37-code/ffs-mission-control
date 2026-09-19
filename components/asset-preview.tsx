import { isImageAsset, isVideoAsset } from "@/lib/storage/campaign-assets";

export function AssetMediaPreview({
  title,
  mimeType,
  storageUrl,
  storagePath,
  compact = false,
}: {
  title: string;
  mimeType?: string | null;
  storageUrl?: string | null;
  storagePath?: string | null;
  compact?: boolean;
}) {
  const url = storageUrl?.trim() || null;
  const image = url ? isImageAsset(mimeType, url) : false;
  const video = url ? isVideoAsset(mimeType, url) : false;

  if (url && image) {
    return (
      <div className={compact ? "asset-thumb compact" : "asset-thumb"}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={title} />
        <a className="asset-open" href={url} target="_blank" rel="noreferrer">
          Open full size
        </a>
      </div>
    );
  }

  if (url && video) {
    return (
      <div className={compact ? "asset-thumb compact" : "asset-thumb"}>
        <video src={url} controls preload="metadata" />
        <a className="asset-open" href={url} target="_blank" rel="noreferrer">
          Open full size
        </a>
      </div>
    );
  }

  if (url) {
    return (
      <div className={compact ? "asset-thumb compact" : "asset-thumb"}>
        <a className="asset-open" href={url} target="_blank" rel="noreferrer">
          Open media
        </a>
      </div>
    );
  }

  if (storagePath) {
    return <p className="muted">No preview URL — stored path: {storagePath}</p>;
  }

  return <p className="muted">No preview URL</p>;
}
