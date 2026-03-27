# Google OAuth and Release Notes

## Minimum Working Path

1. Deploy the app to a real public URL.
2. In Supabase Auth URL settings, set:
- `Site URL` to the production app URL.
- redirect URLs for the production URL and local dev URL.
3. In Google Auth Platform:
- keep the app `External` unless there is a Workspace reason not to
- if publish status is `Test`, add the real user email under test users
- create a `Web application` OAuth client
4. In that Google web client:
- authorized JavaScript origins include the public app URL and local dev origin
- authorized redirect URI is `https://<supabase-project-ref>.supabase.co/auth/v1/callback`
5. In Supabase Google provider settings:
- enable Google
- paste the Google client ID
- paste the Google client secret
6. Test `Continue with Google` on the deployed app, not only localhost.

## Failure Map

- `Unsupported provider: provider is not enabled`
  - Google is still disabled in Supabase.
- Google login opens but access is denied for the user
  - the Google account is not listed as a test user while the OAuth app is in test mode.
- Google consent succeeds but the app does not finish login
  - check Supabase `Site URL`, redirect URLs, and the `redirectTo` target.
- Vercel deploy is green but the app is blank or routes fail
  - for a static SvelteKit app, use `outputDirectory: build` and rewrite all routes to `index.html`.

## Acceptance Check

- Google sign-in works on the public URL.
- The same account can log in on phone and desktop.
- A task created on one device appears on the other.
- An offline write syncs after the network returns.
