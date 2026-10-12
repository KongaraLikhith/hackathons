# Second Act — Devpost draft

**Status:** draft for a local prototype. Live provider verification, public deployment, public repository, video, and Devpost submission are pending. Replace every bracketed field before publishing. Keep the limitations accurate after verification.

## Project name

Second Act

## Tagline

Recover a cancelled cinema screening with a replacement your audience can recognize—and your inventory permits.

## Inspiration

A film becomes unavailable just before a screening. The programmer has to find a replacement that fits the slot, the budget, and the rights already recorded in the cinema's inventory. The most popular remaining title may fit those operational constraints while losing the audience the evening was intended for.

Second Act brings that decision into one incident desk. It combines organizer-supplied screening constraints with cultural audience evidence, then makes the tradeoffs visible before anyone commits to a replacement.

## What it does

The current prototype starts with a clearly labeled cancellation scenario. The organizer imports a small inventory containing rights windows, territory, remaining screening counts, runtime, and fees. Second Act requires candidates to meet those constraints before it recommends a replacement. Demo inventory is synthetic; the organizer remains responsible for verifying the underlying contracts.

Audience cohorts are described through chosen cultural anchors such as films, books, or artists. In live mode, Qloo ranks the bounded imported film inventory for each cohort; the local engine recommends only candidates that pass the screening constraints. It preserves that returned-order evidence and balances the weakest cohort against the population-weighted mean through a visible fairness setting. By default, the ranking combines 70% of the minimum cohort index with 30% of the population-weighted mean. Rank evidence is a decision aid, not a prediction of attendance.

If there is no eligible replacement, the desk explains the blockers and proposes budget or runtime changes only for films that otherwise meet the requirements. It does not silently extend a rights window, change territory, invent screening permission, or increase the budget. The organizer must explicitly change a supported constraint; contract changes require verification outside the app.

An optional Nebius-hosted NVIDIA Nemotron step drafts an audience notice from the selected screening facts. The notice remains a draft for human review. It cannot grant rights or change the engine's constraints.

## How we built it

The implementation separates inventory validation and deterministic candidate selection from external provider calls. Qloo is used for the bounded cultural ranking task; the local engine handles screening eligibility and cohort tradeoffs. Evidence is not rescaled when a constraint removes a film. Entity resolution requires one exact normalized-name match or an organizer-supplied Qloo UUID; ambiguous names stop the live flow. Provider credentials stay on the server. The interface exposes where a recommendation came from and whether it uses live evidence or synthetic fixtures.

The Nebius entry targets **Best Apps and Agents** and uses `[exact NVIDIA model ID]` through `[verified Nebius Token Factory endpoint]`. Record the actual provider and model only after a successful live call.

**Built with:** JavaScript, Node.js, esbuild, `[final UI libraries if any]`, Qloo API `[verified live use]`, Nebius Token Factory `[verified live use]`, NVIDIA Nemotron `[exact model ID]`. Remove any provider from the built-with list until live use is demonstrated.

## Challenges

The hardest boundary is separating cultural similarity from operational permission. Qloo can supply ranked cultural evidence; it cannot certify a cinema's rights inventory. Second Act treats contract fields as organizer-supplied constraints and makes missing or conflicting evidence visible.

Cross-cohort ranking also needs care. Returned order is relative to a particular query, so the prototype does not present its derived ranking values as calibrated affinity, probability, or measured audience satisfaction. Sparse evidence and missing candidates must be shown rather than converted into confident claims.

## Accomplishments

The prototype centers a concrete cancellation decision: reject an ineligible film, compare remaining candidates across audiences, explain a blocked case, and prepare a notice without silently changing constraints.

`[After final verification: replace this paragraph with the specific implemented flow, test totals, and one redacted live request/response example. Do not insert projected metrics.]`

## What we learned

`[Complete after live API work and a real programmer interview. Include one specific finding that changed the design, not an invented user quote or outcome.]`

## What's next

The next validation step is to test the workflow with a cinema programmer using a permission-cleared cancellation case. We will compare the fairness-weighted choice with the population-weighted mean baseline, measure the time and corrections needed to reach a reviewable decision, and inspect whether the explanation helps the programmer challenge an unsuitable choice. No user-study results or attendance gains are claimed yet.

## Provider status and known limits

- No successful live Qloo or Nebius call has been established for this submission draft. Fixture ranks and inventory rows are fictional, not measured validation.
- The tool does not acquire rights, contact distributors, send audience notices, or execute a booking. A human verifies permissions and approves communications.
- Qloo rank is relative to each cohort's query. It does not establish screening demand, and a missing candidate is not proof that an audience dislikes it.
- The prototype is not a full cinema scheduling or accounting system. It addresses a bounded replacement incident with an imported inventory.
- Prior public projects cover cultural catalogue planning and constrained repair. We claim a specific cinema incident workflow, not global novelty.
- AI-assisted development was used: `[accurate tools and contribution summary]`. All entrant authorship, dependency licenses, and publication rights need final review.

## Links and entrant fields

| Field | Value to supply |
| --- | --- |
| Public working application | `[HTTPS URL]` |
| Public open-source repository and license | `[repository URL; license]` |
| Public YouTube demo, under three minutes | `[video URL]` |
| Entrant name / Devpost profile | `[name and profile]` |
| Team | Solo |
| Qloo entry | Primary; `[registered/submitted status]` |
| Nebius entry | Secondary; `[exact selected track and status]` |
| Verified provider evidence | `[redacted evidence path or link]` |

## Nebius tool feedback — complete after live use

Use concrete observations. Fill in the model and endpoint used, the task, one actual strength, one actual issue, and one actionable improvement. Record request latency and token usage only when measured.

`[Model]` handled `[incident or notice task]` through Token Factory. In `[specific example]`, it `[observed behavior]`. We encountered `[observed issue, or explicitly state none during limited testing]`. We would improve `[specific documentation, SDK, or runtime behavior]` because `[effect on this app]`.

## Before copying into Devpost

Follow [READINESS.md](READINESS.md), verify all claims against the running release, and delete editorial instructions and unused placeholders. Nothing in this draft means a public repository, video, or event submission has been created. A top-three placement is a goal, not an assurance.
