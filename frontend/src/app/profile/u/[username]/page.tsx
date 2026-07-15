"use client";

import { useCallback } from "react";
import { useParams } from "next/navigation";
import ProfileView from "@/features/profile/ProfileView";
import { getUserProfileByUsername } from "@/lib/api";

export default function PublicProfileByUsernamePage() {
  const { username } = useParams<{ username: string }>();

  const fetchProfile = useCallback(() => getUserProfileByUsername(username), [username]);

  // Ownership is decided by id on /profile; the pretty URL is always a public view.
  return <ProfileView fetchProfile={fetchProfile} own={false} />;
}
