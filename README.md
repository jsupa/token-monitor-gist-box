<h3 align="center">GistBox</h3>
<p align="center">📌📋 A helper class for updating a single-file Gist<p>
<p align="center"><a href="https://npmjs.com/package/gist-box"><img src="https://badgen.net/npm/v/gist-box" alt="NPM"></a> <a href="https://action-badges.now.sh"><img src="https://action-badges.now.sh/JasonEtco/gist-box" alt="Build Status"></a> <a href="https://codecov.io/gh/JasonEtco/gist-box/"><img src="https://badgen.now.sh/codecov/c/github/JasonEtco/gist-box" alt="Codecov"></a></p>

## Usage

### Installation

```sh
$ npm install gist-box
```

```js
const { GistBox } = require('gist-box')
```

### API

```js
const box = new GistBox({ id, token })
await box.update({
  filename: 'example.md',
  description: 'A new description',
  content: 'The new content'
})
```

You can also import some boundary numbers to use when dealing with pinned Gists:

```js
const {
  MAX_LENGTH, // The number of characters rendered in one line
  MAX_LINES,  // The number of lines it will render
  MAX_HEIGHT, // The height of the box, in pixels
  MAX_WIDTH   // The width of the box, in pixels
} = require('gist-box')
```

### Token monitor box

`src/token-monitor.ts` turns the public stats document at
`https://token-monitor-hub.kubov.link/api/public/stats` into a pinned-Gist box
showing this month's token total, a per-month history bar, and the peak day.

```sh
$ npm run stats                     # print the box
```

Set `GIST_ID` and `GITHUB_TOKEN` to push it to a Gist as well:

```sh
$ GIST_ID=abc123 GITHUB_TOKEN=xyz npm run stats
```

Override the source with `STATS_URL`, and the target file with `GIST_FILENAME`.
The rendered box is checked against `MAX_LINES` and `MAX_LENGTH`; any violation
is reported on stderr.

```
🪙 Monthly tokens · Sep 2026 · 2.41B
Sep        2.41B tokens   █████████████████████ 100.0%
Aug        2.20B tokens   ███████████████████▏░  91.5%
Jul        2.02B tokens   █████████████████▌░░░  83.9%
🔥 Peak day · Sep 13 · 415.7M
```

Rows follow [waka-box](https://github.com/matchai/waka-box): a 10-character
label, a 14-character value, a 21-cell bar drawn from `░▏▎▍▌▋▊▉█`, and a
right-aligned percentage. The last `MONTHS_SHOWN` months are shown, current
month first. The file name renders as the card's title; override it with
`GIST_FILENAME`.

Bars scale the largest month to 100%. Pass `{ percentBasis: 'total' }` to
`buildTokenMonitorBox` instead and the months sum to 100% the way waka-box
shares add up. Pass `{ headline: false }` for rows only, leaving the title to
the file name.

### Running it on GitHub

`GH_TOKEN` is accepted as an alias for `GITHUB_TOKEN`, so the secret names are
the same ones waka-box uses.

1. Create a new public Gist (https://gist.github.com/)
1. Create a token with the `gist` scope (https://github.com/settings/tokens/new).
   The workflow's own `GITHUB_TOKEN` cannot write to a Gist, so this must be a
   personal access token.
1. In this repo go to **Settings > Secrets and variables > Actions** and add:
   - **GIST_ID:** the ID from your gist url, `https://gist.github.com/jsupa/`**`6d5f84419863089a167387da62dd7081`**
   - **GH_TOKEN:** the token from step 2
1. Trigger `.github/workflows/gist.yml` from the **Actions** tab, or wait for
   the hourly schedule.

The workflow sets `REQUIRE_GIST=1`, so a run with a missing secret fails loudly
instead of finishing green without updating anything.

Two things worth knowing about scheduled workflows: GitHub disables them after
60 days without repository activity, and the schedule is best-effort, so runs
can land several minutes late.

---

Shoutout to [@matchai](https://github.com/matchai) for starting this trend with [bird-box](https://github.com/matchai/bird-box)!
