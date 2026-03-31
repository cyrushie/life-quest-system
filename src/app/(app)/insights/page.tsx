import { InsightsClient } from "@/components/app/insights-client";

export default function InsightsPage() {
  return <InsightsClient refreshKey={crypto.randomUUID()} />;
}
