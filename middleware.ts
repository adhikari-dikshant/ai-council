import { withAuth } from "next-auth/middleware";

export default withAuth({ pages: { signIn: "/login" } });

export const config = {
  // protect everything except NextAuth routes, login page, and static assets
  matcher: ["/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)"],
};
