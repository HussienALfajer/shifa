# Building a large greenfield product with Claude Code: Anthropic's methodology (research notes)

- **As of:** 2026-11-08. Web research only. No local files were read.
- **Target context:** a multi-tenant healthcare SaaS. TypeScript monorepo (NestJS API, PostgreSQL with RLS, React SPA, Next.js) plus a Flutter app. One owner, possibly a small team later. Claude Code (default model Claude Opus 5.5) writes nearly all code.
- **Labels used throughout:**
  - **[F]** = a fact stated by the cited source.
  - **[I]** = my inference, synthesis or recommendation. It is not stated by the source.
  - **[U]** = unverified. It comes from a secondary source or from memory and was not confirmed against a primary source in this session.
- **Living docs:** pages on code.claude.com and platform.claude.com carry no publication date. They are cited as "docs, accessed 2026-11-08". Several older Anthropic engineering URLs now redirect to these living docs. The original Apr 2025 best-practices post, for example, now redirects to the docs page.

---

## 0. TL;DR: the ten things Anthropic says most consistently

1. **Give Claude a pass/fail check it can run.** That means tests, typecheck, lint, a build, or a browser screenshot. Ask it for *evidence*, not claims. This is the single most repeated piece of advice, from Boris Cherny (Jan 2026), the best-practices docs, the Agent SDK post and the harness posts. [F]
2. **Write down only what Claude can't find by reading the repo.** Keep CLAUDE.md short (under ~200 lines). Use path-scoped rules and per-package files, and put procedures in skills. [F]
3. **Rules that must never bend go into the harness, not the prompt.** Use hooks, deny rules, the sandbox, branch protection and CI. CLAUDE.md is for guidelines. [F]
4. **Spec/plan first for non-trivial work.** Have Claude interview you, write a SPEC.md, then build from a fresh session. Use plan mode. A planner is still load-bearing in Anthropic's own long-running harness (Mar 2026). [F]
5. **Use an independent reviewer.** Use a fresh-context subagent, `/code-review`, a second session, or managed Code Review. Review against the spec and "skip style". Self-evaluation is biased. [F]
6. **Work incrementally.** One feature per session or sprint, commit often, leave a clean state. Keep progress files and a feature list for multi-session work. [F]
7. **Context hygiene still matters, for quality and cost more than for capacity.** Use `/clear` between unrelated tasks, and after two failed corrections clear and re-prompt. Use subagents for noisy side work. [F]
8. **Parallelize with isolation.** Use worktrees and background sessions. Use `/batch` or dynamic workflows for mechanical fan-out. Multi-agent costs many more tokens, so use it only where work is genuinely independent. [F]
9. **Containment over approval clicks.** Use sandbox plus deny rules plus auto mode. Credentials should never enter the agent's environment. [F]
10. **Prune the harness as models improve.** Instructions and scaffolding written for older models now cause harm, such as over-verification and over-application of rules. Re-audit after model upgrades. [F]

---

## 1. Model and product timeline relevant to these notes (2025–2026)

| Date | Event | Notes |
|---|---|---|
| 2025-09-29 | Claude Code 2.0 features (checkpoints/rewind, VS Code ext, subagents, hooks, background tasks); Claude Code SDK renamed **Claude Agent SDK** | [F] anthropic.com/news/enabling-claude-code-to-work-more-autonomously |
| 2025-10-16 | Agent Skills launched; published as an **open standard** 2025-12-18; donated to the Agentic AI Foundation 2026-10-22 | [F] |
| 2025-10-20 | Claude Code sandboxing; Claude Code on the web | [F] |
| 2025-11-24 | Claude Opus 4.5 era (Boris used Opus 4.5 with thinking for everything in Jan 2026) | [F] for Boris's usage; model date [U] |
| 2026-02-05 | Opus 4.6 used for the C-compiler experiment | [F] |
| 2026-02-20 (approx.) | Claude Code Security (research preview), built on Opus 4.6 | [F] secondary press; date varies Feb 20–23 |
| 2026-03-09 | **Code Review for Claude Code** (multi-agent PR review), research preview, later GA | [F] |
| 2026-03-25 | **Auto mode** (classifier-approved actions) | [F] |
| 2026-03/04 | Opus 4.7 referenced in the Apr 23 postmortem; Opus 4.8 referenced in later docs | [F] |
| 2026-07-24 | Claude Opus 5 | [U] secondary coverage only; official page not retrieved |
| 2026-09-15 | Claude Mythos 5.1 and Fable 5.1 ("most advanced models for coding and knowledge work") | [F] news listing |
| 2026-09-22 | **Claude Opus 5.5** (`claude-opus-5-5`), first of the 5.5 family; $4/$20 per MTok; fast mode; thinking always on | [F] anthropic.com/claude-opus-5-5 |
| 2026-09-28 / 2026-10-07 | Sonnet 5.5 / Haiku 5.5 | [F] |
| current docs | Claude Code defaults: **auto mode**, **Opus 5.5 at medium effort**, auto-delegation to subagents (fork mode on), auto-compaction, ~1M context on most current models | [F] code.claude.com/docs/en/best-practices |

---

## 2. Anthropic sources: catalogue with actionable guidance

### 2A. Anthropic Engineering blog (anthropic.com/engineering)

**Claude Code: Best practices for agentic coding** (2025-04-18; the URL now 308-redirects to the living docs page code.claude.com/docs/en/best-practices, accessed 2026-11-08)
- [F] The current version is organised around four failure causes:
  - Claude can't see something, so tell it.
  - It has no check, so give it one.
  - A rule must never bend, so enforce it.
  - A default costs too much, so change it.
- [F] It distinguishes **non-deterministic** instructions (prompt, CLAUDE.md, skills) from **deterministic** ones (hooks, deny rules, sandbox, managed settings, CI, branch protection). If you keep adding emphasis to a CLAUDE.md line, that line belongs in a hook.
- [F] The interview pattern: "Interview me until you could write the spec, then write it to SPEC.md". Build from it in a *fresh* session, then review the diff against SPEC.md with a subagent, and "skip style".
- [F] Steering: watch the first minute and press `Esc` on drift. Use `/rewind` and checkpoints, but note that checkpoints don't cover Bash-made file changes. After two failed corrections, `/clear` and write a better prompt.
- [F] "Five questions before an unattended run":
  - Does it know what done looks like?
  - Can it check its work?
  - What may it touch?
  - What stops it (`--max-turns`, `--max-budget-usd`)?
  - Who signs off on the result?
- [F] A "What you can stop doing" table (Sec. 4.14 below) retires older advice: ALL-CAPS emphasis, "think harder", "don't be lazy", subagents for context protection, and architecture essays in CLAUDE.md.

**How we built our multi-agent research system** (2025-06-13)
- [F] Orchestrator-worker. Opus 4 lead with Sonnet 4 workers beat single-agent Opus 4 by 90.2% on research evals. Token use explains ~80% of variance. Multi-agent costs ~15x chat tokens.
- [F] Multi-agent is a **poor fit for most coding** (shared context, many dependencies).
- [F] Subagent briefs need four things: an objective, an output format, tool and source guidance, and boundaries. Scale effort to complexity. Write outputs to the filesystem and pass references to avoid a "game of telephone".
- [F] Evals: start with ~20 real queries, use an LLM judge with a rubric, grade outcomes not paths, and keep human testing.

**Writing effective tools for agents — with agents** (2025-09-11)
- [F] Prototype tools, then run realistic multi-step evals. Have Claude analyse transcripts and refactor the tools.
- [F] Build fewer, consolidated tools, prefer search over list, and namespace them. Return high-signal fields and paginate or truncate. Write actionable error messages, and describe tools as you would to a new hire.
- [I] Relevance here: your own internal CLIs and scripts (seed data, tenant fixtures, migration runners) *are* the agent's tools. Make their output short and their errors actionable.

**A postmortem of three recent issues** (2025-09-17)
- [I] Low relevance. Infrastructure bugs degraded quality. Lesson: keep your own evals or regression checks so you notice regressions.

**Effective context engineering for AI agents** (2025-09-29)
- [F] Context is a finite "attention budget" and suffers "context rot". Find the "smallest set of high-signal tokens".
- [F] System prompts should sit at the "right altitude": neither brittle if-else rules nor vague guidance. Use a few canonical examples rather than long lists of edge-case rules.
- [F] Just-in-time retrieval: keep references (paths, queries) and load data on demand. Claude Code is the hybrid model: CLAUDE.md up front, glob and grep on demand.
- [F] Long-horizon techniques:
  - Compaction keeps decisions and unresolved bugs and drops redundant tool output.
  - Structured note-taking (NOTES.md, to-dos).
  - Subagents return 1–2k-token summaries.

**Equipping agents for the real world with Agent Skills** (2025-10-16; open standard 2025-12-18)
- [F] A skill is a folder with SKILL.md (frontmatter `name` and `description`). It uses progressive disclosure:
  - L1: name and description always loaded.
  - L2: SKILL.md loaded when relevant.
  - L3: linked files loaded only when needed.
- [F] Bundle deterministic scripts and say whether to run or read them. Iterate on the description, since it drives triggering. Capture successes and mistakes back into the skill.
- [F] Security: install only from trusted sources, and audit scripts and network instructions.

**Beyond permission prompts: making Claude Code more secure and autonomous** (2025-10-20)
- [F] You need both filesystem *and* network isolation. Without network isolation, keys can leak. Without filesystem isolation, the sandbox can be escaped.
- [F] Sandboxed bash cut permission prompts by 84% internally. Cloud sessions keep credentials outside the sandbox, with a git proxy.
- [F] Action: run `/sandbox`.

**Code execution with MCP** (2025-11-04)
- [F] Expose MCP tools as code APIs and load them on demand. One example went from 150k to 2k tokens (98.7% less).
- [F] Intermediate data stays out of context, and PII can be tokenised before the model sees it.
- [F] Generated code needs sandboxing and monitoring.

**Introducing advanced tool use** (2025-11-24)
- [F] Tool Search: ~85% less tool-definition context, and MCP accuracy 49% → 74%. Use it with 10 or more tools.
- [F] Programmatic Tool Calling: 37% fewer tokens.
- [F] Tool Use Examples: complex-parameter accuracy 72% → 90%.
- [F] Claude Code now defers MCP schemas through tool search by default. Note that this is disabled under the HIPAA configuration (docs).

**Effective harnesses for long-running agents** (2025-11-26, Justin Young)
- [F] Even Opus 4.5 in a loop failed to build a production-quality app from one prompt. It over-reached and then declared victory early.
- [F] Fix: an **initializer** session that writes `init.sh`, `claude-progress.txt`, a **JSON feature list** (200+ features, all `passes:false`) and a first commit. Then **coding sessions** each do *one* feature.
- [F] Each coding session follows a fixed start routine: `pwd`, read git log and progress, pick the top failing feature, run `init.sh` plus a basic end-to-end check. Agents may only flip `passes`; editing or removing tests is forbidden. JSON was chosen over Markdown because models overwrite it less.
- [F] End-to-end testing through browser automation (Puppeteer MCP) "as a human user would" substantially reduced premature "done" claims.
- [F] Each session ends with a descriptive commit and a progress update ("clean state").

**Demystifying evals for AI agents** (2026-01-09)
- [F] For coding, use deterministic tests as the primary grader, plus an LLM rubric for quality and static analysis. Grade outcomes, not step order.
- [F] Start with 20–50 tasks drawn from real failures. Turn bug reports into test cases. Distinguish capability evals from regression evals (~100% pass), and isolate trials so state can't leak.
- [F] pass@k vs pass^k: for consistency use pass^k (75% per trial ≈ 42% across 3 trials). If many trials fail, suspect the task or grader. Read transcripts.

**Designing AI-resistant technical evaluations** (2026-01-21)
- [I] Low relevance (hiring take-homes). Skipped beyond noting it exists.

**Building a C compiler with a team of parallel Claudes** (2026-02-05, Nicholas Carlini)
- [F] Setup: ~2,000 Claude Code sessions over two weeks, Opus 4.6, ~$20k, ~100k lines of Rust. The compiler builds Linux 6.9 on 3 architectures.
- [F] Harness: an infinite loop of fresh sessions in containers, a bare git upstream, and a `current_tasks/` lock file per task. No orchestrator.
- [F] **Tests must be nearly perfect**, or agents solve the wrong problem.
- [F] Keep test output short, with full logs in files and `ERROR` on one grep-able line. Provide a deterministic `--fast` random 1–10% subset per agent. Keep extensive READMEs and progress files, written for an agent with no context.
- [F] Role agents handled dedup, performance, design critique and docs. CI was added late, after new features kept breaking old ones. That was a lesson: add CI early.
- [F] For monolithic tasks, use a **known-good oracle** (GCC) so parallel agents hit different bugs.

**Quantifying infrastructure noise in agentic coding evals** (2026-02-05)
- [F] Resource limits alone moved Terminal-Bench scores by up to 6 points. Treat benchmark gaps under 3 points as noise.
- [I] Don't over-read model leaderboard deltas.

**Harness design for long-running application development** (2026-03-24, Prithvi Rajasekaran)
- [F] Architecture: **planner → generator → evaluator** (GAN-inspired).
  - The planner expands a 1–4 sentence prompt into a product spec focused on deliverables, not granular technical detail, so spec errors don't cascade.
  - The generator builds one feature per sprint with git.
  - The evaluator uses Playwright to click through the running app and check API and DB state, failing a sprint when any criterion falls below its hard threshold.
- [F] **Sprint contracts**: before each sprint, the generator and evaluator agree in files on what will be built and how it will be verified (27 criteria in one sprint).
- [F] Self-evaluation is biased. A separately tuned skeptical evaluator is easier to build than a self-critical generator. Out of the box, the evaluator "talked itself into approving", so its prompt was calibrated against human judgment.
- [F] With Opus 4.6, sprint decomposition was removed but the **planner and evaluator were kept** (without the planner, the generator under-scoped). The evaluator became a single final pass.
- [F] "Every harness component encodes an assumption about what the model can't do." Remove components one at a time and measure.

**How we built Claude Code auto mode** (2026-03-25)
- [F] Users approved 93% of prompts, which is approval fatigue.
- [F] A Sonnet 4.6 transcript classifier runs in two stages. It sees only user messages and tool calls (no assistant text or tool results). A prompt-injection probe scans tool outputs. Read-only tools and in-project edits skip it.
- [F] Measured: false-positive rate 0.4%, but a **17% miss rate on real "overeager" actions**. Not a substitute for review on high-stakes infrastructure. Define your trusted environment.

**Scaling Managed Agents: Decoupling the brain from the hands** (2026-04-08)
- [F] Harness ("brain") and sandbox ("hands") are separate and replaceable.
- [F] An append-only session log lives outside the context window. Credentials never enter the sandbox (git auth wired into the remote, MCP calls through a vault proxy).
- [F] Revisit harness assumptions after model upgrades. One team found context resets unnecessary.

**An update on recent Claude Code quality reports** (2026-04-23)
- [F] Three harness changes degraded quality:
  - The default effort was lowered from high to medium (Mar 4–Apr 7).
  - A thinking-history clearing bug.
  - A verbosity-capping system prompt line that hurt coding quality.
- [F] Lessons: **check your `/effort`**, since defaults change, and report issues with `/feedback`.
- [I] A one-line prompt constraint ("be brief") measurably hurt coding quality. Be careful with blanket brevity rules in CLAUDE.md or output styles.

**How we contain Claude across products** (2026-05-25)
- [F] Risk = P(failure) × blast radius. Environment controls (sandbox, VM, egress) are the hard guarantee, while model-layer defenses are probabilistic.
- [F] Claude Code: the sandbox (Seatbelt/bubblewrap) allows workspace writes and denies network by default, which cut prompts by 84%. Auto mode catches ~83% of overeager actions, so it is one layer *inside* a sandbox.
- [F] Incidents:
  - Repo `.claude/settings.json` hooks could run before the trust prompt.
  - A red-team phish got Claude to read `~/.aws/credentials` and POST it out in 24 of 25 tries.
  - Data was exfiltrated via an allow-listed domain.
- [F] Credentials that never enter the sandbox cannot be exfiltrated.

**Redesigning source control at Anthropic** (2026-10-13, updated 2026-10-15)
- [F] Anthropic's internal merge volume went from ~2,500 to 30,000+ changes per day (May → Sep 2026). They moved the monorepo off git to an in-house VCS (Scion).
- [F] Process changes:
  - No global merge lock. They rely on post-merge and pre-deploy testing, and Claude fixes conflicts.
  - **Reviewers review intent, not every line.** Approval rules separate trivial from sensitive changes.
  - Directory-level permissions.
  - Per-component "superfan" monitoring agents.
- [F] Lessons:
  - A key engineering role is **telling Claude "no"** when it breaks system invariants to satisfy a pattern.
  - Automated adversarial review can **over-engineer for hypothetical risks**, so steer it.
  - Invest in testing (simulation, fuzzing).
  - Find the new bottleneck (CI, review, merge).
- [I] Don't copy the VCS. Do copy "enforce invariants explicitly" and "find the new bottleneck".

**The components of agent memory** (2026-11-06, Lance Martin)
- [F] Memory has four layers: transcripts (ground truth), notes, representations (linked wiki/index), and a small **injected context** that must stay short.
- [F] Claude Code auto memory loads the first 200 lines / 25 KB of MEMORY.md as an index.
- [F] Store what the agent can't read from the environment: plans, tested rules, how a rule was verified, and traps. **Don't store state visible in the codebase**, because it goes stale. Avoid one-file-per-event sprawl.
- [F] Verify notes against transcripts. Give parallel agents separate pages: shared-table writes lost facts.
- [F] Tell the agent what memory is for, not exactly how to use it.

### 2B. Claude blog / news / research (claude.com, anthropic.com/news, /research)

**How Anthropic teams use Claude Code** (2025-07-24; claude.com/blog, plus a companion PDF)
- [F] Teams use CLAUDE.md files to navigate codebases. Security moved to TDD with pseudocode. Product Design runs autonomous write-test-iterate loops then reviews the result. Inference writes edge-case tests. MCP connects team docs.
- [U] The companion PDF (from memory; the blog page fetched this session did not contain these tips) reportedly also advised:
  - Commit checkpoints frequently.
  - A "slot machine" approach: save state, let it run ~30 min, accept or restart rather than wrestle.
  - Autonomous mode for peripheral features, synchronous supervision for core business logic.
  - Interrupt to ask for simpler solutions.

**Building agents with the Claude Agent SDK** (2025-09-29, Thariq Shihipar)
- [F] Loop: **gather context → take action → verify work → repeat**.
- [F] Prefer agentic search (grep over a well-organised file tree) before semantic search.
- [F] Verification methods, in decreasing robustness:
  - rules-based (lint, types, tests; "stricter, more detailed feedback is more useful")
  - visual (Playwright screenshots)
  - LLM-as-judge
- [F] Improve by reviewing failures, adding rules for repeated failures, and building eval sets from real usage.

**How AI is transforming work at Anthropic** (2025-12-02, research)
- [F] Survey of 132 engineers, 53 interviews and Claude Code usage data. Claude is used in ~60% of work, with ~50% self-reported productivity gain. About 27% of assisted work wouldn't otherwise have been done. Autonomous actions per task went from 9.8 to 21.2.
- [F] Concern: the "supervision paradox". Overseeing AI needs skills that can erode.
- [I] For a solo owner, deliberately keep architectural, data-model and security decisions in your own head (and in ADRs).

**2026 Agentic Coding Trends Report** (resources.anthropic.com; PDF last modified 2026-01-12; secondary sources cite release 2026-01-21) [U on date]
- [F] (secondary summaries) Eight trends, including shifting engineer roles, multi-agent coordination, scaling human-agent oversight and embedding security architecture. The four priorities for 2026: multi-agent coordination, scaling oversight, extending beyond engineering, and security architecture.
- [U] Details not verified; the PDF text could not be extracted.

**How AI impacts the formation of coding skills** (2026-01-29, research, RCT n=52)
- [F] The AI-assisted group scored lower on a comprehension quiz for a new library (~17% per secondary coverage [U]), with no significant speed gain. People who asked conceptual follow-up questions learned more.
- [I] When Claude introduces an unfamiliar library or pattern into your stack, ask it to explain (a "learning" output style, linear walkthroughs) before accepting.

**Introducing Code Review for Claude Code** (2026-03-09; now GA; claude.com/blog/code-review)
- [F] Several agents search in parallel, a verification step filters false positives, and findings are ranked by severity. It posts inline comments plus a check run and never approves or blocks.
- [F] Internally, PRs with substantive comments went from 16% to 54%, and fewer than 1% of findings were marked incorrect. PRs over 1,000 lines: 84% get findings, averaging 7.5 issues. PRs under 50 lines: 31% get findings, averaging 0.5. Cost averages $15–25 per review, taking ~20 min.
- [F] (docs) Configured via REVIEW.md plus CLAUDE.md. **Not available with the HIPAA configuration and not covered by the BAA.**

**Claude Code Security** (approx. 2026-02-20, research preview) [F per press]
- Reasoning-based vulnerability scanning with confidence ratings. Humans approve patches.

**How Claude Code works in large codebases: best practices and where to start** (2026-05-14, Applied AI team)
- [F] Setup order:
  1. CLAUDE.md files: root holds pointers and gotchas, subdirectories hold local conventions.
  2. Hooks: deterministic checks, plus a session-reflection hook that proposes CLAUDE.md updates.
  3. Path-scoped skills.
  4. Plugins.
  5. LSP.
  6. MCP.
  7. A read-only subagent that maps a subsystem to a file.
- [F] Start Claude in subdirectories. Scope test and lint commands per package; don't run the full suite after small changes. Deny-read generated and vendor code.
- [F] Review the config every 3–6 months and after model releases. Old rules can *block* newer models, for example a rule forcing single-file edits.
- [F] What doesn't work: bloated root CLAUDE.md, expertise in CLAUDE.md instead of skills, vague repo-wide searches, stale rules and hooks.

**Agentic coding and persistent returns to expertise** (2026-06-16, Economics team; ~400k Claude Code sessions, Oct 2025–Apr 2026)
- [F] Sessions spent "fixing broken code" fell from 33% to 19%.
- [F] Users make ~70% of planning decisions and Claude ~80% of execution decisions.
- [F] Expert users get ~12 actions per prompt vs ~5 for novices. Verified success: ~15% for novices vs 28–33% for intermediate and above. Novices abandon troubled sessions 19% of the time vs 5–7%.
- [I] Precise goals plus explicit verification asks are what correlate with success. Keep planning decisions yourself and delegate execution.

**Steering Claude Code: when to use CLAUDE.md, skills, hooks, and subagents** (2026-06-18, Michael Segner)
- [F] Choose by reliability needed × context cost:
  - CLAUDE.md: always-true facts.
  - `.claude/rules/` with `paths:`: scoped constraints.
  - Skills: procedures and runbooks.
  - Subagents: side tasks where only the summary matters.
  - Hooks: deterministic "always/never".
  - Output styles: sparingly.
- [F] Reassignments: "always do Y after X" → hook; "never do X" → hook, permission or managed setting; long runbook → skill; personal prefs → user level.

**How Anthropic secures its AI-native software development lifecycle** (2026-07-21, Jason Clinton, Deputy CISO)
- [F] ~80% of merged code is authored by Claude, and engineers ship ~8x more code per quarter than in 2021–25.
- [F] Threats: a prompt-injected agent making a malicious change, supply-chain poisoning, and higher-volume ordinary vulnerabilities.
- [F] Practices by stage:
  - **Plan:** security review of design docs.
  - **Code:** secure-coding rules in CLAUDE.md and org skills, updated whenever a new bug class appears. `/security-review` runs before PR creation, and a security-guidance plugin runs during generation. Developers work on egress-allow-listed VMs.
  - **CI:** the hard gate. Multiple **narrow** review agents with separate contexts must *prove* their findings. The codebase is **risk-tiered**, and regulated or critical code still needs human approval. **Invariant tests ("user A can never read user B's data")** trigger manual review.
  - **Deploy:** DAST.
  - **Monitor:** every agent action is logged to the SIEM.
- [F] Lesson: "draw boundaries around access and actions, not around a model's instructions".
- [I] This is the closest Anthropic analogue to a regulated multi-tenant SaaS. Adopt risk tiers and cross-tenant invariant tests.

**Introducing Claude Opus 5.5** (2026-09-22)
- [F] Leads Anthropic's agentic-coding results (Terminal-Bench 4.0 66.4%, CursorBench 4.0 57.8%). At default (medium) effort it beats Opus 5 at max effort on Terminal-Bench for about a fifth of the cost.
- [F] Better subagent delegation and self-verification loops. Better resistance to prompt injection. ~85% fewer containment-boundary circumvention attempts than Opus 5. Thinking can't be disabled.
- [F] The page warns benchmark margins are a "less reliable guide" to real-world differences.

**Building agents: When to fold subagents into your main agent loop** (2026-10-22, Diane Sarkis)
- [F] One model, one context and a tool loop, plus skills (how-to), tools (actions) and knowledge-base lookups, often beats org-chart subagent splits on quality, cost and latency.
- [F] Tool choice degrades beyond ~30–50 tool definitions.
- [F] Claude Code's system prompt was cut by more than 80% for newer models.
- [F] Keep subagents for parallel independent work, fresh-context isolation and measurable context bloat. Fold others one at a time against a small eval, running each eval task more than once.

### 2C. Claude Code docs (living; accessed 2026-11-08)

- **Best practices** (see 2A). [F]
- **Memory / CLAUDE.md** (code.claude.com/docs/en/memory)
  - [F] Target under 200 lines per file. `@path` imports organise content but **don't reduce context cost**.
  - [F] `.claude/rules/*.md` with `paths:` frontmatter loads only for matching files.
  - [F] `CLAUDE.local.md` for personal notes.
  - [F] `/doctor` suggests cuts, and `/doctor prompt-audit` flags instructions written for older models, dead references and contradictions.
  - [F] AGENTS.md is read when no CLAUDE.md exists. Otherwise import it from CLAUDE.md.
  - [F] Contradictions cause arbitrary choices, so review periodically.
- **Monorepos and large codebases** (docs/en/large-codebases)
  - [F] Root CLAUDE.md for repo-wide rules plus per-package CLAUDE.md, maintained by owners and reviewed in PRs.
  - [F] `claudeMdExcludes`. `Read` deny rules for dist, build, generated and vendor code.
  - [F] A TypeScript LSP plugin (`typescript-lsp@claude-plugins-official`).
  - [F] `worktree.sparsePaths` plus `symlinkDirectories` (node_modules). Per-package skills. `--add-dir` for sibling packages.
  - [F] For cross-package changes: **plan first in plan mode**. The plan file is **re-injected after each compaction**, and the whole change should happen in one session.
- **Extend Claude Code / features overview** (docs/en/features-overview)
  - [F] A feature-to-goal table and an "add it when the trigger appears" order:
    - convention wrong twice → CLAUDE.md
    - same prompt typed repeatedly → user-invocable skill
    - playbook pasted a third time → skill
    - external system → MCP
    - symbol hunting → code intelligence
    - noisy side task → subagent
    - must-always → hook
    - second repo → plugin
  - [F] Context cost per feature: CLAUDE.md is paid on every request. Skill descriptions only, unless `disable-model-invocation: true`. Hooks cost zero unless they output.
- **Run agents in parallel** (docs/en/agents)
  - [F] Five approaches: subagents, agent view (`claude agents`, research preview), agent teams (experimental, off by default, no worktree isolation), projects, dynamic workflows.
  - [F] Supporting tools: worktrees, cross-session messaging, `/batch` (5–30 worktree-isolated units).
- **Dynamic workflows** (docs/en/workflows)
  - [F] Claude writes a JS orchestration script (`agent()`, `pipeline()`, `parallel()`) that runs dozens to hundreds of subagents in the background, with adversarial cross-checking. It is resumable and can be saved to `.claude/workflows/`.
  - [F] Triggered by the `ultracode` keyword or `/effort ultracode`. Limits: 16 concurrent agents by default, 1,000 per run.
  - [F] Advice: run on a small slice first.
- **/goal** (docs/en/goal)
  - [F] Sets a completion condition that a small model checks after every turn; Claude keeps working until it's met.
  - [F] Write one measurable end state, a stated check, constraints ("no other test file is modified") and a turn bound ("or stop after 20 turns"). The evaluator reads only the transcript and doesn't run commands.
- **Code Review / REVIEW.md** (docs/en/code-review, code-review-customize)
  - [F] REVIEW.md is read only from the protected base/default branch, never from the PR.
  - [F] Use it to recalibrate "Important", cap nits, skip generated paths and things CI enforces, and add always-check rules. The doc's own example includes "Database queries are scoped to the caller's tenant" and "no PII in logs".
  - [F] Local `/code-review` reads CLAUDE.md but not REVIEW.md.
- **HIPAA setup** (docs/en/hipaa-setup)
  - [F] An Enterprise-plan configuration for orgs with a BAA. It covers **local** Claude Code and Cowork, but not cloud sessions, and the VS Code/JetBrains extensions are not BAA-covered.
  - [F] It is only effective when signed in with an Enterprise account directly to the Claude API, not via Bedrock, Vertex or a gateway.
  - [F] Under the configuration:
    - WebFetch is off.
    - Cloud sessions, teleport and Remote Control are off.
    - `/feedback` is off.
    - Artifacts are off.
    - MCP tool search is off.
    - Anthropic credentials are stripped from child processes.
  - [F] It requires Claude Code v2.1.285 or later. Local session data retention is the org's responsibility (`cleanupPeriodDays`, `claude purge`).

### 2D. Claude Platform docs (prompting and skills; living, accessed 2026-11-08)

- **Prompting best practices** (covers the Opus 5.5, Opus 5 and 4.x families)
  - [F] Multi-context-window workflow: the first window sets up tests (`tests.json`) and `init.sh`. Later windows iterate. The guidance quotes "It is unacceptable to remove or edit tests", recommends starting fresh rather than compacting ("Review progress.txt, tests.json, and the git logs"), and says to give UI verification tools.
  - [F] Sample prompts are provided for:
    - **avoid over-engineering**, flagged for Opus 4.5/4.6
    - **avoid hard-coding to pass tests** ("Tests are there to verify correctness, not to define the solution… if any of the tests are incorrect, inform me rather than working around them")
    - **investigate before answering** ("Never speculate about code you have not opened")
    - reversibility/confirmation of destructive actions (no `--no-verify` shortcuts)
- **Prompting Claude Opus 5** (and the base for 5.5)
  - [F] Opus 5 **verifies its own work unprompted**. Remove "add a verification step" or "use a subagent to verify" instructions, which cause over-verification.
  - [F] It may **expand scope**, so constrain it for narrow tasks (sample prompt given). It **delegates to subagents readily**: cap with `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` and `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`.
  - [F] Review prompts that say "only high-severity" are followed literally. Ask it to report everything, then filter in a separate pass.
  - [F] Don't add "double-check" instructions.
- **Prompting Claude Opus 5.5**
  - [F] Strongest at multistep repo work and code review, with fewer false alarms. The default effort is **medium**. At medium it matches Opus 5 at high, and **low comes close on several coding evals**. Reserve xhigh/max for measured gains.
  - [F] In unattended loops it may end a turn with a progress report. Treat that as a report, not completion: keep a checklist, auto-continue at most 2–3 times, or use a completion-condition checker (that is, `/goal`).
  - [F] Frontend defaults look generic. Name the specific patterns to avoid.
  - [F] Mark pasted untrusted text with tags.
- **Skill authoring best practices**
  - [F] "Claude is already very smart", so be concise. Match degrees of freedom to fragility: exact scripts for migrations, heuristics for review.
  - [F] SKILL.md under 500 lines, references one level deep. The description should be in the third person and say what the skill does and when to use it.
  - [F] **Build evaluations first** (3 or more scenarios, a baseline). Iterate with a "Claude A" author and a "Claude B" tester. Use plan → validate → execute with machine-checkable intermediate files.

### 2E. Talks, threads and interviews by Claude Code team members

- **Boris Cherny, "How I use Claude Code"** (X thread, 2026-01-02; text mirrored in a GitHub gist) [F via gist]
  - **Sessions:** 5 local sessions in numbered terminal tabs plus 5–10 web sessions. He used Opus 4.5 with thinking for everything (less steering, faster overall).
  - **Shared CLAUDE.md:** one team CLAUDE.md in git, with a rule added each time Claude errs. `@.claude` tags on PRs (GitHub Action) turn review feedback into CLAUDE.md updates.
  - **Plan first:** most sessions start in plan mode. Iterate the plan, then auto-accept, and Claude "usually one-shots" it.
  - **Commands and agents:** slash commands in `.claude/commands/` (e.g., commit-push-PR with precomputed git status). Subagents: `code-simplifier` after coding, `verify-app` for end-to-end tests. A PostToolUse formatter hook.
  - **Permissions:** pre-allowed safe commands in shared `settings.json`. He avoids skip-permissions except in a sandbox.
  - **Verification:** "probably the most important thing". He tests every claude.ai/code change in a browser via the Chrome extension. For long runs he uses a background verifier, an agent Stop hook or the ralph-wiggum plugin.
- **Boris Cherny, team tips thread** (~2026-01-31/02-01; gist; date [U])
  - **Parallelism:** 3–5 worktrees, one task each.
  - **Planning:** plan mode for non-trivial work. One Claude drafts the plan, another reviews it. **Re-plan when things go sideways.**
  - **CLAUDE.md:** after each correction, "update CLAUDE.md so you don't make that mistake again". Keep per-task notes.
  - **Reuse:** anything done more than once a day becomes a skill or command (e.g., end-of-session tech-debt cleanup).
  - **Prompting:** make Claude justify and prove changes. If a fix is mediocre, ask for a fresh rewrite ("knowing everything you know now, implement the elegant solution"). Detailed specs mean more autonomy.
  - **Subagents:** ask for them explicitly to add compute.
- **Code with Claude 2026** (San Francisco, 2026-05-06; notes by Chris Ebert, secondary)
  - [F per notes] Speakers included Boris Cherny, Cat Wu, Daisy Hollman and Fiona Fung.
  - [F per notes] Context: keep CLAUDE.md lean (paid every turn). Prefer existing CLIs over MCP wrappers. Hooks for just-in-time corrections.
  - [F per notes] Practice: prototype competing designs instead of debating ("In technical debates, code wins"). Shift verification left, and save deep human review for changes that need it. Run several reviewers on the same PR. Re-run previously failed use cases on each new model.
- **Cat Wu and Thariq Shihipar fireside chat** (write-up by Simon Willison, 2026-07-21)
  - [F per write-up] Claude Code's system prompt was cut ~80%: "fewer hard constraints, more context". A rule that is "90% true" misleads the model in the other 10%.
  - [F per write-up] A blanket "always verify" rule proved too rigid. A local app run is now required only for larger UX changes.
  - [F per write-up] Invest in CI/CD and tests. Sensitive areas need code-owner approval, a review bot runs on every PR, and **every incident-causing PR is added to an eval set**. A new model drops in only when evals show it is strictly better.
  - [F per write-up] Cat: the developer who merges AI code owns its maintenance, docs and abstractions (also reported in May 2026 interviews).
  - [U] A report that Cat Wu left Anthropic in Nov 2026 is unverified.

---

## 3. Practitioner sources (secondary to Anthropic; 2025–2026)

**Spec-driven development (SDD)**
- **GitHub Spec Kit** (GitHub blog, 2025-09-02, Den Delimarsky)
  - [F] A **constitution** (project principles) plus specify → plan → tasks → implement, with human checkpoints. Agent-agnostic (works with Claude Code). Framed as an experiment.
- **Kiro** (AWS, launched Jul 2025)
  - [F per Böckeler] requirements → design → tasks, mostly spec-first.
- **Birgitta Böckeler, "Understanding Spec-Driven-Development: Kiro, spec-kit, and Tessl"** (martinfowler.com, 2025-10-15)
  - [F] Three levels: spec-first, spec-anchored, spec-as-source.
  - [F] Problems observed:
    - One workflow doesn't fit all sizes: a bug became 4 stories with 16 acceptance criteria.
    - Verbose markdown is tedious to review.
    - A false sense of control: agents still ignored specs or duplicated code.
    - Functional and technical detail are hard to separate.
  - [F] Spec-as-source risks repeating model-driven development's failure. She asks for flexible, small-step workflows.
- **Thoughtworks Radar** (assessment of SDD and its tooling across volumes)
  - [F] SDD at **Assess** (Nov 2025). Spec Kit, OpenSpec and Superpowers at **Assess** (Vol 34, Apr 2026).
  - [F] Spec Kit's main risk is **instruction bloat**, so move reusable guidance into skills.
- [I] Net: use **lightweight spec-first per feature (SPEC.md with acceptance criteria) and spec-anchored for durable decisions (ADRs, contracts)**. Avoid heavyweight SDD tooling for small changes.

**Harness engineering**
- **Böckeler, "Harness engineering for coding agent users"** (martinfowler.com, 2026-04-02; "first thoughts" memo 2026-02-17)
  - [F] **Guides** (feedforward: conventions, skills, codemods) vs **sensors** (feedback: linters, structural tests, review agents). **Computational** checks (cheap, deterministic) vs **inferential** checks (LLM review).
  - [F] Keep quality left: fast checks before integration, expensive ones in the pipeline.
  - [F] **Architecture fitness functions.** Behaviour is the hardest to harness.
  - [F] **Harnessability**: strong typing, clear module boundaries and opinionated frameworks help. **Greenfield can design for it.** Add a sensor whenever an issue recurs.

**Thoughtworks Technology Radar**
- **Vol 34** (Apr 2026)
  - [F] Claude Code at **Adopt** ("pair with disciplined harness engineering").
  - [F] Context engineering and curated shared instructions at Adopt. Feedback sensors, mutation testing and sandboxed execution at Trial.
  - [F] Caution: agent instruction bloat, **codebase cognitive debt**, coding-agent swarms, throughput-as-productivity, "MCP by default".
- **Vol 35** (Nov 2026)
  - [F] **Adopt:** agent sandboxing, **mutation testing** (exposes superficial AI tests), progressive context disclosure, threat modeling, path-to-production mapping.
  - [F] **Trial:** feedback flywheel (turn agent mistakes into harness edits, prune stale rules), **grilling** (the agent interviews you about the plan), interactive visual plans, risk-tiered human oversight, subagents for context management, unattended overnight builds ("requires strong prerequisites"), anchoring agents to a reference application, agent plugin marketplace.
  - [F] **Assess:** agent pipeline responsibility, semantic review of AI-edited prose (specs/ADRs), tests-as-data, context profiling, harness quality evaluation.
  - [F] **Caution:** agent instruction bloat, **AI-driven documentation sprawl** ("agents generate piles of outdated docs that waste context and mislead agents"), **human-in-the-loop theater**, "meat proxy" (forwarding unreviewed LLM output), **stacked PRs** masking poor decomposition, blanket frontier-model usage.

**Simon Willison**
- **"Your job is to deliver code you have proven to work"** (2025-12-18)
  - [F] Every change ships with evidence: manual test steps and output, plus an automated test that fails if the change is reverted. Make agents prove their work with runs and screenshots.
- **Agentic Engineering Patterns guide** (launched 2026-02-23; chapters undated and living)
  - [F] Anti-pattern: filing PRs with code you haven't reviewed. Keep PRs small, explain the goal and link the spec, check the agent-written PR description, and include evidence.
  - [F] **"Use red/green TDD"** is a sufficient prompt for capable models. Confirm the red phase.
  - [F] "First run the tests".
  - [F] Code being cheap means **near-zero tolerance for small code smells**: run cleanup agents asynchronously on branches. Use a **compound engineering loop**, a retro after each project that updates agent instructions.

**ADRs and decision records**
- [U] Practitioner reports (Codeminer42 2026; a preprint reportedly showing ~10% less dev time when agents get ADRs with rationale) say ADRs drift unless something checks them. They recommend one ADR per decision, referenced from the instruction files rather than all loaded by default. Evidence is weak.
- [I] Consistent with Anthropic's guidance: decisions "not in the repo" belong in CLAUDE.md as *pointers*, with details loaded on demand.

**AGENTS.md**
- [F] Thoughtworks has it at Trial (Nov 2025) with the advice to keep it lean and link out.
- [F] Claude Code reads AGENTS.md if there is no CLAUDE.md, or you can import it.

---

## 4. Synthesis: the methodology

### 4.1 Mental model: the harness, not the prompt [F + I]

Combining Anthropic (best practices, harness posts, steering post) and Böckeler/Thoughtworks:

| Layer | Purpose | Your artifacts (proposed) |
|---|---|---|
| **Guides (feedforward, non-deterministic)** | Tell Claude what it can't see | Root + per-package CLAUDE.md, `.claude/rules/*` with `paths:`, skills, SPEC.md, ADRs (pointers), reference implementations |
| **Sensors (feedback, deterministic)** | Let Claude close the loop | `tsc`, ESLint (incl. boundary rules), unit/integration tests, RLS isolation tests, Playwright E2E, `flutter analyze`/`flutter test`, build exit codes |
| **Sensors (feedback, inferential)** | Catch what tests can't | `/code-review`, reviewer subagent vs SPEC.md, `/security-review`, evaluator agent with browser |
| **Enforcement (harness)** | Rules with zero exceptions | Hooks (Stop: typecheck; PostToolUse: format; PreToolUse: block edits to applied migrations), deny rules (`.env`, secrets, prod dumps), sandbox, branch protection, CI required checks |
| **Human gates** | Accountability, intent, risk | Plan approval, risk-tiered PR approval, merges/deploys/migrations to prod |

[I] The greenfield advantage (Böckeler's "harnessability") means choosing strongly typed, opinionated, boundary-enforced structures from day one. Examples: NestJS modules, Nx/Turborepo project boundaries, zod/DTO validation at edges, generated API clients. These make computational sensors cheap and drift visible.

### 4.2 Spec-first / plan-first workflow [F + I]

- [F] Anthropic's own flow:
  1. Interview ("Interview me until you could write the spec, then write it to SPEC.md").
  2. A fresh session builds from SPEC.md.
  3. A reviewer checks the diff against SPEC.md.
- [F] Plan mode is the default start for non-trivial work (Boris). One Claude plans and another reviews the plan (team tips). Re-plan when things go sideways.
- [F] For cross-package changes, the plan file survives compaction and is re-injected (large-codebases docs).
- [F] In Anthropic's long-running harness, the **planner stays load-bearing**: without it, the generator under-scoped. The planner should specify deliverables and acceptance criteria, **not granular technical detail**, so early errors don't cascade (Mar 2026).
- [F] Sprint contracts mean agreeing *how success will be verified* before building.
- [F] Böckeler and Thoughtworks warn that heavyweight SDD creates review burden, instruction bloat and a false sense of control.
- [I] Proposed artifact ladder by task size:

| Task size | Artifact | Reviewer |
|---|---|---|
| Typo / small fix | Prompt with symptom + "fixed looks like" + failing test | Tests + diff glance |
| Feature (1 session, ≤ ~1 day) | Plan mode plan (approve it) + acceptance criteria in prompt or `docs/specs/<feature>.md` | Tests + `/code-review` + you |
| Epic / cross-cutting (auth, tenancy, billing, data model) | Interviewed SPEC.md + ADR(s) + sprint contracts ("how will we verify X") + feature checklist JSON | Planner/reviewer agents + you, mandatory |
| Whole product | PRD → feature list JSON (initializer pattern), architecture ADRs, `init.sh` | Progress file + feature list review weekly |

### 4.3 CLAUDE.md: short, specific, pointers [F + I]

- [F] Include only what the repo doesn't tell Claude, or what it would re-dig every session:
  - exact test, typecheck and lint commands (including single-file test runs)
  - misleading code ("don't copy this pattern")
  - decisions made outside the repo
  - anything corrected twice
- [F] Keep it under 200 lines. Leave out architecture or file-layout essays; Claude reads the repo itself.
- [F] Don't use emphasis or ALL CAPS. If a line keeps being ignored, the file is too long or the line should be a hook.
- [F] Contradictions lead to arbitrary choices. Run `/doctor prompt-audit` after model upgrades.
- [F] Layering: root CLAUDE.md for repo-wide rules, per-package CLAUDE.md, `.claude/rules/` with `paths:`. Skills hold procedures. Personal notes go in `CLAUDE.local.md`.
- [F] The feedback flywheel: update CLAUDE.md after corrections (Boris). A Stop hook can propose CLAUDE.md updates from the transcript (docs, May 2026 blog). Prune stale rules (Thoughtworks Vol 35).
- [I] A proposed skeleton for this monorepo (illustrative; adjust names to the real tooling):

```markdown
# CLAUDE.md (root): keep < ~80 lines
## Commands
- Install: pnpm install
- Affected checks: pnpm nx affected -t lint,typecheck,test   # or turbo equivalent
- One test file: pnpm --filter <pkg> vitest run <path>
- DB: pnpm db:migrate:dev | pnpm db:reset:test (never against prod)
## Non-negotiables (also enforced by hooks/CI)
- Every tenant-scoped table has RLS; every query runs under the tenant session context. See docs/adr/0003-tenancy-rls.md
- No PHI in logs, errors, fixtures, or test snapshots. Synthetic data only (packages/fixtures).
- Never edit a merged migration; add a new one.
## Where decisions live
- Architecture & decisions: docs/adr/ (index: docs/adr/README.md)
- Feature specs: docs/specs/<feature>/SPEC.md
- API contract: packages/api-contract (generated clients; don't hand-edit src/gen/)
## Gotchas
- apps/legacy-*: do not copy patterns
- Integration tests need DATABASE_URL from .env.test.example
```

Per-package files hold stack-specific conventions:
- `apps/api/CLAUDE.md`: NestJS module layout, DTO validation, transaction and tenant-context helper.
- `apps/web/CLAUDE.md`: React state and query conventions, design system.
- `apps/site/CLAUDE.md`: Next.js rendering rules.
- `apps/mobile/CLAUDE.md`: Flutter state management, `flutter test` commands.
- `packages/db/CLAUDE.md`: migration and RLS policy patterns.

### 4.4 Skills vs subagents vs hooks vs rules vs MCP vs workflows [F + I]

| Need | Use | Source |
|---|---|---|
| Always-true project facts, commands | CLAUDE.md | [F] docs |
| Conventions for part of the tree | Per-package CLAUDE.md or `.claude/rules/` with `paths:` | [F] docs |
| Procedures, runbooks, reference (release, "add a new tenant-scoped entity", "write an RLS policy", migration playbook, API style guide) | Skill (side-effecting ones: `disable-model-invocation: true`) | [F] docs/steering |
| Must happen every time / never happen | Hook (command/http; `onFailure: "block"` for security), deny rule, sandbox, managed settings, CI | [F] best practices |
| Noisy side task / parallel independent work / fresh-eyes review / restricted-tool reviewer | Subagent (`tools: Read, Grep, Glob` for reviewers; `model: haiku` for trivial jobs) | [F] best practices |
| Many-item fan-out (audit every endpoint for tenant scoping, migrate 200 files) with cross-checking | Dynamic workflow / `/batch` | [F] workflows docs |
| External system without a CLI | MCP (prefer CLI if one exists) | [F] best practices, Code w/ Claude |
| Share setup across repos/team | Plugin (internal marketplace) | [F] docs |

Caveats [F]:
- Subagents don't make answers smarter, only parallel or independent. Each costs tokens and may be *slower* because it must regather context.
- Opus 5-class models delegate too readily. Cap delegation where needed.
- Anthropic's Oct 2026 guidance favours fewer subagents plus progressive disclosure.

### 4.5 Verification loops: "give Claude a way to verify its work" [F + I]

- [F] Escalating strictness:
  1. Prompt ("run the auth tests, keep going until they pass").
  2. `/goal` condition.
  3. **Stop hook** (exit 2 blocks the stop until `tsc` passes).
  4. Independent reviewer.
  5. CI and branch protection.
- [F] Always ask for evidence: the command and its output, or a screenshot. Use `/verify` to have Claude run the app and look.
- [F] End-to-end checks through a real browser (Puppeteer/Playwright/Chrome extension) caught bugs unit tests and `curl` missed (Nov 2025, Mar 2026, Boris).
- [F] Make test output agent-friendly: short output, details in files, `ERROR` lines, a fast deterministic subset (C compiler).
- [F] With Opus 5 / 5.5, **don't add generic "double-check" or "always verify" prose**, which causes over-verification. Provide the *tools and commands* and the *gates* instead (Opus 5 prompting docs; Cat Wu, Jul 2026).
- [I] Proposed verification stack for this product:
  - **Per edit (hook):** formatter (PostToolUse) and `tsc --noEmit` on affected projects (Stop hook).
  - **Per task (Claude runs):** unit and integration tests for touched packages, plus Testcontainers Postgres with real RLS (no mocked DB for tenancy logic). Playwright smoke for UI changes. `flutter analyze` and `flutter test` (golden or integration tests where relevant).
  - **Per PR (CI):** full typecheck, lint (incl. module-boundary rules), all tests, **cross-tenant isolation invariant suite**, migration up/down check, SAST and dependency scan, generated-client drift check, `/security-review`-style job, and **mutation testing on critical packages** (Thoughtworks Adopt) to detect hollow AI-written tests.
  - **Pre-release:** E2E against staging with synthetic tenants, and periodic DAST.

### 4.6 Task sizing [F + I]

- [F] One feature per session or sprint is "critical" to stop over-reach (Nov 2025). Commit at the end of each session with a progress note.
- [F] Code Review data shows larger PRs carry many more defects: 84% of PRs over 1,000 lines had findings, averaging 7.5 issues; PRs under 50 lines averaged 0.5.
- [F] Willison: several small PRs beat one large one. Thoughtworks: stacked PRs can mask poor decomposition.
- [F] Opus 5.5 handles multi-hour migrations and sustained autonomous work. Anthropic removed sprint decomposition for Opus 4.6 in its harness. Task size can grow *if* checks are strong.
- [I] Rule of thumb:
  - A task is a vertical slice that can be verified end to end in one session: one endpoint plus its UI plus its tests, or one entity plus its RLS policy plus its migration plus its isolation tests.
  - Target PRs of a few hundred lines of non-generated code.
  - Large mechanical changes go through `/batch` or workflows, with per-unit PRs.
  - Cross-cutting design changes (tenancy model, auth, audit logging) are planned separately and implemented in small steps behind tests.

### 4.7 Context hygiene [F]

- [F] `/clear` between unrelated tasks; it is cheaper and gives better answers. `/compact <focus>` when needed. `/rename` plus `--resume` for multi-day work.
- [F] After two failed corrections, `/clear` and write one better prompt.
- [F] Subagents and side sessions keep long outputs out of the main context. `/btw` for side questions.
- [F] For long work, persist state in files rather than memory: progress file, feature-list JSON, plan file, git log. Fresh windows can rediscover state from the filesystem, which is often better than compaction.
- [F] Turn off unused MCP servers. Watch `/usage` and `/context all`.
- [F] Keep memory notes about *what can't be seen in the code*, and verify them (Nov 2026 memory post).

### 4.8 Parallel work [F + I]

- [F] Run one session per task in its own worktree (`claude -w <name>`). Use `.worktreeinclude` for gitignored env files and `worktree.symlinkDirectories` for `node_modules`. Use sparse paths in a big monorepo.
- [F] Boris runs 5 local plus 5–10 web sessions. The team tips suggest 3–5 worktrees.
- [F] Anthropic's C compiler shows task-lock files, frequent rebases and near-perfect tests. Thoughtworks cautions against swarms. Agent teams are experimental and don't isolate by worktree.
- [F] Cross-session messaging can warn one session that another's change breaks it.
- [I] For a solo owner, aim for **2–4 concurrent sessions on independent slices** (e.g., API feature, UI for an already-merged API, Flutter screen, test hardening). Review is the bottleneck, so don't run more sessions than you can review.
  - Avoid parallel sessions touching the same migration sequence or the shared contract package. Serialize schema changes.
  - Note: under the HIPAA configuration, cloud sessions are disabled, so parallelism must be local.

### 4.9 Review practices [F + I]

- [F] Review by someone who didn't write the code:
  - `/code-review` (fresh subagent, reads CLAUDE.md)
  - a custom read-only reviewer subagent that checks against SPEC.md and reports only correctness gaps, "skip style"
  - a second session
  - managed Code Review or Ultrareview
- [F] Reviewers asked to find problems always find *something*. Fixing every nit produces extra abstractions and tests for impossible cases ("Don't drop 'skip style'").
- [F] Opus 5 review prompts: ask it to report everything, then filter in a separate pass rather than saying "only high severity".
- [F] Anthropic internally: narrow reviewers per concern with separate contexts and evidence required for findings. Risk tiers with human approval for critical code. Incident-causing PRs become eval cases. Engineers review *intent* rather than every line at Anthropic's scale.
- [F] Willison: never open PRs with code you haven't reviewed. Check the agent-written PR description.
- [I] For a healthcare SaaS solo owner, use risk tiers:

| Tier | Areas | Gate |
|---|---|---|
| T0 (critical) | Auth, RLS policies & tenant context, PHI handling/encryption, audit log, migrations, billing, infra/IaC, permissions model | You read every line + isolation tests + security review |
| T1 (core) | Domain services, API contracts, data access | Read the diff with spec; reviewer agent must pass |
| T2 (peripheral) | UI polish, copy, internal tooling, docs, test additions | Review intent + evidence; spot-check |

  - Make T0 paths visible to both humans and agents. Put a `REVIEW.md` "Important" section on them (only if you use managed Code Review, which is not available under the HIPAA configuration). Put the same rules in CLAUDE.md or rules so local `/code-review` sees them.

### 4.10 CI integration [F + I]

- [F] `claude -p` for headless runs. Use `--bare` for reproducibility, or omit it when hooks are needed. Combine `--allowedTools`, `--permission-mode dontAsk`, `--max-turns`, `--max-budget-usd` and `--output-format json`.
- [F] Other options: the Claude Code GitHub Action or GitLab CI, `@claude` mentions on PRs, `/loop` ("check CI on this branch, fix and push"), and cloud scheduled tasks (`/schedule`).
- [F] Protect `main` with branch rules the task can't bypass, and watch the first runs.
- [F] Anthropic puts its hard review gate in CI rather than in a PreToolUse hook. The C-compiler work shows CI needs to come **early**, not after features start regressing.
- [I] Proposed CI shape (GitHub Actions):
  1. Required checks: typecheck, lint, tests, isolation suite, migrations, SAST, dependency audit, contract drift.
  2. Optional Claude review job (`claude -p` with a read-only tool allowlist) that posts findings as a PR comment.
  3. Nightly: mutation tests on critical packages, a docs-drift job (agent compares CLAUDE.md, ADR index and spec status to code and opens a PR), and dependency updates.
  - Keep any PHI-bearing environment out of agent reach.

### 4.11 Security and healthcare-specific constraints [F + I]

- [F] Containment: sandbox (filesystem plus network), deny `Read` on secrets, and credentials outside the agent environment. Auto mode is a classifier with a ~17% miss rate on overeager actions, so add deny rules or hooks for "never" items.
- [F] Repo hooks and settings in cloned repos are a vector, and MCP servers and skills are supply-chain risks. Vet them.
- [F] The HIPAA configuration constrains tooling:
  - It needs a Claude Enterprise plan with a BAA, a direct Claude API connection (not Bedrock, Vertex or a gateway) and local sessions only.
  - WebFetch, cloud sessions and artifacts are off. Code Review is not available and not BAA-covered.
  - IDE extensions are not covered by the BAA.
- [I] Strongly prefer **never letting PHI into the development environment at all**:
  - synthetic fixtures and generators
  - de-identified staging
  - no production DB access, dumps or logs in agent sessions
  - deny rules for paths that could hold real data
  - read-only access if production observability is ever needed
  - With that discipline, the code itself is not PHI. Decide with compliance counsel whether you need the HIPAA configuration and which features (cloud sessions, managed Code Review) you can then use. This is a compliance decision, not a technical one.
- [F] Anthropic's own pattern for "user A can never read user B's data" is **invariant tests** that trigger manual review.
- [I] Make cross-tenant isolation tests a first-class, always-run CI suite. Seed two or more tenants and assert zero cross-tenant rows for every repository or query path. Test RLS with the same non-superuser, non-`BYPASSRLS` role the app uses. Superusers and `BYPASSRLS` roles always bypass RLS, and table owners bypass it unless `FORCE ROW LEVEL SECURITY` is set. Add a fixture guard that fails if any tenant-scoped table lacks a policy.

### 4.12 Failure modes and countermeasures [F + I]

| Failure mode | Evidence | Countermeasures |
|---|---|---|
| **Over-engineering / scope creep** (extra abstractions, files, defensive code, unrequested features) | [F] Opus 4.5/4.6 tendency; Opus 5 may expand scope; adversarial reviewers over-engineer (Oct 2026) | Clear scope in prompt/spec; Opus 5 scope-constraining prompt; "skip style" on reviews; `code-simplifier` pass; you saying "no" |
| **Reward hacking on tests** (hard-coding, editing/deleting tests, special-casing) | [F] prompting docs; harness rule "only flip `passes`", "unacceptable to remove or edit tests" | Tests written or approved first (red/green); deny/hook edits to locked test files during implementation tasks; reviewer checks test diffs; mutation testing; "if a test is wrong, tell me" |
| **Premature "done"** | [F] Nov 2025; Opus 5.5 progress-report stops | Feature checklist; `/goal`; Stop hook; E2E browser checks; ask for evidence |
| **Hallucinated APIs / wrong library usage** | [F] "never speculate about code you have not opened"; Opus 5.5 checks external docs | Typecheck + LSP plugin; pin versions; give docs via skill/`@file`; generated clients; tests against real dependencies (Testcontainers) |
| **Docs ↔ code drift / doc sprawl** | [F] TW Vol 35 caution; memory post (state visible in code goes stale); ADR drift (practitioner) | Don't document what code shows; CLAUDE.md = pointers; PR rule "update ADR/spec when behavior changes"; nightly drift job; `/doctor prompt-audit`; delete stale docs |
| **Giant PRs** | [F] Code Review stats; Willison | One slice per session; `/batch` with per-unit PRs; size budget in CI (warn > N lines non-generated) |
| **Instruction bloat / stale rules** | [F] TW caution; best practices; large-codebase blog | <200 lines; path-scoped rules; skills; audit after each model release |
| **Self-evaluation bias** | [F] Mar 2026 | Separate reviewer/evaluator; calibrate on your own judgments |
| **Cognitive debt / skill erosion** | [F] TW caution; Jan 2026 RCT; Dec 2025 survey | You own the plan and data model; ADRs; walkthrough/explanatory mode for unfamiliar code; periodically write or modify critical code yourself |
| **Prompt injection / exfiltration** | [F] containment post | Sandbox + egress allowlist; no creds in env; vet MCP/skills; mark pasted untrusted content |
| **Breaking invariants to satisfy a pattern** | [F] source-control post | Invariant tests; architecture fitness checks (dependency rules); explicit "never" in hooks/CI |
| **Over-delegation / cost blowups** | [F] Opus 5 docs; multi-agent 15x tokens | Cap subagents (env vars); `/usage`; Haiku for trivial subagents; small-slice trial before workflows |

### 4.13 Opus 5.5 calibration [F + I]

- [F] Default effort is medium.
- [F] Raise effort (`/effort high` or `xhigh`) for: bugs in unfamiliar code, flaky tests, and schema changes where every reader of the old shape must be found.
- [F] Use `max` for hard security hunts. Use `ultrathink` for a one-off deep turn.
- [F] Lower effort for brainstorming or quick iteration.
- [F] "be ambitious" tells Claude the *scope* you want: empty and error states, keyboard navigation and so on.
- [F] Don't write "think harder", "don't be lazy" or "loop until done". Do give it a check to pass.
- [F] Sonnet 5.5 is cheaper for routine work. Haiku suits simple subagents. Fable 5.1 is available with `/model fable`.
- [I] For this project:
  - medium for most feature work
  - high or xhigh for RLS, auth and migration design
  - a separate high-effort review pass on T0 diffs
- [I] Re-test effort defaults after model or harness updates. The Apr 2026 postmortem shows defaults change.

### 4.14 Advice that is now obsolete (per Anthropic's current docs) [F]

| Old advice | Current position |
|---|---|
| Manage the context window aggressively | 1M windows + auto-compaction; still `/clear` between tasks for focus and cost |
| IMPORTANT / ALL CAPS | Causes over-application; shorten the file or use a hook |
| Subagents to protect context | Rarely needed for that; use for parallelism, noisy output, independent review |
| Delegate for a better answer | Delegation ≠ smarter; fresh reviewer ≠ delegation |
| "think hard / be thorough" | Use effort level (`ultrathink` still works per-turn) |
| "keep going, don't be lazy" | Causes over-work; give a check, use `/goal` or Stop hook |
| Architecture/file layout in CLAUDE.md | Claude reads the repo; write only what isn't there |
| (Opus 5) "add a verification step / double-check" | Causes over-verification; remove |

---

## 5. Conflicts, tensions and open questions

- **"Verification is the most important thing" (Boris, Jan 2026) vs "a blanket always-verify rule was too rigid" (Cat Wu, Jul 2026) and "remove verification instructions" (Opus 5 docs).** [I] These reconcile. Give *mechanisms* (commands, hooks, CI, browser tools) and require *evidence*, but don't add generic verification prose.
- **Subagents.** 2025 posts used subagents for context isolation. 2026 guidance says fewer subagents, progressive disclosure, and caps on delegation. Anthropic's harness still uses an independent evaluator. [I] Use subagents for (a) independent review and (b) genuinely parallel or noisy work. Otherwise keep one loop.
- **Human review depth.** Anthropic reviews *intent* at its scale and auto-approves some outer-layer changes, but keeps human approval for regulated or critical code. Thoughtworks warns about "human-in-the-loop theater". [I] Risk-tier it (Sec. 4.9). Don't pretend to review what you can't, and do read T0 fully.
- **Spec-driven development.** Anthropic favours a lightweight SPEC.md and plan mode, while Spec Kit and Kiro are heavier. Thoughtworks keeps SDD at Assess. [I] Go lightweight per feature and durable for decisions.
- **Model-specific harness pieces go stale.** Sprint decomposition was dropped for Opus 4.6, context resets for Opus 4.5. [I] Re-run a small eval set ("golden tasks" from your own repo) after each model update before changing the workflow.
- **Unverified items:**
  - the companion-PDF tips (slot machine and others)
  - the exact Agentic Coding Trends Report date
  - the Opus 5 release date (secondary sources only)
  - Cat Wu's departure (Nov 2026)
  - ADR effect sizes
  - the Code with Claude talk contents (third-party notes)

---

## 6. Recommended operating model (concise) [I, built on the [F] items above]

**Phase 0: foundation (before feature work)**
1. **Repo and harnessability:**
   - pnpm monorepo with Nx or Turborepo, strict TypeScript, ESLint with module-boundary rules
   - NestJS modules per bounded context, a shared `api-contract` package that generates clients for React, Next.js and Flutter
   - `packages/db` with migrations and RLS policies, `packages/fixtures` with synthetic multi-tenant data
   - Flutter app with analyzer plus tests
2. **Sensors first:**
   - unit and integration tests with real Postgres (Testcontainers)
   - a **cross-tenant isolation invariant suite** with a non-superuser role
   - Playwright smoke tests, `flutter test`
   - CI required checks from day 1, including SAST, dependency audit and contract drift
   - mutation testing on T0 packages (nightly)
3. **Guides:**
   - root CLAUDE.md (<80 lines: commands, non-negotiables, pointers), per-package CLAUDE.md
   - `.claude/rules/` for migrations, RLS, PHI and logging
   - `docs/adr/` (short, one decision each, indexed) and `docs/specs/`
   - skills: `new-tenant-entity`, `write-rls-policy`, `add-endpoint`, `release` (user-only), `security-checklist`
4. **Enforcement:**
   - **Stop hook:** affected typecheck.
   - **PostToolUse hook:** formatter.
   - **PreToolUse hook:** block edits to merged migrations, `src/gen/` and locked test files during impl tasks.
   - **Deny rules:** `.env*`, `secrets/**`, any data dumps. Sandbox on (filesystem plus network allowlist).
   - **Repo and accounts:** protected `main`; no prod credentials on the dev machine.
5. **Compliance decision:** keep PHI out of all agent environments. Decide with counsel whether to run under Enterprise plus the HIPAA configuration. That determines whether cloud sessions and managed Code Review are available; if not, use local `/code-review` and CI `claude -p` review.

**Per feature (the loop)**
1. **Interview → SPEC.md** with acceptance criteria and a "how we verify" list (sprint contract). Write or update an ADR if a decision is made. You approve.
2. **Fresh session, plan mode** → approve the plan (for T0, have a second Claude critique it).
3. **Implement one vertical slice:**
   - red/green TDD
   - medium effort, high or xhigh for T0
   - "be ambitious" only when you want the full scope
   - commit at green checkpoints
4. **Verify with evidence:** test output, typecheck, isolation suite, Playwright or screenshot for UI, `/verify` for app behaviour.
5. **Independent review:** reviewer subagent vs SPEC.md ("correctness only, skip style") plus `/code-review`, and `/security-review` for T0. Fix real findings and discard nits.
6. **Small PR** with the spec link, evidence and an agent-written description you've checked. CI must be green. **You** approve per risk tier.
7. **Compound step:** for any correction you made twice, update CLAUDE.md, a rule, a skill or a hook (a hook if it must never recur). Add incident-causing cases to a regression or eval list.

**Cadence**
- **Parallelism:** 2–4 worktree sessions on independent slices; serialize schema and contract changes. Use `/batch` or workflows for mechanical fan-out after a small-slice trial.
- **Long or unattended runs:** only with a spec, a `/goal` or Stop-hook check, scoped permissions in a sandbox, turn or budget caps, and output as a PR. Watch the first runs.
- **Weekly:** prune instructions (`/doctor prompt-audit`), review the feature list and progress, read a few transcripts.
- **After each model release:** re-run 10–20 golden tasks from your repo, re-check effort defaults, delete scaffolding the new model no longer needs.
- **Protect your understanding:** you own the data model, tenancy and security architecture. Ask for walkthroughs of unfamiliar code. Read T0 code fully.

---

## Sources (primary first; accessed 2026-11-08)

Anthropic engineering: anthropic.com/engineering/
- claude-code-best-practices (→ code.claude.com/docs/en/best-practices)
- multi-agent-research-system
- writing-tools-for-agents
- effective-context-engineering-for-ai-agents
- equipping-agents-for-the-real-world-with-agent-skills
- claude-code-sandboxing
- code-execution-with-mcp
- advanced-tool-use
- effective-harnesses-for-long-running-agents
- demystifying-evals-for-ai-agents
- building-c-compiler
- infrastructure-noise
- harness-design-long-running-apps
- claude-code-auto-mode
- managed-agents
- april-23-postmortem
- how-we-contain-claude
- redesigning-source-control
- components-of-agent-memory

Claude blog and Anthropic news/research:
- claude.com/blog/how-anthropic-teams-use-claude-code
- claude.com/blog/building-agents-with-the-claude-agent-sdk
- claude.com/blog/code-review
- claude.com/blog/how-claude-code-works-in-large-codebases-best-practices-and-where-to-start
- claude.com/blog/steering-claude-code-skills-hooks-rules-subagents-and-more
- claude.com/blog/how-anthropic-secures-its-ai-native-software-development-lifecycle
- claude.com/resources/articles/building-agents-when-to-fold-subagents-into-your-main-agent-loop
- anthropic.com/news/enabling-claude-code-to-work-more-autonomously
- anthropic.com/claude-opus-5-5
- anthropic.com/news (model listing)
- anthropic.com/research/how-ai-is-transforming-work-at-anthropic
- anthropic.com/research/AI-assistance-coding-skills
- anthropic.com/research/claude-code-expertise
- resources.anthropic.com/2026-agentic-coding-trends-report

Claude Code docs: code.claude.com/docs/en/
- best-practices, memory, large-codebases, features-overview, agents, workflows, goal
- code-review, code-review-customize, hipaa-setup

Platform docs: platform.claude.com/docs/en/
- build-with-claude/prompt-engineering/claude-prompting-best-practices
- …/prompting-claude-opus-5
- …/prompting-claude-opus-5-5
- agents-and-tools/agent-skills/best-practices

Team talks and threads:
- gist.github.com/eldermoraes/9bc426c67410081e1881b1b5127764b5 (Boris, 2026-01-02)
- gist.github.com/joyrexus/e20ead11b3df4de46ab32b4a7269abe0 (team tips)
- simonwillison.net/2026/jul/21/cat-and-thariq/
- chrisebert.net/notes-from-code-with-claude-2026/

Practitioners:
- github.blog/ai-and-ml/github-copilot/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/
- martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html
- martinfowler.com/articles/harness-engineering.html
- thoughtworks.com/radar/techniques (Vol 35)
- Vol 34 PDF, plus the digest at agentic-ai.readthedocs.io
- simonwillison.net/2025/Dec/18/code-proven-to-work/
- simonwillison.net/guides/agentic-engineering-patterns/
