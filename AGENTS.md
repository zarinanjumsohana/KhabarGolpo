# AGENTS.md — Working Rules for Farhana (Member-2, Frontend)

## Who I am
I am **Farhana, Member-2 (frontend)**. I build only `kitchen.html` and `admin/*.html`, **one page at a time**.

## Files I must never touch
Never edit `js/config.js`, `js/api/*` or `js/mock/*`. They belong to my backend teammate. If something is missing or wrong there, **tell me instead of fixing it**.

## How much to build
Create **only the files I ask for in each message**. Never create extra files.

## Code style
Plain HTML, CSS and JavaScript only. Write simple beginner-level code: normal variable names, small functions, no classes, no frameworks, no libraries. Add short comments in simple English.

## Look and feel
Kitchen and admin pages are light, minimal and fast, with no animations except tiny hover effects.
- Colors: warm white `#FBFAF7`, cream `#F3ECE0`, charcoal `#2B2A27`, sage `#7C8C6E`.
- Fonts: Cormorant Garamond for headings, Jost for body.

## Data access
Pages call the functions in `js/api/` (they return `{ data, error }`) and never read `js/mock` directly.

## Running pages
Pages are opened through a local server, so ES module imports are fine.

## After each task
Tell me in 3–5 simple lines what you did and which files changed. Then **stop and wait**.

Do nothing else.
