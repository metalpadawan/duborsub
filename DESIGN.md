---
name: AniRate
description: Every anime hung as a catalogued work, its sub and dub set as two measured states.
colors:
  klein: "#002fa7"
  klein-deep: "#00237d"
  klein-wash: "rgb(0 47 167 / 0.07)"
  wall: "#f3f3f1"
  wall-2: "#e9e9e6"
  wall-3: "#dcdcd7"
  field: "#fbfbfa"
  ink: "#111111"
  ink-2: "#3b3b39"
  graphite: "#686865"
  rule: "rgb(17 17 17 / 0.12)"
  rule-strong: "rgb(17 17 17 / 0.3)"
  on-klein: "#ffffff"
  on-ink: "#f3f3f1"
  on-ink-2: "rgb(243 243 241 / 0.68)"
  danger: "#a1231b"
  danger-wash: "rgb(161 35 27 / 0.06)"
typography:
  display:
    fontFamily: "Archivo, 'Helvetica Neue', Helvetica, Arial, sans-serif"
    fontSize: "clamp(2.6rem, 6.6vw, 5.4rem)"
    fontWeight: 580
    lineHeight: 0.94
    letterSpacing: "-0.03em"
    fontVariation: "'wdth' 112"
  title-xl:
    fontFamily: "Archivo, 'Helvetica Neue', Helvetica, Arial, sans-serif"
    fontSize: "clamp(2.25rem, 4.8vw, 4.25rem)"
    fontWeight: 580
    lineHeight: 0.96
    letterSpacing: "-0.028em"
    fontVariation: "'wdth' 112"
  title-l:
    fontFamily: "Archivo, 'Helvetica Neue', Helvetica, Arial, sans-serif"
    fontSize: "clamp(1.75rem, 2.6vw, 2.25rem)"
    fontWeight: 560
    lineHeight: 1.05
    letterSpacing: "-0.022em"
  title-m:
    fontFamily: "Archivo, 'Helvetica Neue', Helvetica, Arial, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.012em"
  lede:
    fontFamily: "Archivo, 'Helvetica Neue', Helvetica, Arial, sans-serif"
    fontSize: "clamp(1.0625rem, 1.3vw, 1.25rem)"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "Archivo, 'Helvetica Neue', Helvetica, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    fontVariation: "'wdth' 100"
  prose:
    fontFamily: "Archivo, 'Helvetica Neue', Helvetica, Arial, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.65
  caption:
    fontFamily: "Archivo, 'Helvetica Neue', Helvetica, Arial, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.6
  signage:
    fontFamily: "Archivo, 'Helvetica Neue', Helvetica, Arial, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 640
    lineHeight: "1rem"
    letterSpacing: "0.08em"
    fontVariation: "'wdth' 125"
  measure:
    fontFamily: "Archivo, 'Helvetica Neue', Helvetica, Arial, sans-serif"
    fontSize: "clamp(3rem, 6vw, 4.75rem)"
    fontWeight: 560
    lineHeight: 0.9
    letterSpacing: "-0.04em"
    fontFeature: "'tnum' 1, 'lnum' 1"
rounded:
  none: "0px"
spacing:
  xxs: "0.25rem"
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
  xxl: "3rem"
  margin: "clamp(1.25rem, 4vw, 3.5rem)"
  gutter: "clamp(1rem, 2.2vw, 2rem)"
  max: "92rem"
  masthead: "4.25rem"
components:
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.wall}"
    rounded: "{rounded.none}"
    padding: "0 1.35rem"
    height: "3rem"
  button-ink-hover:
    backgroundColor: "{colors.klein}"
    textColor: "{colors.wall}"
  button-line:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0 1.35rem"
    height: "3rem"
  button-line-hover:
    backgroundColor: "{colors.wall-2}"
    textColor: "{colors.ink}"
  button-white:
    backgroundColor: "{colors.on-ink}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0 1.35rem"
    height: "3rem"
  button-white-hover:
    backgroundColor: "{colors.klein}"
    textColor: "{colors.on-klein}"
  button-sm:
    padding: "0 1rem"
    height: "2.5rem"
  input:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0 1rem"
    height: "3.25rem"
  search:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    height: "3.5rem"
  tab:
    textColor: "{colors.ink-2}"
    padding: "0.25rem 0"
  tab-active:
    textColor: "{colors.klein}"
  tile:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
  tile-pressed:
    backgroundColor: "{colors.klein}"
    textColor: "{colors.on-klein}"
  measure:
    textColor: "{colors.ink}"
    typography: "{typography.measure}"
  measure-lead:
    textColor: "{colors.klein}"
  measure-empty:
    textColor: "{colors.graphite}"
  masthead:
    backgroundColor: "rgb(243 243 241 / 0.86)"
    textColor: "{colors.ink}"
    height: "{spacing.masthead}"
  black-wall:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
  tag:
    textColor: "{colors.graphite}"
    rounded: "{rounded.none}"
    padding: "0.1rem 0.35rem"
  notice-error:
    backgroundColor: "{colors.danger-wash}"
    textColor: "{colors.danger}"
    rounded: "{rounded.none}"
    padding: "0.9rem 1rem"
  notice-ok:
    backgroundColor: "{colors.klein-wash}"
    textColor: "{colors.klein-deep}"
    rounded: "{rounded.none}"
    padding: "0.9rem 1rem"
---

# Design System: AniRate

## Overview

**Creative North Star: "The Collection"**

AniRate is a white-cube gallery. Every anime hangs as a catalogued work, and its sub and dub are two measured states printed on the work's wall label. The ground is plaster, the type is gallery-black ink, and a single ink of International Klein Blue marks the one thing the visitor came to learn: which version leads, and which choice is active. Everything else stays quiet so that one blue mark is legible across a room.

The system borrows the wall label and the catalogue raisonné. Archivo is set as wall-label lettering, with its width axis doing the work of a second face. Corners are square, divisions are hairline rules, and every score is a tabular figure over a ruled track scaled to five. The catalogue is a ruled checklist on plaster, not a poster grid: covers are small objects in a list, and only the featured work on the home page and the work on its own page are hung large, with a soft gallery shadow. The density is calm and editorial, generous at the head of each page and tight in the checklist.

Motion is a curator's hand, not a show. Each page gets one authored entrance (the hang on the home hero, the split drawing in on the work page), and cross-document view transitions carry a catalogue thumbnail into the hung work, in pure CSS so the zero-JavaScript catalogue gets it too. The whole system is light-only (`color-scheme: light`); the only dark grounds are gallery-black walls.

**Key Characteristics:**
- Plaster ground, gallery-black ink, one ink of Klein blue reserved for the leading version and the active choice.
- One family, Archivo, with the width axis set to 125 for signage, 112 for display, 100 for reading.
- Square corners, hairline rules, 2:3 work frames, tabular measures on ruled tracks.
- One 12-column grid; the featured work hangs in the right six columns beside its wall label.
- Missing data is labelled in graphite words, never filled.
- Keyboard-first: skip links, a "/" shortcut to search, a visible Klein focus ring.
- One authored entrance per page, view-transition morphs between list and work, and a complete reduced-motion path.

## Colors

A near-achromatic warm plaster palette with one saturated ultramarine held in reserve.

### Primary
- **International Klein Blue** (#002fa7): the leading measure (its figure, its name, and its track fill), the leading word and gap in the verdict sentence, the leading distribution bars, the active sort and genre tab with its underline, a pressed rating tile, met password rules, saved-rating status, account links set as Klein links, the focus ring, the text caret, the selection highlight, and the hover state of the ink and white buttons and the brand mark. Nothing large is ever painted in it.
- **Klein Deep** (#00237d): text inside the confirmation notice, where Klein sits on its own wash.
- **Klein Wash** (rgb(0 47 167 / 0.07)): the ground of the confirmation notice, paired with a 40% Klein border.

### Neutral
- **Plaster Wall** (#f3f3f1): the page ground everywhere, the text on ink buttons, and the scrollbar track.
- **Shadowed Plaster** (#e9e9e6): the ground behind a work and its no-cover plate, checklist row hover, line-button hover, and loading skeletons.
- **Dust Grey** (#dcdcd7): the faintest marks, the breadcrumb separator and the scrollbar thumb.
- **Fresh Card** (#fbfbfa): input and search fields, a hair lighter than the wall, like a card pinned to it.
- **Gallery Black** (#111111): primary text, the ink button, measure fills that do not lead, the brand mark, and the large dark fields (the colophon and the auth wall).
- **Label Ink** (#3b3b39): secondary reading text, the lede, prose, field labels, idle tabs, note bodies, distribution bars that do not lead.
- **Graphite** (#686865): captions, provenance lines, column heads, idle control names, placeholders, and every labelled absence. It holds 5.0:1 on the wall and 4.6:1 on shadowed plaster.
- **Hairline** (rgb(17 17 17 / 0.12)): every structural division and the empty measure track.
- **Strong Hairline** (rgb(17 17 17 / 0.3)): field and line-button borders, tile borders, the plate's foot rule, the vacant frame, reply indents, kbd keys.
- **Plaster on Black** (#f3f3f1) and **Dimmed Plaster** (rgb(243 243 241 / 0.68)): text and secondary text on the black walls.
- **Paper White** (#ffffff): the numeral on a pressed Klein tile and selected text.
- **Conservator's Red** (#a1231b) with **Red Wash** (rgb(161 35 27 / 0.06)): errors only, the error notice, an invalid field's border, the delete action and its hover.

### Named Rules
**The Two-Ink Rule.** The page is printed in ink on plaster; Klein is a second ink that appears only where a version leads, where a choice is active or confirmed, on focus and link actions, and as the hover of a call to action. If a blue mark does not answer "which leads" or "what is chosen", it is ink.

**The Black Wall Rule.** Large dark fields are gallery black, never Klein. The colophon and the auth wall are ink with plaster type; on them the selection inverts to plaster and the focus ring turns plaster, so Klein never lands on black.

## Typography

**Display Font:** Archivo (with Helvetica Neue, Helvetica, Arial)
**Body Font:** Archivo (with Helvetica Neue, Helvetica, Arial)
**Label/Mono Font:** Archivo at its expanded width for labels; a system monospace (ui-monospace, Cascadia Mono, Menlo) only for a reset link printed inside a notice.

**Character:** One grotesque carries the whole identity. Its width axis turns the same letters into wall-label signage when expanded and into tight, heavy display lettering at a slightly widened cut, so the gallery reads as one hand. Archivo is self-hosted at build time by next/font as a variable font, so no request leaves for a font service at runtime.

### Hierarchy
- **Display** (580, clamp(2.6rem, 6.6vw, 5.4rem), 0.94, -0.03em, wdth 112, balanced): the home headline and the colophon's invitation, both set in two short stacked lines.
- **Headline / title-xl** (580, clamp(2.25rem, 4.8vw, 4.25rem), 0.96, -0.028em, wdth 112): a work's title on its page and the vacant page's title.
- **Title / title-l** (560, clamp(1.75rem, 2.6vw, 2.25rem), 1.05, -0.022em): the collection heading and auth form headings.
- **Title / title-m** (600, 1.25rem, 1.2, -0.012em): section heads on the work page (The split, Your rating, Notes) and empty-state lines.
- **Lede** (400, clamp(1.0625rem, 1.3vw, 1.25rem), 1.5, max 38ch, Label Ink): the one-line offer under a display headline.
- **Body** (400, 1rem, 1.6, wdth 100): interface text.
- **Prose** (400, 1.0625rem, 1.65, max 62ch, Label Ink): synopses and long notes.
- **Caption** (400, 0.8125rem, Graphite): provenance, captions, counts, the colophon foot.
- **Label / signage** (640, 0.6875rem, 1rem line, 0.08em tracking, uppercase, wdth 125): field labels, measure names, column heads, control names, plate notes, the Sample tag.
- **Measure** (560, tabular lining figures, negative tracking): the score figure, at 1.125rem in the checklist, 2rem on the hero's wall label (1.5rem on phones), and clamp(3rem, 6vw, 4.75rem) at 0.9 line height and -0.04em in the work page's split.

### Named Rules
**The One Family Rule.** Archivo is the only face. A new role gets a weight and a width setting, never a second family: 125 for signage and no-cover plates, 112 for display, headline, and the brand, 100 for reading.

**The Wall Label Rule.** Signage names a field, a measure, a column, or a control. It is never set as an eyebrow or kicker over a heading.

**The Tabular Figure Rule.** Every number that is a measurement or a count (scores, gaps, rating counts, page numbers, years, distribution counts, tile numerals) is set with tabular lining figures so columns of scores align on the rule.

## Layout

The page is one 12-column grid (`repeat(12, minmax(0, 1fr))`) inside a centred wrap that tops out at 92rem, with a fluid outer margin of clamp(1.25rem, 4vw, 3.5rem) and a fluid gutter of clamp(1rem, 2.2vw, 2rem). Page compositions place on that grid; components inside it (the checklist row, the split, the wall label, the rating tiles) use their own small fixed tracks rather than a second page grid.

- **Home:** the hero splits at the centre line, columns 1 to 6 for the display headline, the lede, and search as the room index, columns 7 to 12 for the featured work hung beside its wall label (work and label at 1.3fr to 1fr, aligned to the bottom). Below, the collection is a full-width ruled checklist with five tracks: a 3.5rem thumb, the title, 9rem sub, 9rem dub, 7rem leads.
- **Work page:** the work hangs in columns 1 to 5 and stays sticky beneath the masthead; column 6 is left empty as wall; the label (title, facts, provenance, synopsis, the split, your rating, notes) runs down columns 7 to 12 in hairline-topped sections 2.75rem apart.
- **Auth:** a 5fr to 7fr room, the black wall on the left and the form desk on the right, the form capped at 26rem.

The masthead is sticky at 4.25rem and the document scroll padding clears it. Vertical rhythm steps through 0.25, 0.5, 0.75, 1, 1.5, 2, and 3rem, with fluid clamps for section padding at the head and foot of each page.

**Responsive behaviour.** At 1100px the hung work stacks above its label and the checklist tracks tighten (7.5rem, 7.5rem, 6rem). At 860px the hero and the work page stack to full width, the work page's frame shrinks to 16rem and stops sticking, and the auth room becomes one column with its ruled points hidden. At 720px checklist rows reflow into two lines (thumb, title, verdict above; sub and dub below), column heads disappear, and each measure prints its own name. At 480px the work page keeps its title and split in the first screen: the plate sits in an 8.5rem column with the title and facts beside it and everything else runs full width; provenance phrases stack, and the hero's wall-label measures stack. The "/" search hint is hidden on devices with no hover.

### Named Rules
**The One Grid Rule.** Every page composition places on the same 12 columns; a layout that needs a different page grid is a different system.

## Elevation & Depth

Chrome is flat and objects are lit. Interface surfaces sit flush on the plaster and are separated by hairline rules, not shadows or tonal cards. Depth belongs to the works: a cover hung on the wall casts a soft, offset gallery shadow, and a thumbnail lifts slightly when its checklist row is hovered. The masthead is the one frosted surface, plaster at 86% over a 14px blur with a little extra saturation, so content passes beneath it without a hard edge.

### Shadow Vocabulary
- **Hung** (`box-shadow: 0 1px 1px rgb(17 17 17 / 0.06), 0 2px 4px rgb(17 17 17 / 0.06), 0 22px 44px -18px rgb(17 17 17 / 0.34)`): a work hung large, on the home hero and the work page. In the hang it arrives last, as the work settles.
- **Lifted** (`box-shadow: 0 1px 1px rgb(17 17 17 / 0.08), 0 10px 22px -10px rgb(17 17 17 / 0.4)`): a checklist thumbnail on row hover, with a 2px rise.
- **Search focus** (`box-shadow: 0 0 0 1px #111111, 0 14px 30px -18px rgb(17 17 17 / 0.45)`): the search field while it holds focus, the one state-driven lift in the chrome.

### Named Rules
**The Lit Object Rule.** Shadows fall only from works on the wall. Buttons, fields, sections, and panels stay flat; the search field's focus lift is the single exception.

## Shapes

Every corner is square (0px), including fields, buttons, tiles, frames, notices, and the search bar. Form comes from rules and proportion instead: 1px hairlines divide, 1px strong hairlines outline anything interactive, measure tracks are 2px (3px in the split), distribution bars 6px, and the active tab underline 2px. Works and plates are 2:3 portrait frames. Small marks are squares too: the brand mark is a solid 0.95rem square that turns 90 degrees and goes Klein on hover, the signed-in user carries a small black square, meta items are separated by 3px squares, and password rules tick by filling a square. The only dashed line is the vacant frame. Icons are drawn on one 16px grid with a 1.5px stroke and square caps, and the set is limited to the two arrows.

### Named Rules
**The Square Corner Rule.** Radius is zero everywhere. A rounded corner reads as an app, not a gallery.

## Components

### Buttons
Set like printed signage: solid, square, and sure, with the colour change doing the work.
- **Shape:** square corners (0px), 3rem minimum height, 0 1.35rem padding, 0.9375rem at weight 600, 1px border.
- **Ink (primary):** Gallery Black ground with plaster type. Hover turns the ground Klein, the call-to-action hover.
- **Line (secondary):** transparent with a strong hairline border and ink type. Hover darkens the border to ink and lays shadowed plaster underneath.
- **White (on a black wall):** plaster ground with ink type; hover goes Klein with white type. Its partner on the black wall is an outline button with a 40% plaster border that firms up on hover.
- **Small and block:** 2.5rem tall with 0 1rem padding for the masthead and inline actions; full width for auth forms.
- **States:** press scales to 0.98; a trailing arrow nudges 3px right on hover; disabled drops to 45% opacity, and a pager link with nowhere to go drops to 35% and stops taking pointer events.

### Links
- **Drawn underline:** a 1px rule draws in from the left on hover over 220ms, like a label line being ruled. The masthead's current page keeps its underline drawn in ink.
- **Ruled:** a resting strong-hairline rule under the text, overdrawn in the text colour on hover; used for "View the work", the synopsis toggle, and auth cross-links.
- **Klein:** a ruled link printed in Klein, kept for the account actions (the auth cross-links and the sign-in prompt above the notes).
- **Text action:** small graphite weight-600 text for secondary actions such as clearing ratings; hover turns it red because those actions remove something.

### Inputs / Fields
- **Style:** Fresh Card ground, 1px strong-hairline border, square corners, 3.25rem tall with 1rem side padding; placeholder in graphite; a Klein caret. Labels sit above in signage, Label Ink.
- **Hover / Focus:** hover darkens the border to Label Ink; focus sets the border to ink and draws a 2px Klein bar along the inside of the bottom edge, like a rule being underlined.
- **Error:** an invalid field's border turns Conservator's Red; the form's message appears in an error notice above.
- **Password:** a text "Show / Hide" control sits inside the right edge and turns Klein on hover. Under the register field the policy is listed as four small squares that fill Klein as each rule is met.
- **Textarea:** 7.5rem tall, vertical resize only.

### Notices
A ruled box with square corners and 0.9rem by 1rem padding that settles in from 4px above. The error notice is red text on a red wash with a 45% red border; the confirmation notice is Klein Deep on a Klein wash with a 40% Klein border.

### Navigation
- **Masthead:** sticky, frosted plaster over a hairline, 4.25rem tall. The brand (a black square and the name at weight 650, wdth 112) on the left; Collection and Rankings as drawn-underline links, then Sign in and a small ink Join button, on the right. Under 720px the two section links hide. It keeps its own view-transition name, so it holds still while pages change beneath it.
- **Tabs (sort and genre):** plain links in Label Ink at 0.9375rem (0.875rem for genres), named by a signage control label. Hover darkens the text and draws a Klein underline a third of the way; the current tab is Klein at weight 600 with the 2px underline drawn full width. They are links with `aria-current`, so the no-JavaScript catalogue filters by URL.
- **Breadcrumbs:** graphite caption text, Dust Grey slashes, the current work unlinked.
- **Pager:** the page state in tabular graphite on the left, previous and next line buttons on the right.

### Measure (signature)
The core component: a score set as a measurement. The version name in signage and the figure in tabular type share a baseline above a ruled track whose fill scales to the score out of five. When one version leads, its figure, name, and fill print in Klein and the other stays ink. A version with no score prints graphite words ("Not rated", "No ratings", "Not listed") and hides its track, so no orphan rule implies a value. The figures carry screen-reader text ("out of 5", "not yet rated"). On the work page the pair is set very large in the split, with vote counts, a five-step distribution under each (bars fill Klein for the leader), and a verdict sentence whose leading word and gap are Klein. In lists a verdict tag states the lead in short form ("Dub +0.5" in Klein, "Even" in ink, "Sub only" or "Unrated" in graphite). Every surface takes its leader, gap, and wording from one function, so the comparison is said one way only.

### Wall Label and the Hang (signature)
The featured work on the home hero is hung beside its wall label: the title as a drawn-underline link, a meta line, the provenance line, the sub and dub measures side by side, and the verdict with a ruled "View the work" link. Its entrance is the page's one authored moment: the canvas unveils top-down onto the wall (1100ms), the image settles from 108% scale, the hung shadow arrives as it lands, the label lines set in one after another 80ms apart, and the two rules draw in last, dub 140ms behind sub. The hero copy rises in beside it in the same beat.

### Catalogue Checklist Entry
Each title is one ruled row: a 2:3 thumbnail, the title (1.0625rem, weight 600, single line with ellipsis) over a graphite meta line, the sub and dub measures, and the verdict tag. Rows are divided by hairlines; hover lays shadowed plaster under the row and lifts the thumbnail. Signage column heads name the measures on wide screens, so each row's measure names are kept for screen readers only until the narrow layout prints them. A row with nothing to compare reads "No ratings yet" across the measure columns; a dub the record does not report reads "Not listed". Demo titles carry a small bordered "Sample" tag. Where the browser supports scroll-driven animation, rows rise in as they enter the viewport; elsewhere they are simply there.

### Work Frame and Plate
A cover fills a 2:3 frame on shadowed plaster. A record with no cover gets a typeset plate, never a broken image: at hung size the title's words are stacked down the plate in the expanded cut at weight 620, sized by container query to the longest word, with "No cover on record" in signage over a strong hairline at the foot; at thumbnail size the plate holds a single initial. Thumbnails and hung works share a `work-<id>` view-transition name, so following a row morphs its thumbnail into the hung work.

### Rating Tiles
Five numbered square tiles per version (strong hairline border, 1.125rem tabular numerals, 1.25 aspect ratio, row capped at 26rem). Hover firms the border to ink; press scales to 0.96; the chosen tile fills with Klein rising from its floor over 220ms, with a white numeral. Tiles are toggle buttons (`aria-pressed`) in a labelled group, and a polite status line beneath confirms "Saved." in Klein or a failure in red. When no dub is listed, only the sub row is offered, with a line saying why.

### Black Walls: Colophon and Auth Room
Every page closes on a gallery-black colophon: on catalogue pages a display invitation ("Watched it? Rate both versions."), a dimmed lede, and a white button with an outline partner; on the work page only the foot (brand and source credit over a 22% plaster hairline). The auth pages put the same black wall on the left of the room, with the brand, the display thesis, and three ruled points named in signage; it carries its own view-transition name so it holds between sign-in and register.

### Empty, Loading, and Vacant States
- **Empty results:** a ruled block with a title-m line, a graphite suggestion, and a small line button to clear filters.
- **Loading:** shadowed-plaster skeleton blocks in the final layout, breathing between full and 55% opacity, so nothing jumps on arrival.
- **Vacant:** a dashed 2:3 frame labelled "Vacant" in signage, a title-xl line, prose, and an ink button back to the collection; shared by both not-found pages and a missing work.

### Notes
A visitors' book under the work: hairline-separated notes with the author at weight 600, the body in Label Ink at up to 62ch, replies indented 1.25rem behind a strong hairline, and a removed note shown in graphite italic rather than deleted from the thread.

## Do's and Don'ts

### Do:
- **Do** keep Klein (#002fa7) to the leading measure, the active tab or tile, confirmations, focus, Klein links, and call-to-action hover; a screen should read as ink on plaster with a few blue marks.
- **Do** set every score as a Measure: signage name, tabular figure, and a 2px ruled track scaled to five, with the leader in Klein and both versions always shown side by side.
- **Do** label missing data in graphite words ("No ratings yet", "Not listed", "Dub not reported", "No cover on record", "Sample record") and hide the empty track.
- **Do** print a provenance line on every wall label, and tag the demo titles as Sample.
- **Do** place page compositions on the 12-column grid with the clamp margin and gutter, and divide content with 1px hairlines.
- **Do** keep every interaction reachable by keyboard: a skip link first on each page, "/" to focus search (Escape to leave), the 2px Klein focus ring at a 3px offset, links with `aria-current` for filters, and toggle buttons with `aria-pressed` for tiles.
- **Do** give each page one authored entrance, use the shared `work-<id>` view-transition name for any new surface that shows a work, and keep the entrance working in pure CSS.
- **Do** provide the reduced-motion path for anything that moves: view transitions off, animations cut to an instant end state, scroll arrival off, hover lifts and press scales removed, while colour and fill changes still confirm actions.

### Don't:
- **Don't** paint a large field, panel, or banner in Klein; dark grounds are gallery black (#111111).
- **Don't** lay the collection out as a dark streaming poster grid; it is a ruled checklist on plaster, with covers as small objects.
- **Don't** publish one blended score, or imply dub data the record does not report.
- **Don't** fill an absence with zeros, a row of dashes, stock art, or a broken image.
- **Don't** round a corner.
- **Don't** add a second typeface; reach for Archivo's weight and width axis instead.
- **Don't** set signage as an eyebrow or kicker over a heading.
- **Don't** put shadows on buttons, fields, sections, or panels; shadows belong to works on the wall, and the search field's focus lift is the only exception.
- **Don't** set scores, counts, or page numbers in proportional figures.
- **Don't** add a second authored entrance to a page that already has one.
