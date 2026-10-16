# Second Act

An incident desk for independent cinemas: when a programmed film becomes unavailable, recover the evening using cultural evidence and an organizer-reported rights catalog.

The working prototype includes a responsive recovery workspace, CSV rights ledger, editable audience anchors, transparent ranking, explicit budget/runtime repair proposals, withdrawal simulation, audience notice drafts and downloadable JSON evidence packs. It never secures rights, books a film or sends a notice.

## Run locally

Node 20+, Python 3 and npm are required.

```sh
npm ci
npm test
npm run test:worker
npm run build
npm run dev
```

Open http://127.0.0.1:4173. The dependency-free application is packaged as one Cloudflare-compatible ESM Worker. esbuild is a build-time dependency; Miniflare/workerd is a test-only dependency. The hosted worker serves all assets itself and uses no database.

## Evidence modes

Sample mode works without accounts. Its audience, contract records, prices and support indices are fictional, visibly labeled demonstration data. Film titles identify cultural entities; they do not imply actual screening availability. Original abstract covers contain no third-party poster images. Imported titles or changed taste anchors receive no invented sample evidence.

Live mode uses the assigned `https://hackathon.api.qloo.com` server and resolves exact named Qloo movie/artist/book entities (or organizer-provided Qloo UUIDs), requests movie insights for the supplied inventory separately for each audience cohort, then uses the returned order as a relative rank index. An ambiguous name fails and requires an explicit UUID. Missing results remain missing evidence. Upstream results outside the requested catalog fail closed.

Qloo results are normalized per query, so this app never compares raw cross-query affinities. It uses relative rank indices (first 100, last 0; singleton 100). This pragmatic ordinal heuristic is not a calibrated probability or a measured audience effect. The default utility is 70% minimum cohort index plus 30% cohort-size-weighted mean. An explicit baseline chooses the highest population-weighted mean from the same eligible catalog. Scores remain stable when constraints remove films from the supplied catalog.

## Server secrets and the free-only budget

Configure runtime secrets QLOO_API_KEY and optionally NEBIUS_API_KEY. Set NEBIUS_MODEL to an available NVIDIA Nemotron model copied from the account catalog. No key is sent to the browser or committed.

Set LIVE_CALLS_ENABLED=true only after confirming granted free credits/quotas and configuring provider account spending limits. There is no paid service provisioning. Live calls stay disabled by default. The worker has a conservative per-isolate hourly guard, not a distributed billing limit. A recovery contains up to20 catalog searches, six anchor searches and three Insights calls, at most four concurrent. A Nemotron draft has a300-output-token cap. Provider and free-credit limits must be checked before enabling public live access.

For local development, export those variable names in your shell or use your trusted secret manager before npm run dev. See .env.example for names; the app does not load .env files automatically. Never paste keys into the browser, commit them, or include them in a recovery export.

The organizer-issued Qloo key was configured as a hosted runtime secret on 16 October 2026, with live mode enabled for the hackathon allowance. Authenticated calls remain unverified: this coding workspace blocks outbound connections to the Qloo host and deployed app before either service is reached. The app reports credential configuration, not successful authentication. Node tests and a workerd integration check with local provider fixtures establish adapter/runtime behavior, not provider account compatibility. No Nebius credential is configured. The current Nebius integration drafts a notice from supplied facts; it does not decide the replacement or guarantee accurate prose. Review drafts before use.

The first public live test exposed a Worker runtime incompatibility: workerd rejects `redirect: error` before making a request. The adapter now uses `redirect: manual` and rejects any returned 3xx explicitly. The Worker-runtime regression suite exercises the built live-mode path against fixtures and checks that redirects never forward the key.

## Catalog import

Export the example CSV from Rights ledger as a template. Each row requires id,title,runtime,cost,available,rightsConfirmed,rightsStart,rightsEnd,territory,screeningsRemaining; qlooEntityId is optional. Availability and rightsConfirmed are true/false; windows use YYYY-MM-DD. The app accepts up to20 titles, three cohorts and two anchors per cohort. The server requires a complete ledger and checks recorded availability, rights acknowledgment, date window, territory, remaining screening count, runtime, budget and cancellation exclusion. These checks evaluate user input and do not establish legal screening permission.

The example incident is fixed at The Lantern Cinema: Moonrise Kingdom is unavailable for October24,2026. The prototype recovers one screening. It is not a rights-management integration, booking engine, supplier API or multishow scheduler. Contact the distributor before acting.

## Callable recovery tool

GET /agent-tools.json exposes the JSON tool contract. POST /api/recover is the bounded resolve → gather → validate → rank → propose-repair loop. It accepts mode,inventory,cohorts,constraints,excludedIds,fairness; omitted catalog/audience/constraints use the example. There are no external action side effects. POST /api/notice creates an optional AI draft. GET /api/status discloses configuration booleans only.

```sh
curl http://127.0.0.1:4173/api/recover \
  -H 'Content-Type: application/json' \
  -d '{"mode":"sample"}'
```

The browser optionally registers the recovery action with WebMCP when document.modelContext is supported. No browser capability is required for ordinary use.

## Hackathon targets and remaining work

Primary: Qloo Agentic Hackathon, October30,2026,11:45pm Eastern. The optional Nebius entry is paused because standard onboarding requires a payment card; no paid service is provisioned. Read docs/SOURCES.md and the official rules before submission.

The app and MIT source are public at https://second-act-cinema-desk.likhithk085.chatgpt.site and https://github.com/KongaraLikhith/hackathons/tree/main/second-act. Remaining Qloo work: verify authenticated calls, review entrant eligibility/affiliation and project claims, then finalize and submit the Devpost entry. The entrant has registered and created a draft; final submission is not recorded. Qloo does not require a video. A top-three finish cannot be guaranteed.

Run `python3 scripts/verify-live.py` with a configured environment secret or hidden key prompt after permitting the two network hosts. It records sanitized search, Insights and full-app checks in `work/live-verification.json`. See docs/LIVE-VERIFICATION.md for the current evidence status.

See docs/SUBMISSION.md for a draft, docs/DEMO.md for narration, docs/READINESS.md for the release checklist. Source is MIT licensed. AI coding assistance was used; entrant should review and understand the code and confirm ownership/participation representations.
