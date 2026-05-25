"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

const TeacherPlaceholder = ({ title }: { title: string }) => (
  <Card className="bg-card/60 backdrop-blur-lg border-border/40">
    <CardContent className="flex flex-col items-center justify-center py-20 text-center">
      <Construction className="h-10 w-10 text-muted-foreground mb-4" />
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground mt-1">
        This section is coming soon.
      </p>
    </CardContent>
  </Card>
);

export default TeacherPlaceholder;
