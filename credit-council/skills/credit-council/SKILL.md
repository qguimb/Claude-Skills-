---
name: credit-council
description: "Convene a three-member council (Steelman, Challenger, Arbiter) to stress-test a credit view, trade idea or investment decision from opposing sides before reaching a verdict. MANDATORY TRIGGERS: 'council this', 'run the council', 'convene the council', 'credit council', 'LLM council'. STRONG TRIGGERS: 'argue both sides', 'bull vs bear on this', 'steelman and challenge', 'should I buy/sell/hold these bonds', 'is this view right', 'debate this'. Do NOT trigger for factual lookups, single-document extraction, or premortems (use the premortem skill when the user wants failure analysis rather than competing perspectives)."
---

# Credit Council

Claude tends to agree with whoever is asking. Ask "is this a good trade?" and it will find reasons to say yes. The council counters this by splitting the analysis across three roles with fixed prompts:

| Role | Job | Sees |
|---|---|---|
| **Steelman** | Strongest honest case FOR the position | Position and context |
| **Challenger** | Strongest honest case AGAINST the position | Position and context |
| **Arbiter** | Weighs both briefs, checks facts, delivers a verdict | Position, context and both briefs |

The Steelman and Challenger work in parallel and never see each other's brief. This independence is what makes the council useful. If one side read the other first, it would anchor on it.

The same approach appears publicly as "LLM council" or "multi-agent debate" patterns: independent answers first, then a judge that reviews them. This skill adapts it to buy-side credit work.

---

## Step 1: Frame the position

The council needs a position to argue about, not an open question. Turn the user's request into one falsifiable sentence.

- "What do you think of Vinci?" becomes "Vinci's credit quality will be stable or improving over the next 12 months."
- "Should I buy the 2029s at 94?" becomes "The 2029 senior notes are attractive at a price of 94."

Minimum context before you convene:

1. **The position**: one sentence, falsifiable.
2. **The horizon**: when the view should be judged (default: 12 months, and say so).
3. **The evidence**: documents, figures, or at least the issuer name so the members can research.

Scan the conversation and any attached files first. Ask the user only for what is missing, one question at a time. If everything is available, do not ask. State the framed position back to the user in one line and proceed.

## Step 2: Build the brief pack

Assemble one context block that both debaters receive, word for word:

```
POSITION: [one sentence]
HORIZON: [e.g. 12 months]
CONTEXT:
[user's framing, constraints, relevant figures, and file paths or pasted document text]
```

Give both debaters identical inputs. Do not include your own opinion.

## Step 3: Run the debate (parallel)

**With sub-agents available (Claude Code, Cowork):** launch the `steelman` and `challenger` agents from this plugin **in the same turn, in parallel**. (In Claude Code they may appear namespaced as `credit-council:steelman` and `credit-council:challenger`.) Pass each the brief pack from Step 2 and nothing else.

**Without sub-agents (plain chat):** play each role yourself, one at a time. Write the Challenger brief first, then the Steelman brief. Follow each role's instructions and output format exactly. They are in `agents/<role>.md` in the plugin, or in `roles/<role>.md` next to this file when the skill was uploaded on its own. Do not let the second brief respond to the first.

## Step 4: Run the Arbiter

Once both briefs are back, launch the `arbiter` agent with:

```
POSITION: ...
HORIZON: ...
CONTEXT: [same as Step 2]

STEELMAN BRIEF:
[verbatim]

CHALLENGER BRIEF:
[verbatim]
```

Pass the briefs verbatim. Do not summarise or edit them, since the Arbiter has to judge the arguments as written.

Without sub-agents, write the Arbiter verdict yourself following the Arbiter role file (`agents/arbiter.md` or `roles/arbiter.md`), and make a genuine effort to judge rather than average.

## Step 5: Report to the user

Present the output in this order:

1. **Verdict** (from the Arbiter): verdict line, confidence and the "Why" paragraph.
2. **Scorecard** table.
3. **What would change the verdict**: the monitoring triggers.
4. **The two briefs**, in full, under collapsible headings or clearly separated sections, so the user can audit the reasoning.

End with one line on what extra input would most improve the next run (for example "A rating agency report would let the council quantify trigger headroom").

---

## Important notes

- **Independence is the product.** Never show one debater the other's brief. Never run them sequentially in the same agent when sub-agents are available.
- **Fixed roles.** Do not soften the Challenger or temper the Steelman. Each should argue its side fully. Balance comes from the Arbiter.
- **No invented figures.** Any member that lacks a number must say "not provided". Pass this rule on and enforce it when you relay the output.
- **Cost.** A council run costs roughly three to four normal exchanges (more with web search). Use it for decisions that matter, not for quick questions.
- **Not a premortem.** The premortem skill assumes the plan failed and works backward. The council argues both sides of a decision today. If the user wants blind spots in a plan they have already committed to, suggest the premortem instead.
