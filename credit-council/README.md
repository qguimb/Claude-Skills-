# Credit Council (experimental)

A minimal three-agent council packaged as a Claude plugin. It is kept in its own folder, separate from the other skills.

```
credit-council/
├── .claude-plugin/plugin.json      # plugin manifest
├── agents/
│   ├── steelman.md                 # argues FOR the position
│   ├── challenger.md               # argues AGAINST the position
│   └── arbiter.md                  # weighs both, delivers the verdict
├── skills/credit-council/SKILL.md  # orchestrator: frame → parallel debate → verdict
└── examples/test-prompt.md         # prompts to try it out
```

## How it works

```
            ┌──────────── brief pack (position + context) ────────────┐
            ▼                                                         ▼
      Steelman (FOR)                                         Challenger (AGAINST)
            │                  run in parallel, blind                 │
            └──────────────────────────┬──────────────────────────────┘
                                       ▼
                         Arbiter (fact-check, weigh, verdict)
                                       ▼
                          Verdict + scorecard + triggers
```

1. The skill turns the request into one falsifiable position with a horizon.
2. Steelman and Challenger receive identical inputs and run at the same time, without seeing each other.
3. The Arbiter receives both briefs verbatim, checks the figures that matter, and makes a call.

## Try it

**Claude chat (e.g. inside a Project):** upload `credit-council-skill.zip` in Settings → Capabilities → Skills. Then, in a chat inside your Project, write "Council this: [position]". The skill reads the Project's files as context. In chat the three roles usually run one after another in the same conversation rather than as separate agents (see the note below). Run `./build-chat-skill.sh` to rebuild the zip after editing the agent or skill files.

> Independence note: in chat, the Steelman is written after the Challenger in the same context, so it is not fully blind. Claude Code and Cowork run the roles as separate sub-agents, which keeps them independent.

**Claude Code (most control):**

```bash
git clone https://github.com/qguimb/Claude-Skills-.git
cd Claude-Skills-
claude --plugin-dir ./credit-council
```

Then paste Test 1 from `examples/test-prompt.md`. Run `/agents` to confirm the three agents are loaded.

Before you start, check that `ANTHROPIC_API_KEY` is **not** set (`echo $ANTHROPIC_API_KEY` should print nothing). If it is set, Claude Code bills the API instead of your subscription.

**Cowork / claude.ai:** zip the contents of the `credit-council/` folder (so `.claude-plugin/` sits at the root of the zip) and upload it as a custom plugin. Then use the same test prompt. If sub-agents are unavailable, the skill falls back to playing the three roles one after another.

## Tuning ideas (after the first test)

- **Different model per role:** change `model: inherit` in an agent's frontmatter to `opus`, `sonnet` or `haiku`. A common pattern is a stronger model on the Arbiter and a different one on the Challenger to reduce shared blind spots.
- **Plug in house style:** have the Arbiter's final write-up load the `credit-note-style` skill.
- **Sector lenses:** give the Challenger a sector checklist, like the one in `credit-catalyst-identifier`.
- **Second round:** let each debater answer the other's brief once before the Arbiter rules. This costs more usage and weakens independence, so test it only if round-one briefs feel shallow.
