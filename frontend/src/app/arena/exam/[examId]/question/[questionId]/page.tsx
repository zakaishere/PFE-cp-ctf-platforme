import ExamTaskPage from "@/features/arena/exam/ExamTaskPage";

export default async function Page({ params }: { params: Promise<{ examId: string; questionId: string }> }) {
  const { examId, questionId } = await params;
  return <ExamTaskPage examId={examId} questionId={questionId} />;
}
