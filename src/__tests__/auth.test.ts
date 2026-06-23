import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

const mockAuthorizeState = vi.hoisted(() => ({
  capturedAuthorize: null as any
}));

vi.mock('next-auth/providers/credentials', () => {
  return {
    default: (options: any) => {
      mockAuthorizeState.capturedAuthorize = options.authorize;
      return options;
    },
  };
});

vi.mock('next-auth', () => {
  return {
    default: () => {
      return { handlers: {}, signIn: vi.fn(), signOut: vi.fn(), auth: vi.fn() };
    },
  };
});

const { mockBind, mockSearch, mockUnbind } = vi.hoisted(() => {
  return {
    mockBind: vi.fn().mockResolvedValue(undefined),
    mockSearch: vi.fn().mockResolvedValue({
      searchEntries: [{ dn: 'cn=testuser,dc=example,dc=com', cn: 'Test User' }]
    }),
    mockUnbind: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('ldapts', () => {
  return {
    Client: class {
      bind = mockBind;
      search = mockSearch;
      unbind = mockUnbind;
    },
  };
});

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('../lib/logger', () => {
  return {
    logger: mockLogger
  };
});

import '../lib/auth';

describe('Auth LDAP logic', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('bypasses LDAP when AUTH_MODE=NONE', async () => {
    process.env.AUTH_MODE = 'NONE';
    const result = await mockAuthorizeState.capturedAuthorize({ username: 'admin', password: 'admin' });
    expect(result).toEqual({ id: '1', name: 'Admin User', email: 'admin@example.com' });
    
    const failResult = await mockAuthorizeState.capturedAuthorize({ username: 'bad', password: 'bad' });
    expect(failResult).toBeNull();
  });

  it('performs direct bind if no service password is provided', async () => {
    process.env.AUTH_MODE = 'LDAP';
    process.env.LDAP_BIND_DN = 'uid={{username}},ou=users,dc=example,dc=com';
    delete process.env.LDAP_BIND_PASSWORD;

    const result = await mockAuthorizeState.capturedAuthorize({ username: 'jdoe', password: 'password123' });

    expect(mockBind).toHaveBeenCalledWith('uid=jdoe,ou=users,dc=example,dc=com', 'password123');
    expect(mockUnbind).toHaveBeenCalled();
    expect(result).toEqual({ id: 'jdoe', name: 'jdoe' });
  });

  it('performs two-step search and bind if service password is provided', async () => {
    process.env.AUTH_MODE = 'LDAP';
    process.env.LDAP_BIND_DN = 'cn=admin,dc=example,dc=com';
    process.env.LDAP_BIND_PASSWORD = 'admin_password';
    process.env.LDAP_SEARCH_BASE_DNS = 'ou=users,dc=example,dc=com';
    process.env.LDAP_SEARCH_FILTER = '(sAMAccountName={{username}})';

    const result = await mockAuthorizeState.capturedAuthorize({ username: 'tuser', password: 'password123' });

    expect(mockBind).toHaveBeenNthCalledWith(1, 'cn=admin,dc=example,dc=com', 'admin_password');
    expect(mockSearch).toHaveBeenCalledWith('ou=users,dc=example,dc=com', {
      filter: '(sAMAccountName=tuser)',
      scope: 'sub',
      attributes: ['dn', 'cn', 'mail'],
    });
    expect(mockBind).toHaveBeenNthCalledWith(2, 'cn=testuser,dc=example,dc=com', 'password123');
    expect(mockUnbind).toHaveBeenCalledTimes(2);
    
    expect(result).toEqual({ id: 'tuser', name: 'Test User' });
    expect(mockLogger.info).toHaveBeenCalledWith(expect.objectContaining({ event: 'ldap_login_success' }));
  });

  it('handles ldap errors gracefully', async () => {
    process.env.AUTH_MODE = 'LDAP';
    mockBind.mockRejectedValueOnce(new Error('Invalid Credentials'));

    const result = await mockAuthorizeState.capturedAuthorize({ username: 'jdoe', password: 'bad_password' });

    expect(result).toBeNull();
    expect(mockLogger.error).toHaveBeenCalledWith(expect.objectContaining({ event: 'ldap_login_failed' }));
    // Depending on when it fails, it might try to unbind if the client was created
    expect(mockUnbind).toHaveBeenCalled(); 
  });
});
