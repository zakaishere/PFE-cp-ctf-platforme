import TPOverviewPage from "@/features/arena/tp/TPOverviewPage";

export default async function Page({ params }: { params: Promise<{ tpId: string }> }) {
  const { tpId } = await params;
  return <TPOverviewPage tpId={tpId} />;
}
