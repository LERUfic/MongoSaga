export const authConfig = {
  providers: [], // Empty for Edge compatibility
  pages: {
    signIn: '/login',
  },
  trustHost: true,
  secret: process.env.AUTH_SECRET || "development_fallback_secret_change_in_production",
};
