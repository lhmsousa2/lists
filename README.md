# Lists

Personal iPhone web app: a To-Do list and a Shopping (things to buy) list, sorted by priority 1–4.

- Rules (sorting, due dates, validation, links): `js/model.js` (tested in `tests/model.test.js`)
- Run tests: `node --test`
- Run locally: `node tools/serve.mjs` → http://localhost:8124
- Regenerate icons: `node tools/make-icons.mjs`

Data is stored only on the device (localStorage, keys prefixed `lists.`). Use Settings → Export backup.
When changing any cached file, bump `CACHE` in `sw.js`.
