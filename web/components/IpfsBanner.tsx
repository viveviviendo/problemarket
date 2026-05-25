import type { useIpfsStatus } from "@/hooks/useIpfsStatus";

type Status = ReturnType<typeof useIpfsStatus>;

export function IpfsBanner({ status }: { status: Status }) {
  if (!status || status.configured) return null;
  return (
    <div className="rounded-xl border border-danger/50 bg-danger/10 p-4 text-sm text-danger">
      IPFS no configurado. Las descripciones no serán persistentes en IPFS. Configura Pinata para producción.
      {status.devMode ? " DEV_MODE está activo: el texto se guardará directamente on-chain." : " La publicación está bloqueada."}
    </div>
  );
}
