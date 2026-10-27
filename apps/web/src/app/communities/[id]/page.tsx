import { notFound } from "next/navigation";
import { COMMUNITIES } from "@sylvia/core";
import { CommunityView } from "./CommunityView";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `${COMMUNITIES.find((c) => c.id === id)?.name ?? "Community"} · Sylvia` };
}

export default async function CommunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!COMMUNITIES.some((c) => c.id === id)) notFound();
  return (
    <main className="screen" style={{ maxWidth: 880 }}>
      <CommunityView id={id} />
    </main>
  );
}
