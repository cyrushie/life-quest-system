import { HistoryClient } from "@/components/app/history-client";

export default function HistoryPage() {
  return <HistoryClient refreshKey={crypto.randomUUID()} />;
}
