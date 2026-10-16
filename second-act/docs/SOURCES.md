# Second Act — source notes

Reviewed 12 October 2026. Times below use America/New_York. These notes do not record registration, publication, or submission.

## Selected events

| Event | Submission deadline | Required final evidence |
| --- | --- | --- |
| [Qloo Agentic Hackathon](https://qloo.devpost.com/) — primary | 30 October 2026, 11:45 PM EDT | Working Qloo integration; public hosted application; public source with an open-source license; project description. Video is optional. |
| [Nebius × NVIDIA Global AI Hackathon](https://nebiusglobalaihackathon.devpost.com/) — secondary | 30 October 2026, 1:00 PM EDT | NVIDIA open model used through Nebius Token Factory or AI Cloud; public open-source repository; working demo; public YouTube demo under three minutes; specific tool feedback. |

- [Qloo official rules](https://qloo.devpost.com/rules): eligibility, build period, entry materials, intellectual property, and judging. The working app must integrate Qloo and function as an agentic tool, use an agent framework, or integrate Qloo into an existing agent. Technical implementation, design, impact, and idea are equally weighted.
- [Nebius official rules](https://nebiusglobalaihackathon.devpost.com/rules): eligibility, platform/model requirement, submission materials, and judging. Suggested track: **Best Apps and Agents**. Confirm the exact track label in the entry form.
- [Nebius FAQ](https://nebiusglobalaihackathon.devpost.com/details/faqs): account access and credit guidance. Granted credits must be verified; promotional availability is not assumed.
- [Nebius organizer guidance](https://nebiusglobalaihackathon.devpost.com/updates/46205-how-to-build-a-winning-project): AI-assisted development is encouraged. Disclose the assistance actually used.
- [Devpost multiple-event submission guidance](https://help.devpost.com/article/123-how-to-edit-a-submission): Devpost supports submitting a project to more than one event. No express cross-event prohibition was found in the reviewed Qloo/Nebius rules; this is not affirmative organizer confirmation.

The entrant reports US residence, age 24, solo participation, and a free-tools-only budget. Age and residence appear compatible with the reviewed rules. Organizer/judge employment exclusions and any other personal eligibility facts still need the entrant's confirmation. Recheck official rules before submitting.

## Qloo integration

- [Event API-key instructions](https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide#getting-your-api-key). This page was linked by the event but could not be fetched during research. The organizer subsequently assigned `https://hackathon.api.qloo.com`; the adapter now uses that exact origin. The key itself is not source material and is stored only as a runtime secret.
- [Qloo's official documentation mirror](https://github.com/qloo/docs-public).
- [Search](https://github.com/qloo/docs-public/blob/main/reference/get-search.md): resolve movie, artist, or book anchors to provider entities.
- [Insights parameters](https://github.com/qloo/docs-public/blob/main/reference/insights-api-deep-dive.md): rank a bounded film inventory with `signal.interests.entities`, `filter.results.entities`, and `filter.type=urn:entity:movie`.
- [API onboarding](https://github.com/qloo/docs-public/blob/main/reference/api-onboarding.md): server-side `X-Api-Key` authentication.
- [Basic Insights response](https://github.com/qloo/docs-public/blob/main/reference/basic-insights-use-case.md): ordered `results.entities` with names and entity IDs.
- [Affinity interpretation](https://github.com/qloo/docs-public/blob/main/docs/interpreting-affinity-scores.md): affinity is normalized per query. Preserve returned rank as evidence; do not call it attendance probability or compare unverified raw score fields across cohorts.

Exact explainability payloads and live responses remain to be validated with the event credential. A candidate missing from a response has no observed provider rank. Qloo does not establish screening rights, fees, or local availability.

## Nebius integration

- [Chat completion reference](https://docs.tokenfactory.nebius.com/api-reference/inference/create-chat-completion): `POST https://api.tokenfactory.nebius.com/v1/chat/completions` with an explicit model and token limit.
- [Model listing](https://docs.tokenfactory.nebius.com/api-reference/examples/list-of-models): verify the model ID available to the entrant's account.
- [NVIDIA Nemotron models](https://nebius.com/services/token-factory/models/nvidia-nemotron-models-inference) and [Nemotron family examples](https://nebius.com/services/token-factory/nemotron): current provider offerings. Documentation does not establish account-specific model access or credit availability.

## Prior art and the claim we can support

- [Culture Weave](https://github.com/EazyHood/culture-weave): finite cultural catalogue planning with budget, duration, permissions, and repair after a film becomes unavailable. This is relevant overlap.
- [MeetSpot](https://devpost.com/software/meetspot-group-taste-fairness): group taste fairness and fixed candidate ranking.
- [Common Ground](https://github.com/sweetcornna/common-ground-qloo): overlapping group cultural recommendation direction.
- [Qloo current gallery](https://qloo.devpost.com/project-gallery): unpublished during research, so a complete competitor comparison was unavailable.

Second Act's intended distinction is a cinema cancellation incident desk: organizer-supplied contract rows, screening windows, territory, remaining screening counts, replacement decisions, and a reviewable audience action pack. A limited public search found no exact match for that workflow. Do not claim global novelty, actual cinema partnerships, improved attendance, or verified distribution rights.
