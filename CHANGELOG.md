# Changelog

## 2026-09-17 (import)

**Bring your CV with you, instead of typing it again.** The competitive review
named the missing import as the biggest hurdle at the entrance — nobody retypes
a CV they already have. On looking, `src/import/linkedinImport.ts` had been
sitting in the tree for months and **was called from nowhere**: built, never
wired up, never run. The first real pass showed what happens to code that never
runs:

- **The CSV reader split on `\n` first, then on `,`.** Every job description
  with a line break — that is, almost every one — shredded the table. It now
  reads character by character per RFC 4180: line breaks and commas inside
  quotes belong to the field.
- **Dates arrive as "Aug 2018", not "2018-08".** The converter knew only ISO and
  passed the rest through, so "Aug 2018" stood next to "12/2023" in the CV. It
  now handles month names (en/de), ISO, MM/YYYY and a bare year.
- **The ZIP reader was hand-rolled**, with the comment "no jszip needed" — while
  jszip sits in the project. It read the size from the local header, which is 0
  for ZIPs with a data descriptor. It uses jszip now.
- **`labels` was hard-set to German.** Importing an English CV put
  "Berufserfahrung" above your positions.

New on top: primary email address and phone number from the archive, language
proficiency mapped to the dot scale, and tolerant lookup of file names and
column headers — LinkedIn does not document the format, and what the archive
contains depends on the account.

**Nothing is replaced unasked.** The import first shows what is in the archive —
counts per area, a before/after comparison, and what it did **not** find. Photo,
profile text and cover letter are left alone: LinkedIn does not know them.
Everything runs in the browser and the file reaches no server, so the import
also works **in demo mode without an account**.

`scripts/linkedincheck.mjs` is new: 20 assertions against an archive built to
contain exactly the traps — a multi-line description with a comma, three date
formats, a current position with no end date, two email addresses with a primary
flag.

## 2026-09-17 (later)

**Click the photo to re-crop it.** Until now the only road to the cropper led
through a newly chosen file — wanting the frame a little higher meant digging
out the photo again. The thumbnail is now the button; a small mark in its corner
says so.

It crops from the **uncropped original**, which is kept alongside from now on
(`personal.photoOriginal`). The crop is baked into pixels — right for every
output, wrong for adjusting later: otherwise you could only ever crop tighter,
never zoom back out, and each round costs pixels. Profiles from before this
change have no original; there, the existing photo is recorded as the original
on the first re-crop, so at least every further round is lossless.

`scripts/bandcheck.mjs` is new: it builds every template with a filled sidebar,
renders it through LibreOffice and **measures the colour on the last page**, high
up and at the very bottom of the column — exactly where the panel used to stop.
Twelve of twelve pass. Measured, not assumed. (The first version compared the
colour strings for equality and reported eight false alarms over a difference of
1 in a single channel — antialiasing. It compares with a tolerance now: a check
that cries wolf stops being read.)

Phone widths 320/360/390/430 px checked, nothing found.

## 2026-09-17

**The colour panel now runs to the edge of every sheet.** It hung on a table
cell's background, so it ended where its content ended — page two showed a
half-height block of colour with a ragged bottom edge. The file's own header
comment said this could not be done in Word. That was true only of the road we
had taken. The panel is now a single-colour image, anchored freely to the page
and behind the text, carried by the header: Word repeats it on every sheet by
itself, out to all four edges.

Four typesetting faults sat in the same picture and are fixed with it:

- **The name is back where the template puts it.** The export moved it into the
  sidebar in *every* left-sidebar template, although the templates carry their
  own flag for that (`nameInSidebar`) and most do not set it. In Bordeaux the
  large serif line at the top of the main column became a small line under the
  photo — pick a template, get a different one in Word.
- **Skill groups in the main column are a list again**, not one sentence joined
  by commas. With entries that contain commas themselves — "HubSpot (CRM, CMS,
  forms)" — there was no telling where one ended.
- **The sidebar list has a hanging indent** and the template's own bullet in the
  column's accent colour, instead of a typed-in "·"; continuation lines used to
  sit under the bullet rather than under the text.
- **Dates no longer break in two** ("2010 –" / "2014"), and **entry heading,
  company line and first bullet stay together** — a position could end up alone
  at the foot of a page.

**Templates without a filled panel** (`panelFill: false` — Rotterdam, Lille,
Antwerpen and neighbours) get the hairline rule they have in the preview instead
of a shaded cell. Nobody had noticed, because their panel colour is white.

`app/scripts/docxsweep.mjs` is new: every template through both Word variants in
one browser, looking inside the ZIP instead of rendering, for the question
"does each template still produce a valid file?".

**The HTML export stops promising what it cannot keep.** The exported file was
labelled *print-ready*, with a print tip: margins none, background graphics on.
But what lands on the sheet is decided by the browser's print dialog, not by the
file. Safari largely ignores the instruction to print without margins, Firefox
takes "None" only when you click it, and headers and footers — address, date,
page number — are on by default everywhere and land across the template. Anyone
holding a crooked sheet afterwards had done nothing wrong; they had been
promised something.

The interface and the banner now say it plainly: the HTML file is for viewing
and sharing, printing is what the PDF is for. "Print anyway" unfolds the three
settings for those who want to try, with the warning that Safari honours none of
them reliably. The banner speaks the document's language (de/en/fr/es), and
`<html lang>` is finally set to it — an English CV sent to London used to carry
a German notice and `lang="de"`. The template kit's instructions say the same.

## 2026-09-16

**Every export path measured, three holes found.** `app/scripts/exportcheck.mjs`
now clicks every button in the running app, catches the real download and looks
inside the file — the ZIP for its four parts, the DOCX for `word/document.xml`,
the JSON for its fields, the ATS variant for the absence of tables. Eight paths,
all green. The first run found three things:

- The Markdown button served the app's own start page whenever a proxy answered
  before the API: status 200, HTML body, filename `.md`. Every error was
  swallowed, so a click did nothing and said nothing. It now checks that the
  answer is Markdown, falls back to the local build, and says why.
- The local build wrote *different* Markdown from the server bridge — no
  frontmatter, translated headings — so it could not be imported back. Both
  write the same format now; verified by running the produced file through the
  server's own parser.
- The download snippet existed seven times in two versions, one of them without
  the link in the document and with an immediate `revokeObjectURL`. That is what
  makes Safari and Firefox abort a download. There is one `saveFile.ts` now.

**Word carries the template's handwriting.** All 28 templates used to share one
heading style in Word. The eight shapes of the preview are rebuilt with
paragraph borders: short bar underneath, bar in front, rule above, filled label.
Bullet characters and the language dot scale come along. Word's *Heading 1*
brings "keep with next", which stopped LibreOffice from breaking the single
table row of a sidebar layout across pages — the heading level now lives in the
main column only.

**The profile photo is cropped before it is uploaded.** Until now the file went
to the server as it came out of the camera and `object-fit: cover` decided the
rest — centred, always. Drag to move, slider to zoom, portrait 4:5 or square for
the round frames. What gets uploaded is the crop, baked into pixels, not the
original plus an instruction on how to cut it: Word, PDF and HTML each crop on
their own otherwise.

**Structure where machines read it.** The PDF is now generated as a tagged PDF:
headings, paragraphs and lists are in the file as structure, not only as text at
coordinates — what a résumé parser looks for and what a screen reader needs
(measured: no `StructTreeRoot` without the option, an `H1` and 254 paragraph
marks with it, for 26 kB more). The HTML export additionally carries the person
as a schema.org record in the head. Nothing is in it that is not visible in the
document anyway — a second reading of the same page, not extra disclosure. The
share link deliberately does not get it.

**Shared links fit the phone.** The share page put the document on screen at
full A4 width — cut off on the right on any phone, which is where a link you
send is usually opened. It now measures the space and scales to it. Two traps,
both noted in the code: `transform: scale()` shrinks the rendering but not the
layout box (the height comes from the scaled box's own bounding rect), and as a
flex child that box would be stretched to the parent whose height is derived
from it — which collapses to zero in one pass without `align-items: flex-start`.

**The ATS badges explain themselves.** The template list now carries a legend
for all three levels, with the reason and with what the rating explicitly does
not promise: how reliably a parser hits the fields, not whether you get invited.

**Icons instead of emoji**, and the document properties name the person, not the
tool.

**Printing the exported HTML no longer doubles the page count.** Safari turned
a two-page CV into four sheets: it sets type slightly differently from the
browser that measured the page break, and the one line that then stuck out at
the bottom was pushed onto a sheet of its own. `overflow: hidden` hides that
line on screen, but WebKit ignores it while paginating. Each page now also
carries `contain: paint`, which makes it a monolithic box — never split, and
clipped in print exactly as on screen. Verified against Chromium: same page
count, pixel-identical output. Clipping must not be silent, so a small script
measures once fonts and images have loaded and names the affected page in the
print hint at the top. The PDF export was never affected; it renders in
Chromium server-side.

**MCP can create, rename, and write per language.** Three gaps that surfaced on
first real use — and forced a workaround:

- There was no `create_resume`. A client asked to write a new CV had to
  overwrite an existing one, because that was the only way. A tool must not
  force that.
- There was no rename. `PUT` wants the full payload, so changing a name meant
  round-tripping the whole profile and risking it.
- The Markdown bridge could only read and write the *selected* language. A
  profile keeps all four separately, so revising the German one leaves the
  others untouched — invisible until someone exports there and finds the demo
  person in their PDF.

`lang` is now optional on the Markdown endpoints and tools. Importing a
translation does **not** switch the profile's selected language, and an
explicit target beats the `lang:` line in the frontmatter — otherwise the
content would decide where it is written.

No `delete_resume`. Deleting stays in the UI: a tool that lets a model remove
CVs is a bad trade for the convenience it buys.

**The hosted MCP endpoint is multi-tenant.** Every user of an instance
authorizes their own AI client and sees only their own data. Paste
`https://your-domain/mcp` into the client — it registers itself, your instance
opens, the user is already signed in, they press *Allow*. No tokens are copied
anywhere.

- **The authorization server lives in the backend** (`pdf-service/oauth.js`),
  not in the MCP service. The first attempt put it in the MCP container, which
  has no users, no sessions and no database — so it could serve exactly one
  account, behind a shared secret. Identity belongs where the identities are.
- OAuth 2.1 with dynamic client registration (RFC 7591), PKCE (S256 only —
  OAuth 2.1 dropped `plain`), refresh, and revocation (RFC 7009). The consent
  screen runs against the existing session; users who are not signed in are
  sent to the app and land back on consent afterwards.
- **The MCP service is deliberately dumb**: no passwords, no user list. It
  passes the caller's token to the API and lets the API decide. The token rides
  on the async context rather than a module variable — in a process serving
  many users, a module variable would be a data leak waiting to happen.
- Authorization codes are single-use, enforced in the same `UPDATE` that reads
  them. Tokens and codes are stored hashed, like the API keys.
- New: *Settings → Connected apps* — see and end every connection.
- `docker-compose.yml` now includes the MCP service; `CV_API_KEY` must not be
  set there.
- Verified against a real Postgres with two users: over the same endpoint each
  sees only their own CVs, and neither can read or write the other's.


## 2026-09-14

**Security.** Five findings from a pre-release review, all of them also
affecting the private upstream instance:

- `publicBaseUrl` no longer reads `x-forwarded-host`. A forged header produced
  admin emails whose "accept" button pointed at the attacker's server; one click
  handed them a valid action token, and with it an invite code. Configured value
  first, then the `Host` header and only if it is a known host, otherwise none —
  the notification then ships without buttons and points at the admin panel.
  The same source now feeds share links, photo URLs and the share-card
  same-origin check (which was itself a bypass of the tracking-pixel guard).
- `GET /api/access/action` no longer has an effect. Mail scanners follow links
  automatically, which silently accepted access requests. GET shows a
  confirmation, POST acts. Token lifetime 30 days → 3.
- The container no longer runs as root (`USER pwuser`).
- The SSRF allowlist no longer permits `127.0.0.1` on any port, and the
  "same host" branch no longer precedes the private-address check — nor is the
  host taken from a header. Extracted to `pdf-service/ssrf.js` with tests.
- `trust proxy` is configurable via `TRUST_PROXY` and defaults to "no proxy".
  Hard-wiring `1` without a proxy disabled every rate limit in the file.

**Renamed.** Five templates named after trademarked characters became
`sonnenblume`, `schiefer`, `azur`, `amethyst`, `farn`; the old IDs remain as
aliases.

**Synced with upstream** (September work): flow-based pagination, measured type
scale (8.8 pt body, 8.2 pt floor), eight new templates, every label editable,
inline editing in the document, one-page workshop with shortening advisor,
"template without data" export, selectable paper colour, mobile fixes, and the
check scripts that go with them.

All notable changes to CV-Hub. Loosely follows
[Keep a Changelog](https://keepachangelog.com/); semantic versioning starts with
the first tagged release.

## [Unreleased]

### Added
- Initial open-source release under AGPL-3.0, derived from a production résumé
  tool. Neutralized for self-hosting: configurable `APP_NAME`, English default,
  environment-driven configuration, `docker-compose` quickstart.
- Core features: 28 templates, four languages (EN/DE/FR/ES), PDF/HTML/Markdown/
  JSON export, automatic A4 fitting, Markdown AI bridge, optional MCP server,
  invite-only accounts, optional email 2FA, share links, version history,
  GDPR export/delete, demo mode.

See `NEUTRALIZATION.md` for the generalization status and remaining work.
