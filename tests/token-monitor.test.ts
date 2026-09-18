import {
  BAR_SIZE,
  buildMonthRows,
  buildRow,
  buildTokenMonitorBox,
  checkLimits,
  dayLabel,
  formatTokens,
  generateBarChart,
  gistCredentials,
  monthLabel,
  peakDay,
  recentMonths,
  TokenStats,
  trimRightStr
} from '../src/token-monitor'

const stats: TokenStats = {
  historyPreview: {
    daily: [
      { date: '2026-09-13', tokens: 415749863 },
      { date: '2026-09-14', tokens: 12000000 },
      { date: '2026-09-18', tokens: 14021128 }
    ],
    monthly: [
      { month: '2026-03', tokens: 71768269 },
      { month: '2026-04', tokens: 5269228 },
      { month: '2026-06', tokens: 162472164 },
      { month: '2026-07', tokens: 2017291294 },
      { month: '2026-08', tokens: 2200160756 },
      { month: '2026-09', tokens: 2391694059 }
    ]
  }
}

describe('token-monitor', () => {
  describe('#gistCredentials', () => {
    it('reads GIST_ID with GITHUB_TOKEN', () => {
      expect(gistCredentials({ GIST_ID: 'abc', GITHUB_TOKEN: 'xyz' })).toEqual({ id: 'abc', token: 'xyz' })
    })

    it('accepts waka-box\'s GH_TOKEN name', () => {
      expect(gistCredentials({ GIST_ID: 'abc', GH_TOKEN: 'xyz' })).toEqual({ id: 'abc', token: 'xyz' })
    })

    it('prefers GITHUB_TOKEN when both are set', () => {
      expect(gistCredentials({ GIST_ID: 'abc', GITHUB_TOKEN: 'one', GH_TOKEN: 'two' }))
        .toEqual({ id: 'abc', token: 'one' })
    })

    it('returns undefined when either half is missing', () => {
      expect(gistCredentials({})).toBeUndefined()
      expect(gistCredentials({ GIST_ID: 'abc' })).toBeUndefined()
      expect(gistCredentials({ GH_TOKEN: 'xyz' })).toBeUndefined()
      // Actions substitute an unset secret with an empty string, not undefined
      expect(gistCredentials({ GIST_ID: '', GH_TOKEN: '' })).toBeUndefined()
    })
  })

  describe('#formatTokens', () => {
    it('scales to B, M and K', () => {
      expect(formatTokens(2391694059)).toEqual('2.39B')
      expect(formatTokens(415749863)).toEqual('415.7M')
      expect(formatTokens(162472164)).toEqual('162.5M')
      expect(formatTokens(5269228)).toEqual('5.3M')
      expect(formatTokens(1400)).toEqual('1.4K')
      expect(formatTokens(842)).toEqual('842')
    })

    it('keeps one decimal place per unit so columns line up', () => {
      expect(formatTokens(2200160756)).toEqual('2.20B')
      expect(formatTokens(2017291294)).toEqual('2.02B')
    })

    it('handles empty and invalid values', () => {
      expect(formatTokens(0)).toEqual('0')
      expect(formatTokens(NaN)).toEqual('0')
      expect(formatTokens(-1)).toEqual('0')
    })
  })

  describe('#monthLabel and #dayLabel', () => {
    it('shortens an ISO month', () => {
      expect(monthLabel('2026-09')).toEqual('Sep')
      expect(monthLabel('2026-01')).toEqual('Jan')
    })

    it('shortens an ISO date', () => {
      expect(dayLabel('2026-09-13')).toEqual('Sep 13')
    })
  })

  describe('#generateBarChart', () => {
    it('matches waka-box: full track at 100%', () => {
      expect(generateBarChart(100, 21)).toEqual('█'.repeat(21))
    })

    it('overflows safely above 100%', () => {
      expect(generateBarChart(140, 21)).toEqual('█'.repeat(21))
    })

    it('pads the remainder with empty cells', () => {
      const bar = generateBarChart(50, 8)
      expect(bar).toHaveLength(8)
      expect(bar).toEqual('████░░░░')
    })

    it('renders a partial eighth block for the remainder', () => {
      // 21 * 8 * 0.843 = 141.6 -> 141 eighths -> 17 full blocks and 5 eighths
      const bar = generateBarChart(84.3, 21)
      expect(bar).toHaveLength(21)
      expect(bar.substring(0, 17)).toEqual('█'.repeat(17))
      expect(bar[17]).toEqual('▋')
    })

    it('is all empty at 0%', () => {
      expect(generateBarChart(0, 21)).toEqual('░'.repeat(21))
    })
  })

  describe('#trimRightStr', () => {
    it('leaves short strings alone', () => {
      expect(trimRightStr('Sep', 10)).toEqual('Sep')
    })

    it('counts the ellipsis against the budget', () => {
      expect(trimRightStr('averylongmonthname', 10)).toEqual('averylo...')
      expect(trimRightStr('averylongmonthname', 10)).toHaveLength(10)
    })
  })

  describe('#buildRow', () => {
    it('lays out label, value, bar and percentage like waka-box', () => {
      const row = buildRow('2026-09', '2.39B tokens', 100)
      expect(row).toEqual('2026-09    2.39B tokens   ' + '█'.repeat(BAR_SIZE) + ' 100.0%')
      expect(row).toHaveLength(54)
    })
  })

  describe('#buildMonthRows', () => {
    it('scales the largest month to 100% by default', () => {
      const rows = buildMonthRows(stats.historyPreview!.monthly!.slice(-3))
      expect(rows[2]).toContain('100.0%')
      expect(rows[1]).toContain('92.0%')
      expect(rows[0]).toContain('84.3%')
    })

    it('can make the months sum to 100% instead', () => {
      const rows = buildMonthRows(stats.historyPreview!.monthly!.slice(-3), 'total')
      // 2.39 / (2.02 + 2.20 + 2.39)
      expect(rows[2]).toContain('36.2%')
      expect(rows[0]).toContain('30.5%')
    })
  })

  describe('#peakDay', () => {
    it('finds the highest-usage day', () => {
      expect(peakDay(stats.historyPreview!.daily!)).toEqual({ date: '2026-09-13', tokens: 415749863 })
    })

    it('returns undefined with no history', () => {
      expect(peakDay([])).toBeUndefined()
    })
  })

  describe('#recentMonths', () => {
    it('keeps the latest months in chronological order', () => {
      const months = recentMonths(stats.historyPreview!.monthly!, 6)
      expect(months.map(m => m.month)).toEqual([
        '2026-03', '2026-04', '2026-06', '2026-07', '2026-08', '2026-09'
      ])
    })

    it('drops empty months and honours the limit', () => {
      const months = recentMonths([...stats.historyPreview!.monthly!, { month: '2026-10', tokens: 0 }], 2)
      expect(months.map(m => m.month)).toEqual(['2026-08', '2026-09'])
    })
  })

  describe('#buildTokenMonitorBox', () => {
    it('renders the monthly total, waka-box rows and peak day', () => {
      const box = buildTokenMonitorBox(stats)
      const lines = box.split('\n')
      expect(lines).toHaveLength(5)
      expect(lines[0]).toContain('Sep 2026 · 2.39B')
      expect(lines[1]).toContain('2026-07')
      expect(lines[3]).toContain('2026-09')
      expect(lines[3]).toContain('100.0%')
      expect(lines[4]).toEqual('🔥 Peak day · Sep 13 · 415.7M')
    })

    it('shows only the last three months', () => {
      expect(buildTokenMonitorBox(stats)).not.toContain('2026-06')
    })

    it('can render rows only, the way waka-box does', () => {
      const lines = buildTokenMonitorBox(stats, { headline: false }).split('\n')
      expect(lines).toHaveLength(3)
      expect(lines[0]).toContain('2026-07')
    })

    it('stays within the pinned Gist limits', () => {
      expect(checkLimits(buildTokenMonitorBox(stats))).toEqual([])
    })

    it('degrades gracefully with no history', () => {
      const box = buildTokenMonitorBox({})
      expect(box).toContain('No usage history')
      expect(checkLimits(box)).toEqual([])
    })
  })

  describe('#checkLimits', () => {
    it('reports lines that are too long or too many', () => {
      const problems = checkLimits(new Array(6).fill('x'.repeat(64)).join('\n'))
      // one line-count problem plus one over-long problem per line
      expect(problems).toHaveLength(7)
      expect(problems[0]).toContain('exceeds MAX_LINES')
      expect(problems[1]).toContain('exceeds MAX_LENGTH')
    })
  })
})
