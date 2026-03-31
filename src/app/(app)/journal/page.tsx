import { JournalClient } from "@/components/app/journal-client";

export default function JournalPage() {
  return <JournalClient refreshKey={crypto.randomUUID()} />;
}
