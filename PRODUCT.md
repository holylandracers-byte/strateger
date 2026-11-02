# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Several roles share one race: the strategist who plans and adjusts stints, team members and drivers who follow the plan, and viewers who watch (the app has a viewer join/approval flow). Used for karting endurance races, before the race (setup, qualifying, stint plan) and during it (live timing, pit calls). Desktop/laptop is the primary screen; tablet and phone (installed as a PWA) are secondary.

## Product Purpose
Race Strategy Manager for endurance karting (by Holyland Racing). It builds and updates pit/stint strategy, tracks live timing from several timing providers, and shares the plan with the team. Success: the strategist always knows the next decision at a glance, without hunting through the app.

## Capabilities and Constraints
Existing features: strategy planning, qualifying, live timing (Apex, Alpha, Racefacer, Hakafast scrapers), pit tracking (always auto-tracked from live timing), mid-race plan editing, viewer mode, admin, in-app walkthrough, many colour themes (about 25).
Constraint from the user: keep all features, but organise them so the app stays clear. Simplicity is the priority.
Web only, installable as a PWA. Code lives in plain HTML/CSS/JS (`index.html`, `css/style.css`, `js/*`).

## Operating Context
- Races come in two scenarios: Race only, or Qualifying + Race (qualifying has its own timer and driver order). Race creation is a guided, skippable wizard; the full setup screen remains as the advanced view.
- Tablets are used trackside and are sometimes underpowered; the app must stay smooth there (a Lite mode that cuts effects and throttles renders).
- UI is translated into 12 languages; every new phase/screen must use the i18n keys, never English-only strings.
- Per-driver pit-warning lead time must be explained in plain language (when the driver is warned, vs. the race default).

## Product Principles
- One primary task per moment; everything else is one step away, never competing.
- Keep every feature, but progressively disclose the rare ones.
- Simple over clever: fewer controls, plain labels, familiar patterns.
- The live race view must be glanceable and calm under pressure.

## Open decisions
- Which features count as rare (themes, admin, walkthrough) is not yet confirmed.
- Exact role names and permissions not yet confirmed.
