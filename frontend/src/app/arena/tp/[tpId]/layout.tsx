import { TPSessionProvider } from "@/features/arena/tp/TPSessionContext";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tpId: string }>;
}) {
  const { tpId } = await params;
  return <TPSessionProvider tpId={tpId}>{children}</TPSessionProvider>;
}
