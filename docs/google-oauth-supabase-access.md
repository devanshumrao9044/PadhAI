# Supabase OAuth configuration access

The Supabase Google provider dashboard URL redirects to Supabase sign-in and presents an hCaptcha challenge. The current browser session is not authenticated. Provider status, Client IDs, Client Secret, and URL Configuration cannot be safely inspected or edited until the user completes Supabase Dashboard login/hCaptcha or configures the provider directly.

The repository-side Google OAuth implementation is already pushed at commit `00dda63`. Supabase database access through the configured integration remains available for SQL and advisor checks, but that interface does not expose the Auth provider secret configuration needed to enable Google OAuth.
