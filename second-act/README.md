# Second Act

An incident desk for independent cinemas: when a programmed film becomes unavailable, recover the evening using cultural evidence and an organizer-reported rights catalog.

The working prototype includes a responsive recovery workspace, CSV rights ledger, editable audience anchors, transparent ranking, explicit budget/runtime repair proposals, withdrawal simulation, audience notice drafts and downloadable JSON evidence packs. It never secures rights, books a film or sends a notice.

## Run locally

Node 20+, Python 3 and npm are required.

```sh
npm ci
npm test
npm run build
npm run dev
```

Open http://127.0.0.1:4173. The dependency-free application is packaged as one Cloudflare-compatible ESM Worker. esbuild is a build-time dependency. The hosted worker serves all assets itself and uses no database.

## Evidence modes

Sample mode works without accounts. Its audience, contract records, prices and support indices are fictional, visibly labeled demonstration data. Film titles identify cultural entities; they do not imply actual screening availability. Original abstract covers contain no third-party poster images. Imported titles or changed taste anchors receive no invented sample evidence.

Live mode resolves exact named Qloo movie/artist/book entities (or organizer-provided Qloo UUIDs), requests movie insights for the supplied inventory separately for each audience cohort, then uses the returned order as a relative rank index. An ambiguous name fails and requires an explicit UUID. Missing results remain missing evidence. Upstream results outside the requested catalog fail closed.

Qloo results are normalized per query, so this app never compares raw cross-query affinities. It uses relative rank indices (first 100, last 0; singleton 100). This pragmatic ordinal heuristic is not a calibrated probability or a measured audience effect. The default utility is 70% minimum cohort index plus 30% cohort-size-weighted mean. An explicit baseline chooses the highest population-weighted mean from the same eligible catalog. Scores remain stable when constraints remove films from the supplied catalog.

## Server secrets and the free-only budget

Configure runtime secrets QLOO_API_KEY and optionally NEBIUS_API_KEY. Set NEBIUS_MODEL to an available NVIDIA Nemotron model copied from the account catalog. No key is sent to the browser or committed.

Set LIVE_CALLS_ENABLED=true only after confirming granted free credits/quotas and configuring provider account spending limits. There is no paid service provisioning. Live calls stay disabled by default. The worker has a conservative per-isolate hourly guard, not a distributed billing limit. A recovery contains up to20 catalog searches, six anchor searches and three Insights calls, at most four concurrent. A Nemotron draft has a300-output-token cap. Provider and free-credit limits must be checked before enabling public live access.

For local development, export those variable names in your shell or use your trusted secret manager before npm run dev. See .env.example for names; the app does not load .env files automatically. Never paste keys into the browser, commit them, or include them in a recovery export.

Actual authenticated provider calls have not been verified in this build because account keys are pending. Mocked tests establish adapter behavior, not provider account compatibility. The current Nebius integration drafts a notice from supplied facts; it does not decide the replacement or guarantee accurate prose. Review drafts before use.

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

Primary: Qloo Agentic Hackathon, October30,2026,11:45pm Eastern. Secondary: Nebius × NVIDIA Global AI Hackathon, October30,2026,1pm Eastern. Read docs/SOURCES.md and the official rules before submission.

This is a working sample prototype with provider adapters and submission drafts, not an event-ready submission yet. Remaining requirements: verified live Qloo calls, verified NVIDIA model calls on Nebius for the second event, externally public demo, public open-source repository, eligibility/affiliation confirmation, and a publicly visible YouTube demo under three minutes for Nebius. Qloo does not require a video. Neither entry has been submitted. A top-three finish cannot be guaranteed.

See docs/SUBMISSION.md for a draft, docs/DEMO.md for narration, docs/READINESS.md for the release checklist. Source is MIT licensed. AI coding assistance was used; entrant should review and understand the code and confirm ownership/participation representations.
