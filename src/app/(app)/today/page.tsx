import { TodayClient } from "@/components/app/today-client";
import { getTodayDateKey, isValidDateKey } from "@/lib/date";

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const dateKey =
    params.date && isValidDateKey(params.date) ? params.date : getTodayDateKey();

  return <TodayClient dateKey={dateKey} refreshKey={crypto.randomUUID()} />;
}
