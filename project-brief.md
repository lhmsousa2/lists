# Project Brief: Lists

## Goal
A single place on my iPhone to not forget things: what I have to do, and what I want to buy.
It's for organising priorities day to day. Shopping here means planned purchases (e.g. gear for a home office
renovation), not groceries.

## Who it's for
Just Luis, on his iPhone. Interactive app opened from the home screen. No sharing, no sync, no login.

## Inputs & data
Everything is typed in by hand. Data lives only on the phone (same model as the Routine app).

- **Two tabs:** To-Do (main tab, opens first) and Shopping.
- **Every item:** name, priority 1–4 (1 = highest), category, free-text notes (links pasted in are tappable).
- **To-Dos only:** optional due date. When it's due or overdue, the task turns red.
- **Categories:** his own (create/rename/delete), one set per tab, a few starters to begin with.
- **Sorting:** priority first, then due date. Filter by category via chips.
- **Ticking off** moves an item to a collapsed "Done" / "Bought" section where it can be restored or cleared.
  Undo toast for mis-taps.

## Success criteria (v1)
- Installable from Safari to the home screen and works offline, hosted on GitHub Pages like Routine.
- Adding an item takes a few seconds.
- Overdue/today tasks are obvious at a glance.
- Export/Import backup to Files / iCloud Drive.
- Same look as Routine: pastel beige light mode, dark mode, theme toggle.

## Explicit non-goals
Prices/budgets, projects, quantities, calendar export, sharing/sync, Mac version, real push notifications.

## Constraints & risks
- **Data loss:** on-device only. Removing the app from the home screen or a new phone means data is gone
  unless he has exported a backup. Mitigation: Export/Import plus a weekly Shortcuts nudge.
- **No real reminders:** a web app on GitHub Pages can't schedule notifications. Mitigation: red overdue items,
  plus one daily iOS Shortcuts automation reminding him to open the app.
- **Same web address as Routine** (`lhmsousa2.github.io`): the two apps must not clash on storage keys or caches.

## Open questions
None.

## Next steps
1. Build v1 in `Phone Apps/lists/`.
2. Create the GitHub repo `lhmsousa2/lists` (public, required for free Pages) and enable Pages from `main`.
3. Luis installs it from Safari, then Share → Add to Home Screen, and sets up the Shortcuts reminder.
