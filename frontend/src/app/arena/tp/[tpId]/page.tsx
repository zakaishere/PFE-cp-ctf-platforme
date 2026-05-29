import Arena from "@/features/arena/pages/Arena";

export default async function Page({ params }: { params: Promise<{ tpId: string }> }) {
  const { tpId } = await params;
  return <Arena examId={tpId} mode="tp" />;
}
