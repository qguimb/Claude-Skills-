# Test prompts

Start with Test 1. It needs no documents, so it only checks that the three agents launch, stay in their roles and hand off correctly.

## Test 1: smoke test (no documents)

```
Run the credit council on this position: "A BBB-rated European toll-road
operator with net debt/EBITDA of 4.5x, a downgrade trigger at 5.0x, 18 years
of remaining concession life and a new €1bn acquisition it plans to fund
50/50 with debt and cash will keep its BBB rating over the next 12 months."
```

What to check:
- The Steelman and Challenger start at the same time (in Claude Code you see two agents running together).
- Neither brief refers to the other.
- The Challenger does the leverage math on the acquisition (€500m of new debt against the 0.5x headroom).
- The Arbiter's scorecard names a winner for each point and does not simply average them.
- No invented figures: anything not given in the prompt should be flagged as "not provided" or sourced.

## Test 2: real name, with documents

Attach a recent results release or rating report and run:

```
Council this: the [ISSUER] [MATURITY] senior notes are attractive at
[PRICE / SPREAD] on a 12-month view. Documents attached.
```

What to check: figures in all three outputs trace back to the attached documents, and the Arbiter's "Facts checked" line lists what it verified.

## Test 3: compare with a single-prompt answer

Ask the same Test 1 question in a fresh chat without the council ("Will this company keep its BBB rating?"). Compare the two answers. Does the council's answer surface risks or conditions that the single answer missed? This is the real test of whether the extra usage is worth it.

## Test 4: your own catalysts against an annual report (Claude Code)

Put the files in a working folder outside this repo, for example:

```
~/credit/ISSUER/
├── annual-report-2025.pdf
└── catalysts.md        # your three catalysts, numbered 1-3
```

From that folder, start Claude Code with the plugin loaded and run:

```
Council these catalysts for [ISSUER] on a 12-month view.
Catalysts: @catalysts.md
Evidence: annual-report-2025.pdf (in this folder)
For each catalyst, tell me whether to keep, recalibrate or replace it.
```

What to check:
- The orchestrator builds a Document map (page ranges per topic) before launching the agents.
- Every figure in the briefs cites a page number.
- The Arbiter gives a Keep / Recalibrate / Replace verdict per catalyst and rewrites any it changes.
- Whether the Challenger proposes a "Missing catalyst", and whether the Arbiter accepts it.
