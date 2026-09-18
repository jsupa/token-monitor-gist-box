import { get } from 'https'
import { URL } from 'url'
import { GistBox, MAX_LENGTH, MAX_LINES } from './index'

export const DEFAULT_STATS_URL = 'https://token-monitor-hub.kubov.link/api/public/stats'

export interface DailyEntry {
  date: string
  tokens: number
  cost?: number
}

export interface MonthlyEntry {
  month: string
  tokens: number
  cost?: number
}

export interface TokenStats {
  ok?: boolean
  updatedAt?: string
  periods?: {
    month?: { totalTokens?: number, costUsd?: number }
    allTime?: { totalTokens?: number, costUsd?: number }
  }
  historyPreview?: {
    daily?: DailyEntry[]
    monthly?: MonthlyEntry[]
    summary?: { peakDayTokens?: number }
  }
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/**
 * Bar glyphs, taken from waka-box: index 0 is the empty cell, 1-7 are
 * eighths of a block, 8 is full.
 */
const BAR_SYMS = '░▏▎▍▌▋▊▉█'
/** Width of the bar column, matching waka-box */
export const BAR_SIZE = 21
const LABEL_WIDTH = 10
const VALUE_WIDTH = 14
/** How many months of history to show */
export const MONTHS_SHOWN = 3
/** Default pinned-Gist file name, which renders as the card's title */
export const GIST_TITLE = '📊 Monthly token usage'
/** Redirect hops allowed before giving up */
export const MAX_REDIRECTS = 3
/** Give up on a stalled endpoint rather than hanging the runner */
export const REQUEST_TIMEOUT_MS = 15000
/** The real document is ~48KB; this only stops a runaway response */
export const MAX_RESPONSE_BYTES = 2 * 1024 * 1024

/**
 * Format a token count compactly: 2391694059 -> "2.39B", 415749863 -> "415.7M"
 */
export function formatTokens (value: number): string {
  if (!isFinite(value) || value <= 0) return '0'
  if (value >= 1e9) return (value / 1e9).toFixed(2) + 'B'
  if (value >= 1e6) return (value / 1e6).toFixed(1) + 'M'
  if (value >= 1e3) return (value / 1e3).toFixed(1) + 'K'
  return String(Math.round(value))
}

/**
 * "2026-09" -> "Sep"
 */
export function monthLabel (month: string): string {
  const index = parseInt(month.slice(5, 7), 10) - 1
  return MONTH_NAMES[index] || month
}

/**
 * "2026-09-13" -> "Sep 13"
 */
export function dayLabel (date: string): string {
  return monthLabel(date) + ' ' + parseInt(date.slice(8, 10), 10)
}

/**
 * waka-box's bar chart: `size` cells of empty `░`, filled with full blocks and
 * a single partial eighth block for the remainder.
 */
export function generateBarChart (percent: number, size: number = BAR_SIZE): string {
  const full = BAR_SYMS.substring(8, 9)
  const empty = BAR_SYMS.substring(0, 1)
  const frac = Math.floor((size * 8 * percent) / 100)
  const barsFull = Math.floor(frac / 8)
  if (barsFull >= size) return full.repeat(size)
  const semi = frac % 8
  return (full.repeat(barsFull) + BAR_SYMS.substring(semi, semi + 1)).padEnd(size, empty)
}

/**
 * Truncate with an ellipsis, counting the ellipsis against the budget.
 */
export function trimRightStr (str: string, len: number): string {
  return str.length > len ? str.substring(0, len - 3) + '...' : str
}

/**
 * One waka-box style row: label, value, bar, percentage.
 */
export function buildRow (label: string, value: string, percent: number): string {
  return [
    trimRightStr(label, LABEL_WIDTH).padEnd(LABEL_WIDTH),
    value.padEnd(VALUE_WIDTH),
    generateBarChart(percent),
    String(percent.toFixed(1)).padStart(5) + '%'
  ].join(' ')
}

/**
 * The most recent `count` months, oldest first, trimmed to non-empty entries.
 */
export function recentMonths (months: MonthlyEntry[], count: number): MonthlyEntry[] {
  return months.filter(m => m.tokens > 0).slice(-count)
}

/**
 * The highest-usage day from the daily rollup.
 */
export function peakDay (daily: DailyEntry[]): DailyEntry | undefined {
  return daily.reduce<DailyEntry | undefined>(
    (best, day) => (best === undefined || day.tokens > best.tokens ? day : best),
    undefined
  )
}

export interface BoxOptions {
  /**
   * What the bar and percentage measure. `max` scales the largest month to
   * 100%, `total` makes the months sum to 100% the way waka-box does.
   */
  percentBasis?: 'max' | 'total'
  /**
   * waka-box renders rows only and lets the file name carry the title. On by
   * default here, which adds the monthly total above and the peak day below.
   */
  headline?: boolean
}

/**
 * waka-box style rows, one per month and newest last.
 */
export function buildMonthRows (months: MonthlyEntry[], basis: 'max' | 'total' = 'max'): string[] {
  const max = months.reduce((best, m) => Math.max(best, m.tokens), 0)
  const total = months.reduce((sum, m) => sum + m.tokens, 0)
  const divisor = basis === 'total' ? total : max
  return months.map(month => {
    const percent = divisor > 0 ? (month.tokens / divisor) * 100 : 0
    // The value column carries its unit, the way waka-box shows "12 hrs 28 mins"
    return buildRow(month.month, `${formatTokens(month.tokens)} tokens`, percent)
  })
}

/**
 * Build the full Gist box. Kept within the pinned-Gist line and width limits.
 */
export function buildTokenMonitorBox (stats: TokenStats, options: BoxOptions = {}): string {
  const preview = stats.historyPreview || {}
  const months = recentMonths(preview.monthly || [], MONTHS_SHOWN)

  if (months.length === 0) {
    return 'No usage history reported by the API.'
  }

  const lines = buildMonthRows(months, options.percentBasis)

  if (options.headline !== false) {
    const current = months[months.length - 1]
    const peak = peakDay(preview.daily || [])
    lines.unshift(`🪙 Monthly tokens · ${monthLabel(current.month)} ${current.month.slice(0, 4)} · ${formatTokens(current.tokens)}`)
    if (peak) {
      lines.push(`🔥 Peak day · ${dayLabel(peak.date)} · ${formatTokens(peak.tokens)}`)
    }
  }

  return lines.join('\n')
}

/**
 * Report any way the rendered box breaks the pinned-Gist limits.
 */
export function checkLimits (content: string): string[] {
  const problems: string[] = []
  const lines = content.split('\n')
  if (lines.length > MAX_LINES) {
    problems.push(`${lines.length} lines exceeds MAX_LINES (${MAX_LINES})`)
  }
  lines.forEach((line, index) => {
    if (line.length > MAX_LENGTH) {
      problems.push(`line ${index + 1} is ${line.length} chars, exceeds MAX_LENGTH (${MAX_LENGTH})`)
    }
  })
  return problems
}

/**
 * Aborting a transfer is best effort. A socket that is already gone, or a
 * test double standing in for one, can throw, and that must not stop the
 * caller from reporting why the fetch failed.
 */
function destroyQuietly (stream: { destroy: () => void }): void {
  try {
    stream.destroy()
  } catch (error) {
    return
  }
}

/**
 * Remote values are echoed into error messages, so strip control characters.
 * A server-controlled Location header could otherwise smuggle newlines or
 * ANSI escapes into the CI log.
 */
export function safeForLog (value: string): string {
  // tslint:disable-next-line:no-control-regex
  return String(value).replace(/[\u0000-\u001f\u007f]/g, '')
}

/** An unvalidated JSON object, before we know anything about its fields */
type JsonRecord = { [key: string]: unknown }

function isRecord (value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isEntry (entry: unknown, key: string): boolean {
  if (!isRecord(entry)) return false
  return typeof entry[key] === 'string' && typeof entry.tokens === 'number'
}

function isEntryArray (value: unknown, key: string): boolean {
  return Array.isArray(value) && value.every(entry => isEntry(entry, key))
}

/**
 * The payload is third-party JSON, so check the shape we rely on. Downstream
 * code calls .slice() on month names and .reduce() on these arrays, and a
 * shape change otherwise surfaces as a confusing TypeError.
 */
export function parseStats (value: unknown, url: string): TokenStats {
  if (!isRecord(value)) {
    throw new Error(`${safeForLog(url)} did not return a JSON object`)
  }

  const preview = value.historyPreview
  if (preview === undefined) return value as TokenStats

  if (!isRecord(preview)) {
    throw new Error(`${safeForLog(url)} returned a non-object historyPreview`)
  }
  if (preview.monthly !== undefined && !isEntryArray(preview.monthly, 'month')) {
    throw new Error(`${safeForLog(url)} returned a malformed historyPreview.monthly`)
  }
  if (preview.daily !== undefined && !isEntryArray(preview.daily, 'date')) {
    throw new Error(`${safeForLog(url)} returned a malformed historyPreview.daily`)
  }

  return value as TokenStats
}

/**
 * Fetch the public stats document. Redirects are followed a bounded number of
 * times and never off https, and the body is capped, so a misbehaving or
 * compromised endpoint cannot loop us, point us at an internal address, or
 * exhaust memory on an unattended run.
 */
export function fetchStats (url: string = DEFAULT_STATS_URL, redirectsLeft: number = MAX_REDIRECTS): Promise<TokenStats> {
  return new Promise((resolve, reject) => {
    let settled = false
    const fail = (error: Error) => {
      if (settled) return
      settled = true
      reject(error)
    }
    const succeed = (stats: TokenStats) => {
      if (settled) return
      settled = true
      resolve(stats)
    }

    const request = get(url, { headers: { accept: 'application/json', 'user-agent': 'token-monitor-gist-box' } }, res => {
      // Without this, a socket error part way through the body is an
      // unhandled 'error' event, which takes the whole process down
      res.on('error', fail)

      const { statusCode = 0 } = res
      const location = res.headers.location

      if (statusCode >= 300 && statusCode < 400 && location) {
        res.resume()
        if (redirectsLeft <= 0) {
          fail(new Error(`Too many redirects while fetching ${safeForLog(url)}`))
          return
        }
        let next: string
        try {
          next = new URL(location, url).toString()
        } catch (error) {
          fail(new Error(`Invalid redirect from ${safeForLog(url)}: ${safeForLog(location)}`))
          return
        }
        if (next.slice(0, 8) !== 'https://') {
          fail(new Error(`Refusing to follow a non-https redirect to ${safeForLog(next)}`))
          return
        }
        fetchStats(next, redirectsLeft - 1).then(succeed, fail)
        return
      }

      if (statusCode < 200 || statusCode >= 300) {
        res.resume()
        fail(new Error(`Request to ${safeForLog(url)} failed with status ${statusCode}`))
        return
      }

      let body = ''
      let size = 0
      res.setEncoding('utf8')
      res.on('data', (chunk: string) => {
        size += Buffer.byteLength(chunk)
        if (size > MAX_RESPONSE_BYTES) {
          destroyQuietly(res)
          fail(new Error(`Response from ${safeForLog(url)} exceeded ${MAX_RESPONSE_BYTES} bytes`))
          return
        }
        body += chunk
      })
      res.on('end', () => {
        try {
          succeed(parseStats(JSON.parse(body), url))
        } catch (error) {
          fail(new Error(`Could not parse response from ${safeForLog(url)}: ${error.message}`))
        }
      })
    })

    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.destroy()
      fail(new Error(`Request to ${safeForLog(url)} timed out after ${REQUEST_TIMEOUT_MS}ms`))
    })
    request.on('error', fail)
  })
}

export interface GistCredentials {
  id: string
  token: string
}

/**
 * Resolve Gist credentials from the environment. `GH_TOKEN` is accepted as an
 * alias for `GITHUB_TOKEN` so waka-box's secret names work unchanged.
 */
export function gistCredentials (env: NodeJS.ProcessEnv = process.env): GistCredentials | undefined {
  const id = env.GIST_ID
  const token = env.GITHUB_TOKEN || env.GH_TOKEN
  return id && token ? { id, token } : undefined
}

/**
 * Push the rendered box into the Gist.
 */
export async function pushToGist (
  stats: TokenStats,
  credentials: GistCredentials,
  options: { filename?: string, box?: BoxOptions } = {}
): Promise<string> {
  const content = buildTokenMonitorBox(stats, options.box)
  const box = new GistBox({ id: credentials.id, token: credentials.token })
  // waka-box puts the title in the file name, which renders as the card header
  await box.update({ content, filename: options.filename || GIST_TITLE })
  return content
}

/**
 * Fetch the stats and push the rendered box into the Gist.
 */
export async function updateGistFromStats (options: {
  id: string,
  token: string,
  url?: string,
  filename?: string,
  box?: BoxOptions
}): Promise<string> {
  const stats = await fetchStats(options.url)
  return pushToGist(stats, { id: options.id, token: options.token }, options)
}

async function main (): Promise<void> {
  const stats = await fetchStats(process.env.STATS_URL || DEFAULT_STATS_URL)
  const content = buildTokenMonitorBox(stats)
  const problems = checkLimits(content)
  const credentials = gistCredentials()

  if (credentials) {
    await pushToGist(stats, credentials, { filename: process.env.GIST_FILENAME })
    process.stdout.write('Gist updated.\n')
  } else if (process.env.REQUIRE_GIST === '1') {
    // A scheduled run that silently skips the update would look green forever
    throw new Error('GIST_ID and a token (GITHUB_TOKEN or GH_TOKEN) must both be set')
  }

  process.stdout.write(content + '\n')
  problems.forEach(problem => process.stderr.write(`warning: ${problem}\n`))
}

if (require.main === module) {
  main().catch(error => {
    process.stderr.write(String(error && error.message ? error.message : error) + '\n')
    process.exitCode = 1
  })
}
