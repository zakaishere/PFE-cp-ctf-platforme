"use client";
import { use } from "react";
import { redirect } from "next/navigation";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  redirect(`/teacher/ctf/${id}/manage?tab=settings`);
}
