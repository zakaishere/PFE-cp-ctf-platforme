import { ExamSessionProvider } from "@/features/arena/exam/ExamSessionContext";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ examId: string }>;
}) {
  const { examId } = await params;
  return <ExamSessionProvider examId={examId}>{children}</ExamSessionProvider>;
}
