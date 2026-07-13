# SwipeScreen — Instruction Manual

SwipeScreen is a browser-based app for screening articles during a systematic
review. It turns title and abstract screening into fast, swipe-style decisions,
calculates inter-reviewer agreement, and exports reconciled, PRISMA-ready
results.

**Everything runs in your browser.** Your search results, decisions, and exports
are stored locally (IndexedDB) on your own device. Nothing is uploaded to a
server, and there are no accounts to create.

---

## The screening pipeline

SwipeScreen is organized as a three-stage pipeline, shown as three numbered
cards on the home screen:

1. **Title Screening** — screen records by title (fast, swipe-based decisions).
2. **Synthesis** — combine several reviewers' title-screening exports, measure
   agreement, and resolve conflicts into a single reconciled list.
3. **Abstract Screening** — screen articles by reading the full abstract.

A typical two-reviewer review runs straight down the pipeline: each reviewer
does Title Screening independently, their exports are combined in Synthesis, and
the reconciled list feeds Abstract Screening.

You do **not** have to use every stage. In particular, Abstract Screening can be
started on its own over a complete article list (see
[Starting from a full, un-reconciled list](#starting-from-a-full-un-reconciled-list)).

---

## Getting started

### Run the app

```bash
npm install
npm run dev
```

Then open the local URL that Vite prints (the app is served under the
`/SwipeScreen/` path). A production build is produced with `npm run build`.

### Uploading search results

Every new screening project starts by uploading a CSV of records. SwipeScreen
recognizes common database exports and auto-maps their columns:

- PubMed
- Scopus
- Web of Science
- EMBASE
- Cochrane

If the format isn't recognized, columns are matched by header name, and you can
always adjust the mapping by hand on the **Map Columns** step. Only **Title** is
strictly required. For Abstract Screening you will also want **Abstract** mapped
so each card has something to read. Files may be `.csv` or `.txt`.

Records are imported in a randomized order to reduce ordering bias during
screening.

---

## Stage 1 — Title Screening

Create a project from the **Title Screening → + New** button, enter a project
name and your reviewer name/initials, upload your CSV, confirm the column
mapping, and start.

Each record appears as a swipeable card showing the title and basic metadata
(authors, year, journal, and links to DOI / PubMed where available).

| Action | Swipe | Keys | Meaning |
| ------ | ----- | ---- | ------- |
| **Yes** | Right | `→` or `K` | Include |
| **No** | Left | `←` or `J` | Exclude |
| **Maybe** | Up | `↑` or `M` | Undecided / borderline |

Other shortcuts: `Ctrl+Z` undo the last decision, `?` show/hide the shortcut
help, `Esc` return home. You can also use the on-screen **No / Maybe / Yes**
buttons.

Progress is saved continuously. Use **Save** on the screening screen (or
**Save Progress (JSON)** on the results screen) to download a resumable snapshot,
and **Resume** on the home screen to reload it later.

When every card is decided you land on the **Results** screen (below). Export the
decisions as a CSV — this per-reviewer CSV is exactly what the Synthesis stage
expects.

---

## Stage 2 — Synthesis

Synthesis combines the title-screening exports of two or more reviewers.

1. Open **Synthesis → Start Synthesis**.
2. Add each reviewer's exported CSV (at least two).
3. SwipeScreen matches records across reviewers — exactly by DOI/title, with
   fuzzy title matches offered for your approval — and reports agreement:
   - **Cohen's kappa** and **PABAK** for two reviewers.
   - **Fleiss' kappa** for three or more reviewers.
   Agreement statistics are computed only over records matched across all
   reviewers.
4. Resolve any conflicts (records the reviewers decided differently).

The output of Synthesis is a **reconciled CSV**: one row per article carrying a
`final_decision` column with values such as `include`, `maybe`, or `exclude`.
That reconciled file is the classic input to Abstract Screening.

---

## Stage 3 — Abstract Screening

Abstract Screening is where you read each abstract in full and make an
include / maybe / exclude decision.

Create a project from **Abstract Screening → + New**. In addition to the project
name and reviewer, you can enter:

- **Inclusion criteria** and **Exclusion criteria** — shown in a collapsible
  "Criteria" banner while you screen, so your rules stay in front of you.
- **Exclusion reasons** — a quick-select list. When you exclude an article, you
  can tag it with a reason (e.g. *Wrong Population*, *Wrong Study Design*),
  which feeds the exclusion breakdown and the PRISMA counts.

The abstract card is scrollable (rather than flick-to-swipe), so long abstracts
are easy to read, and you decide with the **No / Maybe / Yes** buttons or the
keyboard shortcuts. Excluding an article opens the exclusion-reason picker;
press the number keys `1`–`9` to pick a reason quickly, or skip it.

### What Abstract Screening accepts as input

Abstract Screening works from a CSV, and it now supports **two** kinds of input:

**1. A reconciled CSV (from Synthesis).**
If the CSV has a decision column — `final_decision` or `screening_decision` —
SwipeScreen treats it as the output of a prior stage and loads **only the rows
marked `include` or `maybe`**. Rows marked `exclude` (or anything else) are
skipped. This is the standard "second pass on the survivors" workflow and is
unchanged.

### Starting from a full, un-reconciled list

**2. A full, un-reconciled list (no decision column).**
If the CSV has **no** `final_decision` and **no** `screening_decision` column,
there is nothing to filter on — the list was never reconciled. In that case
SwipeScreen screens **every row in the file**. This lets you run a single
combined screening pass over an entire list from the start, without first going
through Title Screening and Synthesis.

To do this, just upload a plain CSV (with **Title** and **Abstract** mapped) on
the Abstract Screening path and start. Every record becomes a card.

> **Tip.** The deciding factor is only whether a decision column is present. A
> file with a `final_decision`/`screening_decision` column is always filtered to
> `include`/`maybe`; a file without one is always screened in full. If you have a
> reconciled file but want to re-screen every row, remove the decision column
> before uploading.

### The "nothing to screen" message

You will only see this blocking message:

> *This CSV has a final_decision (or screening_decision) column, but no rows are
> marked include or maybe, so there is nothing to screen. Fix the decision
> values, or remove the column to screen every row in the file.*

in the one genuine case where the CSV **does** have a decision column but **none**
of its rows are `include` or `maybe` (for example, every row is `exclude`). It
does **not** appear for a valid file that simply has no decision column — that
file is screened in full.

---

## Results and export

When a project is complete (or any time you open its Results screen) you get:

- **Decision counts** — Included, Maybe, and Excluded.
- **Exclusion reasons** — a ranked breakdown of the reasons you tagged.
- **Time stats** — total, average, and median time per card, plus the screening
  date range.

Two exports are available:

- **Download CSV** — your original columns plus screening columns:
  `screening_decision`, `exclusion_reason`, `reviewer`, `screening_phase`,
  `screening_timestamp`, and `time_on_card_seconds`. This is the file you feed
  into Synthesis (from Title Screening) or archive as your final record.
- **Save Progress (JSON)** — a full, resumable snapshot of the project,
  articles, and decisions. Reload it later with **Resume** on the home screen.

The tagged decisions and exclusion reasons map directly onto **PRISMA** flow
counts (records screened, records excluded with reasons, and studies included;
"maybe" is counted with the included group for a conservative screen).

---

## Privacy and data

- All data stays in your browser's local IndexedDB storage.
- No account, no server, no upload.
- Because storage is local to one browser profile on one device, use
  **Save Progress (JSON)** to back up or move a project between machines, and
  keep your exported CSVs as the durable record.

---

## Quick reference

| I want to… | Do this |
| ---------- | ------- |
| Screen titles fast | Title Screening → + New → upload CSV → swipe |
| Combine two reviewers & measure kappa | Synthesis → add both exported CSVs |
| Second-pass the survivors by abstract | Abstract Screening → + New → upload the reconciled CSV |
| Screen a whole list by abstract from scratch | Abstract Screening → + New → upload a plain CSV with **no** decision column |
| Resume an interrupted project | Home → Resume → choose the saved JSON |
| Get a PRISMA-ready record | Results → Download CSV |
