import PracticeArena from "@/features/student/pages/PracticeArena";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PracticeArena problemId={id} />;
}
