"use client";

import { useCallback } from "react";
import { useParams } from "next/navigation";
import ProfileView from "@/features/profile/ProfileView";
import { getUserProfile } from "@/lib/api";
import { useAuth } from "@/features/auth/contexts/AuthContext";

export default function PublicProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const { userId: myId } = useAuth();

  const fetchProfile = useCallback(() => getUserProfile(userId), [userId]);

  return <ProfileView fetchProfile={fetchProfile} own={myId != null && myId === userId} />;
}
