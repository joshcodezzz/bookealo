import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthPortal } from "@/components/auth/AuthPortal";
import { LoginForm } from "@/components/auth/LoginForm";
import {
  getAuthContext,
  getRedirectPathByRole,
  sanitizeNextPath,
} from "@/lib/auth";

export const metadata: Metadata = {
  title: "Iniciar sesión",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { user, profile } = await getAuthContext();
  if (user && profile) {
    redirect(getRedirectPathByRole(profile.role));
  }

  const resolvedSearchParams = await searchParams;
  const rawNext = Array.isArray(resolvedSearchParams.next)
    ? resolvedSearchParams.next[0]
    : resolvedSearchParams.next;
  const safeNext = sanitizeNextPath(rawNext);

  return (
    <>
      <AuthPortal />
      <div className="relative z-[1]">
        <LoginForm nextPath={safeNext} />
      </div>
    </>
  );
}
