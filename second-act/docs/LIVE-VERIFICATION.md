# Qloo live verification

As of 16 October 2026:

- The organizer issued an event credential for **https://hackathon.api.qloo.com**.
- The hosted app stores `QLOO_API_KEY` as a secret, separate from the repository and downloadable source. Live calls are enabled for the granted event access; no paid resource is provisioned.
- Both `/search` and `/v2/insights` use the assigned origin with server-side `X-Api-Key` authentication. Requests do not follow redirects or retry against another origin.
- Provider tests and an actual workerd integration test pass against explicit response fixtures. They do not establish that the actual credential authenticates or that the default titles resolve unambiguously.
- **Authenticated verification is pending.** The coding workspace's proxy rejects connections to the Qloo host and deployed app with `Tunnel connection failed: 403 Forbidden`, before reaching either service. That is not a Qloo authentication response.

After allowing `hackathon.api.qloo.com` and `second-act-cinema-desk.likhithk085.chatgpt.site` in the workspace's network configuration, run:

```sh
python3 scripts/verify-live.py
```

The verifier reads the key from `QLOO_API_KEY` or a hidden terminal prompt, never a command argument. It checks exact movie searches, a bounded inventory Insights request and a full live recovery through the deployed app. It writes only sanitized entity identities, returned order, provider/tool status and outcome to ignored `work/live-verification.json`. No upstream error body is copied into the report.

Once the actual checks succeed, replace this pending status with the dated observations and any limitations. If the default demo has an ambiguous title, verify the intended year/identity and supply its Qloo UUID; do not choose the first fuzzy match or fabricate evidence.

The `/api/status` booleans indicate runtime configuration, not a successful live API test. Synthetic rights records and cohort descriptions remain demonstration inputs even when Qloo supplies live cultural ranks. The optional Nebius model is not configured.

## Deployed-runtime defect found and fixed

The entrant's first browser test returned a generic network failure. Production Worker logs showed `POST /api/recover` returning 502 after just 4 ms. The code used `redirect: 'error'`, which workerd rejects immediately; the catch handler then labeled that runtime exception a network error.

The adapter now uses `redirect: 'manual'`, and its existing non-2xx guard rejects a 3xx without following it or forwarding the credential. `npm run test:worker` runs the built application inside workerd with local provider fixtures: it reproduces the old unsupported option, executes search → Insights → recovery with the fix, and verifies a redirect cannot forward the key to another host. These are runtime checks, not authenticated Qloo evidence.

Primary implementation reference: https://github.com/cloudflare/workerd/blob/main/src/workerd/api/http.c%2B%2B — Request redirect validation accepts follow/manual and rejects error.
