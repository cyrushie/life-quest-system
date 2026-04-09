import { type RealtimeConnectionState } from "@/lib/client/use-private-broadcast-channel";

function getStatusCopy(
  state: RealtimeConnectionState,
  liveLabel?: string,
  fallbackLabel?: string,
) {
  switch (state) {
    case "live":
      return liveLabel ?? "Live";
    case "connecting":
      return "Connecting";
    case "fallback":
      return fallbackLabel ?? "Fallback sync";
    default:
      return "Updates off";
  }
}

function getDotClassName(state: RealtimeConnectionState) {
  switch (state) {
    case "live":
      return "status-dot";
    case "connecting":
      return "status-dot status-dot-connecting";
    case "fallback":
      return "status-dot status-dot-fallback";
    default:
      return "status-dot status-dot-muted";
  }
}

function getPillClassName(state: RealtimeConnectionState) {
  switch (state) {
    case "live":
      return "status-pill status-pill-live";
    case "connecting":
      return "status-pill status-pill-connecting";
    case "fallback":
      return "status-pill status-pill-fallback";
    default:
      return "status-pill";
  }
}

export function LiveStatusPill({
  state,
  liveLabel,
  fallbackLabel,
  title,
}: {
  state: RealtimeConnectionState;
  liveLabel?: string;
  fallbackLabel?: string;
  title?: string;
}) {
  if (state === "idle") {
    return null;
  }

  return (
    <span className={getPillClassName(state)} title={title}>
      <span className={getDotClassName(state)} />
      {getStatusCopy(state, liveLabel, fallbackLabel)}
    </span>
  );
}
