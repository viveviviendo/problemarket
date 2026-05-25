export interface Env {
  PINATA_JWT: string;
  FRONTEND_ORIGIN: string;
  IPFS_GATEWAY: string;
  UPLOAD_RATE_LIMITER: RateLimit;
}

export type UploadDocument = {
  kind?: "problem" | "solution";
  title?: string;
  description?: string;
  solution?: string;
  notes?: string;
};

export async function pinDocument(document: UploadDocument, env: Env) {
  if (!env.PINATA_JWT) throw new Error("PINATA_JWT is not configured");
  const hasContent = Boolean(document.description?.trim() || document.solution?.trim());
  if (!hasContent) throw new Error("Description or solution content is required");
  if ((document.notes?.length || 0) > 500) throw new Error("Notes must not exceed 500 characters");

  const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.PINATA_JWT}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      pinataContent: document,
      pinataMetadata: { name: `problemarket-${document.kind || "submission"}` }
    })
  });
  if (!response.ok) throw new Error(`Pinata upload failed (${response.status})`);
  const body = await response.json<{ IpfsHash: string }>();
  return {
    ipfsHash: body.IpfsHash,
    url: `ipfs://${body.IpfsHash}`,
    gatewayUrl: `${env.IPFS_GATEWAY}/${body.IpfsHash}`
  };
}

export async function readDocument(hash: string, env: Env) {
  if (!/^[a-zA-Z0-9]+$/.test(hash)) throw new Error("Invalid IPFS hash");
  const response = await fetch(`${env.IPFS_GATEWAY}/${hash}`);
  if (!response.ok) throw new Error(`IPFS gateway failed (${response.status})`);
  return response;
}
