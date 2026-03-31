import { PunishmentsClient } from "@/components/app/punishments-client";

type PunishmentsPageProps = {
  searchParams: Promise<{
    edit?: string;
  }>;
};

export default async function PunishmentsPage({
  searchParams,
}: PunishmentsPageProps) {
  const params = await searchParams;
  return <PunishmentsClient editId={params.edit} refreshKey={crypto.randomUUID()} />;
}
