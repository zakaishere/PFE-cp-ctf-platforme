"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
export default function RedirectToManage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  useEffect(() => { router.replace(`/teacher/exams/${id}/manage?tab=settings`); }, [id, router]);
  return null;
}
