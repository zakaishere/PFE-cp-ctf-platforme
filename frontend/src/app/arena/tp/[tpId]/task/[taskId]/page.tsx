import TPTaskPage from "@/features/arena/tp/TPTaskPage";

export default async function Page({ params }: { params: Promise<{ tpId: string; taskId: string }> }) {
  const { tpId, taskId } = await params;
  return <TPTaskPage tpId={tpId} taskId={taskId} />;
}
