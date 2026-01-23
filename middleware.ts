import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

const isPublicRoute = createRouteMatcher([
  "/",
  "/api/check",
  "/api/analyze",
  "/api/user-settings",
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

const clerk = clerkMiddleware((auth, req) => {
  if (isPublicRoute(req)) return;
  return auth().then(({ userId, redirectToSignIn }) => {
    if (!userId) return redirectToSignIn();
    return undefined;
  });
});

export default clerkEnabled ? clerk : () => NextResponse.next();

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/api/(.*)"],
};
