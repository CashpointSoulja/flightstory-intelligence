# Current visual spec — FlightStory Archive

Captured before the Steven.com inspired redesign on 16 September 2026.

## Current interface

- **Canvas:** near-black `#0d0e10` throughout, with a soft violet radial wash behind the archive hero.
- **Surfaces:** translucent dark panels (`#111216`) with thin white borders at low opacity.
- **Type:** Manrope for UI and display copy; DM Mono for labels, counts, status, and navigation; Georgia for transcript excerpts.
- **Accent system:** violet `#bba4ff` for selected states and links, mint `#a6e8c3` for ready/healthy states, gold `#e5bd77` for evidence, blue `#94bfff` for graph videos.
- **Header:** 70px glassy top bar with a circular F mark, centre status line, archive/drafts navigation, and public-source status pill.
- **Hero:** a two-column composition. Copy is anchored left with “Everything connected.”, search beneath it, and the nebula/knowledge graph visual occupying the right half.
- **Workspace:** three columns on desktop: map layers rail, research results, and selected evidence inspector. It collapses to a single column on small screens.
- **Results:** restrained citation rows, a source drawer/inspector, searchable answer, and local clip drafts below the workspace.
- **Motion:** smooth scrolling, glass blur, static hero art, and motion handled primarily by the interactive graph. Reduced-motion rules exist for the graph.

## Design problems observed

The current system reads as a dark research dashboard. It is legible and functional, but its hierarchy is quiet, surfaces are too similar, and the UI does not carry the expressive editorial energy of Steven.com. Violet dominates the interface, while the important actions and research states do not have enough visual separation.

## New direction

Keep the evidence-first behaviour and the interactive archive, but move the visual language toward an editorial studio:

- warm paper and ink as the base; deep black for moments of focus;
- one confident red/coral action colour, with cobalt reserved for active archive signals;
- oversized, tight display type and small mono metadata;
- asymmetry, hard rules, and generous breathing room;
- tactile buttons, visible focus rings, and clear source hierarchy;
- restrained entrance motion and hover response that make the tool feel alive without distracting from research;
- a dark graph field retained as a “window into the archive”, framed by the paper interface.

## Interaction intent

The first decision should always be obvious: ask a question or follow a node. The second should be evidence inspection. Clip saving stays available at the source inspector and drafts remain a distinct review area. All existing IDs, data attributes, keyboard behaviour, external source links, local storage, shared review hooks, and reduced-motion support remain unchanged.

## 16 September 2026 — light deslop pass

The interface now uses a white, paper-like base for the product shell, with black ink, quiet grey rules, and a single coral signal. The graph remains a contained soft-grey/light canvas so the archive can feel alive without turning the whole product into a dark AI dashboard. FlightStory’s Neue Haas Grotesk Display reference is used across the interface, with size and weight—not a second font family—creating hierarchy.

The design commitment is **human, exact, alive, provocative, cinematic** — an **instrument for a living archive of thought**. The main action is asking a question or selecting a node. Repeated prototype explanations, pill-shaped controls, and competing accent colours were reduced. Existing IDs, data attributes, search, graph, evidence, clips, shared review, keyboard behaviour, external links, local storage, and reduced-motion behaviour are preserved.

## 2026-09-16 interface reset: FlightStory question surface

The interface is now intentionally rebuilt around one action: asking the archive. The opening view is a white, quiet canvas with a restrained field of monochrome stars, a small FlightStory mark, one large question, one glass composer, and three example prompts. Search results continue below as a conversation thread with source moments and a selected evidence panel. Saved clips remain available below the thread; shared review still mounts only for an authenticated workspace user.

The visual system uses the FlightStory display face throughout, white and near-white translucent surfaces, black ink, soft grey rules, and a single coral signal accent. Glass is used for the composer and source surface only: light blur, a thin border, and a low shadow. Stars are the only decorative layer. There are no visible maps, dashboard rails, discovery cards, gradients, purple AI effects, or competing hero panels on the first screen.

The redesign preserves the functional hooks used by the product: `#search-form`, `#query`, `#results-content`, `#search-status`, `#question-heading`, `#evidence-panel`, `#evidence-content`, `#sample-question`, `#clips`, `#clip-list`, citation selection, source links, local draft editing/review/removal, shared review, keyboard focus, and reduced-motion behaviour. The map runtime remains loaded behind the existing `.hero-art` host for compatibility, but its controls and canvas are intentionally absent from the visible product surface.
