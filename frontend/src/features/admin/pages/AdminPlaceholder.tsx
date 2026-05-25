"use client";

import Navbar from "@/components/Navbar";
import { Construction } from "lucide-react";

interface AdminPlaceholderProps {
  title: string;
}

const AdminPlaceholder = ({ title }: AdminPlaceholderProps) => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 pt-24 py-6">
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-muted-foreground">
          <Construction className="h-12 w-12" />
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-sm">This section is under construction.</p>
        </div>
      </div>
    </div>
  );
};

export default AdminPlaceholder;
