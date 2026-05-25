type StoredDocument = Record<string, string>;

const remoteApi = process.env.NODE_ENV === "production"
  ? process.env.NEXT_PUBLIC_IPFS_API_URL?.replace(/\/$/, "")
  : undefined;

export async function uploadStoredDocument(document: StoredDocument) {
  const endpoint = remoteApi ? `${remoteApi}/upload` : "/api/ipfs";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(document)
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "IPFS upload failed.");
  return { uri: body.url || body.uri as string };
}

export async function readStoredDocument(uri: string) {
  if (!uri) return {};
  const location = uri.startsWith("ipfs://") ? `https://ipfs.io/ipfs/${uri.slice(7)}` : uri;
  if (location.startsWith("http") || location.startsWith("data:")) {
    const response = await fetch(location);
    if (!response.ok) throw new Error("Unable to fetch stored content");
    return response.json() as Promise<StoredDocument>;
  }
  try {
    return JSON.parse(uri) as StoredDocument;
  } catch {
    return { description: uri, solution: uri };
  }
}
