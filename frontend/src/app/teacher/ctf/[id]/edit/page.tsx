"use client";
import { use } from "react";
import TeacherCTFForm from "@/features/teacher/pages/TeacherCTFForm";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <TeacherCTFForm editId={id} />;
}
