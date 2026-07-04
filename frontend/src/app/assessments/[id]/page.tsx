import ExamWaitingRoom from "@/features/student/pages/ExamWaitingRoom";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ExamWaitingRoom id={id} />;
}
