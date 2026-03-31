import { ExerciseClient } from "@/components/app/exercise-client";

type ExercisePageProps = {
  searchParams: Promise<{
    edit?: string;
  }>;
};

export default async function ExercisePage({ searchParams }: ExercisePageProps) {
  const params = await searchParams;
  return <ExerciseClient editId={params.edit} refreshKey={crypto.randomUUID()} />;
}
