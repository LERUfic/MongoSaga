import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { Client } from 'ldapts';
import { logger } from "./logger";
import { authConfig } from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    CredentialsProvider({
      name: 'LDAP',
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // Skip if auth mode is not LDAP
        if (process.env.AUTH_MODE !== 'LDAP') {
          // Fallback to basic credentials for OIDC/Testing mocks if needed
          if (credentials.username === 'admin' && credentials.password === 'admin') {
             return { id: "1", name: "Admin User", email: "admin@example.com" };
          }
          return null;
        }
        
        let client: Client | null = null;
        try {
          client = new Client({
            url: process.env.LDAP_URL || 'ldap://localhost:389'
          });
          
          const username = credentials.username as string;
          const password = credentials.password as string;

          const serviceBindDN = process.env.LDAP_BIND_DN || '';
          const servicePassword = process.env.LDAP_BIND_PASSWORD;
          
          // Two-Step: Search and Bind (If service account password is provided)
          if (servicePassword) {
            await client.bind(serviceBindDN, servicePassword);
            
            const searchBase = process.env.LDAP_SEARCH_BASE_DNS || '';
            const searchFilterTpl = process.env.LDAP_SEARCH_FILTER || `(sAMAccountName=${username})`;
            // Support both %s and {{username}} template replacements
            const filter = searchFilterTpl.replace(/%s/g, username).replace(/\{\{username\}\}/g, username);
            
            const { searchEntries } = await client.search(searchBase, {
              filter,
              scope: 'sub',
              attributes: ['dn', 'cn', 'mail'],
            });
            
            if (searchEntries.length === 0) {
               throw new Error('User not found in AD');
            }
            
            const userDN = searchEntries[0].dn;
            const userCn = searchEntries[0].cn?.toString() || username;
            
            await client.unbind();
            
            // Bind again as the discovered User
            client = new Client({ url: process.env.LDAP_URL || 'ldap://localhost:389' });
            await client.bind(userDN, password);
            await client.unbind();
            
            logger.info({ event: 'ldap_login_success', username: username, metadata: { type: 'search_and_bind' } });
            return { id: username, name: userCn };
            
          } else {
            // Fallback: Direct Bind
            const bindDN = serviceBindDN.replace('{{username}}', username).replace('%s', username);
            await client.bind(bindDN, password);
            await client.unbind();
            
            logger.info({ event: 'ldap_login_success', username: username, metadata: { type: 'direct_bind' } });
            return { id: username, name: username };
          }
        } catch (e: any) {
          logger.error({ event: 'ldap_login_failed', username: credentials.username as string, error: e.message || e });
          if (client) {
             try { await client.unbind(); } catch (err) {}
          }
          return null;
        }
      }
    })
  ],
  pages: {
    signIn: '/login',
  },
});
