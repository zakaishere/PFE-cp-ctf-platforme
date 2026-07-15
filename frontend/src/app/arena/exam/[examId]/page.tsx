import ExamOverviewPage from "@/features/arena/exam/ExamOverviewPage";

export default async function Page({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  return <ExamOverviewPage examId={examId} />;
}
