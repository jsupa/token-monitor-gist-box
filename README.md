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
🪙 Monthly tokens · Sep 2026 · 2.40B
2026-07    2.02B tokens   █████████████████▋░░░  84.1%
2026-08    2.20B tokens   ███████████████████▎░  91.7%
2026-09    2.40B tokens   █████████████████████ 100.0%
🔥 Peak day · Sep 13 · 415.7M
```

Rows follow [waka-box](https://github.com/matchai/waka-box): a 10-character
label, a 14-character value, a 21-cell bar drawn from `░▏▎▍▌▋▊▉█`, and a
right-aligned percentage. The last `MONTHS_SHOWN` months are shown.

Bars scale the largest month to 100%. Pass `{ percentBasis: 'total' }` to
`buildTokenMonitorBox` instead and the months sum to 100% the way waka-box
shares add up. Pass `{ headline: false }` for rows only, leaving the title to
the file name.

---

Shoutout to [@matchai](https://github.com/matchai) for starting this trend with [bird-box](https://github.com/matchai/bird-box)!
