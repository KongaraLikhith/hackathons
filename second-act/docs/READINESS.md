# Second Act — release and submission checklist

As of 12 October 2026: local implementation is in progress; no live provider evidence, public release, video publication, or Devpost submission is recorded here. Checkboxes are obligations, not completed claims. Reconcile this document with the final release before publication.

## What we need from the entrant

- [ ] Qloo hackathon account and assigned event API key, requested through the [official event guide](https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide#getting-your-api-key). Configure `QLOO_API_KEY` as an environment secret, never in chat or source. Verify that the assigned credential supports the current `https://api.qloo.com` adapter; a different assigned host needs a reviewed adapter change before use.
- [ ] Nebius Token Factory account, server-side `NEBIUS_API_KEY`, an available NVIDIA Nemotron model ID configured as `NEBIUS_MODEL`, and confirmation of the credits actually granted. The adapter uses `https://api.tokenfactory.nebius.com/v1/chat/completions` and caps each draft at 300 output tokens. Use no paid overages. A key for a different provider does not satisfy the Nebius platform requirement.
- [ ] Public code-hosting account and repository target; public app hosting target that supports server-side secrets on a free tier or granted credits.
- [ ] Devpost entrant name/profile and confirmation that organizer/judge employment or family exclusions do not apply. US residence, age 24, and solo participation have been provided.
- [ ] An actual cinema programmer who can review a short cancellation case, if available. The entrant must authorize any outreach; none has been sent. Obtain permission before sharing real contract or audience data. Clearly synthetic inventory can be used for the technical demo.
- [ ] Final review of identity, authorship, open-source license, public app, repository, and video. No registration, public posting, or submission is claimed as complete.

## Functional acceptance

- [ ] Import the documented inventory format; show an actionable error for malformed dates, missing territory, invalid counts, negative fees, and ambiguous title/entity mapping.
- [ ] Exclude the cancelled title and every candidate failing the screening window, territory, remaining count, runtime, or budget. A missing required rights field must not pass.
- [ ] Confirm inclusive date boundaries, the selected territory semantics, fee units, and screening-count meaning in both the UI and documentation.
- [ ] Resolve movie/book/artist audience anchors to the intended Qloo entities through one exact normalized-name match or manually checked `qlooEntityId` values in the import. Ambiguous or missing matches must stop. Rank only the bounded imported inventory (maximum 20 films); recommend only eligible candidates.
- [ ] Preserve Qloo returned-order ranks and show missing evidence. Do not display derived ranking values as provider affinity or attendance probability.
- [ ] Exercise the 70% minimum-cohort / 30% population-weighted mean default and deterministic ties. Confirm the documented secondary order: minimum, mean, title, ID. Missing or invalid cohort evidence must fail closed.
- [ ] Exercise a no-feasible-candidate case. Propose only budget/runtime changes for otherwise eligible films and require explicit constraint changes. Changing a software setting must not imply a contract was amended.
- [ ] Review the generated notice against the selected title, date, and operational facts. Keep it a draft and prevent provider output from changing eligibility.
- [ ] Check keyboard navigation, visible labels, small-screen layout, loading states, double-click behavior, and recovery after a failed provider call.
- [ ] Refresh the public demo and repeat the full case in a clean browser session.

## Live provider and free-budget acceptance

- [ ] Verify the actual Qloo key/origin combination with a successful search and bounded inventory Insights request. Inspect the response schema; record returned entities and order without secrets.
- [ ] Verify a successful NVIDIA model call through Nebius. Record the exact endpoint and model ID. Confirm the task has an observable role in the final flow.
- [ ] Keep keys server-side. Check built assets, request URLs, repository history, screenshots, and demo footage for accidental key exposure.
- [ ] Show live, fixture, unavailable, and fallback states accurately. Provider failure must not silently become a claimed live result.
- [ ] Verify the free hosting quota and granted API credits. Configure a request/token cap and an explicit unavailable state when credits are absent or exhausted. Do not enable billed resources or paid overages under the free-only brief.
- [ ] Save redacted live evidence with timestamps, provider/model, scenario, outcome, and any warnings. Do not use screenshots alone to claim accuracy or user impact.

## Evaluation plan — results pending

Use deterministic scenario checks for correctness and a small programmer review for usefulness. Report the sample size and raw observations, including failures. Do not invent testimonials, percentage improvements, attendance gains, or performance measurements.

| Question | Test | Evidence to report |
| --- | --- | --- |
| Do hard constraints hold? | Cases at rights-window boundaries, wrong territory, exhausted count, oversized runtime, over-budget fee, missing fields, cancelled title. | Expected and actual exclusions, scenario count, failed cases. |
| Does the decision weight the weakest cohort as specified? | Fixed eligible inventory with one majority favorite and one stronger compromise; exact ties; missing ranks; cohort-size changes. | Per-cohort returned ranks, the 70/30 utility calculation, selected candidate, tie behavior, evidence gaps. Derived values are algorithm checks, not real audience outcomes. |
| Is fairness weighting material? | On the same case, compare the fairness-weighted choice with the population-weighted mean baseline, using the same provider evidence, inventory, and constraints. | What changed, why, and the programmer's assessment. Do not call the baseline independent popularity data or claim superiority without review. |
| Is cultural grounding useful? | Have a programmer review the live Qloo-grounded choice and its cultural anchors against their ordinary replacement process. | Which anchors and explanations helped or misled; observed corrections. This qualitative review does not establish attendance gains. |
| Is failure understandable? | Empty eligible inventory, Qloo timeout/invalid response, Nebius failure, zero granted credits. | UI state, preserved constraints, recovery steps, presence of honest provenance. |
| Does the workflow help a programmer? | Ask a permission-cleared cinema programmer to complete a real or realistic cancellation case. Observe before discussing the design. | Time to a reviewable decision, corrections, missing data, explanation usefulness, and exact sample size. No study has been completed yet. |
| Does the notice stay grounded? | Compare each model draft with the approved incident facts; try a case with missing information. | Unsupported assertions, omitted facts, required edits, provider/model used. |

Use this evidence to improve the product before the final video. A convincing entry needs a working provider-backed workflow, a clear distinction from related planners, and honest validation. It cannot guarantee a top-three result.

## Qloo submission — 30 October, 11:45 PM EDT

- [ ] Re-read [official rules](https://qloo.devpost.com/rules), confirm eligibility and the build window, and register the entrant.
- [ ] Complete the working Qloo integration and a public hosted application. Demonstrate the bounded resolve → rank → validate → repair tool workflow and its fit to the event's agentic-tool/framework/integration requirement. Fixture-only mode is insufficient.
- [ ] Publish the repository with the chosen open-source license, dependency notices, reproducible setup, and no secrets.
- [ ] Complete the description, accurate built-with list, screenshots, and all required Devpost fields. Review [SUBMISSION.md](SUBMISSION.md) against the running release.
- [ ] If including video, use the verified [DEMO.md](DEMO.md) flow and a public playable link.
- [ ] Confirm the entry is submitted—not merely saved as a draft—and retain the confirmation before the deadline.

## Nebius submission — 30 October, 1:00 PM EDT

- [ ] Re-read [official rules](https://nebiusglobalaihackathon.devpost.com/rules), confirm eligibility and track, and register the entrant.
- [ ] Use an eligible NVIDIA open model through Nebius Token Factory or AI Cloud in the working demo. Another provider does not substitute for this.
- [ ] Publish the open-source repository and working demo; verify links without an owner login.
- [ ] Publish a public YouTube demo **under three minutes**. Check playback, duration, and privacy settings.
- [ ] Submit specific, observed feedback about the model/platform tools; remove untested claims.
- [ ] Complete all entry fields, disclose actual AI assistance, submit, and retain confirmation before the deadline.

## Final publication check

- [ ] Recheck whether either event has changed its rules and whether cross-entry restrictions apply. Reviewed rules had no express cross-event ban; there is no affirmative organizer confirmation.
- [ ] Replace every bracketed placeholder; remove development-only instructions from the posted description.
- [ ] State synthetic data, provider status, unverified rights, and validation limits accurately.
- [ ] Verify app, repository, license, and video links from a clean browser.
- [ ] Record final commit/version, release URL, submission time, and Devpost confirmation separately for each event.

This checklist does not record completed external publication or certify a result. Record each actual release and submission separately after it occurs.
