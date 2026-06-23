# Contributing to Heimdall-Inspired Mongo UI

Thank you for your interest in contributing! 

## Local Development

1. **Clone the repo** and run `npm install`.
2. **Start the dev server** with `npm run dev`.
3. **Run tests** via `npm run test:coverage` to ensure you haven't broken anything.

## Authentication Modes
To test locally, set the `AUTH_MODE` environment variable in a `.env.local` file:
- `AUTH_MODE=NONE` (Bypass auth, standard direct URI connection)
- `AUTH_MODE=OIDC` (SSO Login)
- `AUTH_MODE=LDAP` (LDAP Local Auth)

## Pull Request Guidelines
- We use Husky pre-commit hooks. Ensure your code passes standard `npm run lint`.
- Add tests for any new UI components or backend API modifications.
- Reference related issue numbers in your PR.
