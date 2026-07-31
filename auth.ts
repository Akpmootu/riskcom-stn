import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import LINE from "next-auth/providers/line";

export const authProviderAvailability = {
  google: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
  line: Boolean(process.env.AUTH_LINE_ID && process.env.AUTH_LINE_SECRET),
};

const providers: NextAuthConfig["providers"] = [];

if (authProviderAvailability.google) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    }),
  );
}

if (authProviderAvailability.line) {
  providers.push(
    LINE({
      clientId: process.env.AUTH_LINE_ID,
      clientSecret: process.env.AUTH_LINE_SECRET,
      authorization: {
        params: {
          scope: "openid profile",
        },
      },
    }),
  );
}

export const authConfig: NextAuthConfig = {
  providers,
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 12 * 60 * 60,
  },
  pages: {
    signIn: "/admin/login",
  },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return true;
      const googleProfile = profile as
        | { email_verified?: boolean }
        | undefined;
      return googleProfile?.email_verified !== false;
    },
    async jwt({ token, account, profile }) {
      if (account) {
        token.provider = account.provider;
        token.providerAccountId =
          account.providerAccountId || String(profile?.sub || "");
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.provider =
          typeof token.provider === "string" ? token.provider : "";
        session.user.providerAccountId =
          typeof token.providerAccountId === "string"
            ? token.providerAccountId
            : "";
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
