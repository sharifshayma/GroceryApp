export function isBlobUrl(url: string): boolean {
  try {
    return new URL(url).host.endsWith("blob.vercel-storage.com");
  } catch {
    return false;
  }
}
