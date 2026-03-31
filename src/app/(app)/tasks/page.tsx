import { TasksClient } from "@/components/app/tasks-client";

type TasksPageProps = {
  searchParams: Promise<{
    edit?: string;
  }>;
};

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const params = await searchParams;
  return <TasksClient editId={params.edit} refreshKey={crypto.randomUUID()} />;
}
