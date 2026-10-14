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

## Component style
- Cards: white background, 1px border rgba(43,42,39,0.08), radius 18px, soft shadow 0 8px 24px rgba(43,42,39,0.08), generous padding.
- Buttons and badges are pills (radius 999px). Primary button is solid sage #7C8C6E with white text. Secondary is a thin outline.
- Stat cards on the dashboard: a 44px round cream icon circle (Lucide icon, sage color), a big number in Cormorant Garamond, and a small muted label.
- Status chips (soft colors): new = cream with gold text, preparing = light gold, ready = light sage, completed = light grey, cancelled = soft red.
- Small tags such as "Sold out" and "Featured" in the corner of menu item cards.
- Order status timeline: a vertical line with round steps (done = filled sage, current = outlined sage, upcoming = grey).
- Icons: Lucide, loaded from a CDN script. Use thin lines, no emojis.
- Do not copy any text, logo or photo from other brands. The brand name is Khabar-Golpo.

## Data access
Pages call the functions in `js/api/` (they return `{ data, error }`) and never read `js/mock` directly.

## Running pages
Pages are opened through a local server, so ES module imports are fine.

## After each task
Tell me in 3–5 simple lines what you did and which files changed. Then **stop and wait**.

Do nothing else.
