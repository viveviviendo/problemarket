"use client";

import { useEffect, useState } from "react";

type Status = { configured: boolean; devMode: boolean } | undefined;

export function useIpfsStatus() {
  const [status, setStatus] = useState<Status>();
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_IPFS_API_URL) {
      setStatus({ configured: true, devMode: false });
      return;
    }
    fetch("/api/ipfs").then((response) => response.json()).then(setStatus).catch(() => setStatus({ configured: false, devMode: false }));
  }, []);
  return status;
}
