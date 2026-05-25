import Arena from "@/features/arena/pages/Arena";

export default async function Page({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  return <Arena examId={examId} mode="exam" />;
}
