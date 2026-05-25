import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    configured: Boolean(process.env.PINATA_JWT),
    devMode: process.env.NEXT_PUBLIC_DEV_MODE === "true"
  });
}

export async function POST(request: Request) {
  const document = await request.json();
  const jwt = process.env.PINATA_JWT;
  const devMode = process.env.NEXT_PUBLIC_DEV_MODE === "true";

  if (!jwt) {
    if (!devMode) {
      return NextResponse.json({ error: "IPFS is not configured. Publishing is disabled outside DEV_MODE." }, { status: 503 });
    }
    const uri = document.kind === "problem" ? String(document.description || "").trim() : JSON.stringify(document);
    if (!uri) return NextResponse.json({ error: "Empty content cannot be published." }, { status: 400 });
    return NextResponse.json({ uri, devFallback: true });
  }

  try {
    const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        pinataContent: document,
        pinataMetadata: { name: "problemarket-submission" }
      })
    });
    if (!response.ok) {
      return NextResponse.json({ error: "IPFS upload failed. Publishing was not submitted." }, { status: 502 });
    }
    const { IpfsHash } = await response.json();
    return NextResponse.json({ uri: `ipfs://${IpfsHash}` });
  } catch {
    return NextResponse.json({ error: "IPFS network unavailable. Publishing was not submitted." }, { status: 502 });
  }
}
