"use client";

import ProfileView from "@/features/profile/ProfileView";
import { getMyProfile } from "@/lib/api";

export default function MyProfilePage() {
  return <ProfileView fetchProfile={getMyProfile} own />;
}
