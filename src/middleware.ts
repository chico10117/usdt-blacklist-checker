import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Note: when using `src/app`, Next expects middleware under `src/` as well.
const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

const isPublicRoute = createRouteMatcher([
  "/",
  "/api/check",
  "/api/analyze",
  "/api/user-settings",
  "/api/saved-reports",
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

const clerk = clerkMiddleware(async (auth, req) => {
  const { userId, redirectToSignIn } = await auth();
  if (isPublicRoute(req)) return;
  if (!userId) return redirectToSignIn();
  return undefined;
});

export default clerkEnabled ? clerk : () => NextResponse.next();

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/api/(.*)"],
};
