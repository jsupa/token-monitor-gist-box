import nock from 'nock'
import { fetchStats, MAX_REDIRECTS, MAX_RESPONSE_BYTES, parseStats, safeForLog } from '../src/token-monitor'

const ORIGIN = 'https://stats.test'
const PATH = '/api/public/stats'

const good = {
  ok: true,
  historyPreview: {
    daily: [{ date: '2026-09-13', tokens: 415749863 }],
    monthly: [{ month: '2026-09', tokens: 2391694059 }]
  }
}

describe('fetchStats', () => {
  afterEach(() => nock.cleanAll())

  it('returns the parsed document', async () => {
    nock(ORIGIN).get(PATH).reply(200, good)
    const stats = await fetchStats(`${ORIGIN}${PATH}`)
    expect(stats.historyPreview!.monthly).toHaveLength(1)
  })

  it('reports a non-2xx status', async () => {
    nock(ORIGIN).get(PATH).reply(503)
    await expect(fetchStats(`${ORIGIN}${PATH}`)).rejects.toThrow('failed with status 503')
  })

  it('rejects a body that is not JSON', async () => {
    nock(ORIGIN).get(PATH).reply(200, '<html>nope</html>')
    await expect(fetchStats(`${ORIGIN}${PATH}`)).rejects.toThrow('Could not parse response')
  })

  it('stops after MAX_REDIRECTS hops instead of looping forever', async () => {
    // A server that redirects to itself would previously recurse without end
    nock(ORIGIN).get(PATH).times(MAX_REDIRECTS + 1).reply(302, '', { location: `${ORIGIN}${PATH}` })
    await expect(fetchStats(`${ORIGIN}${PATH}`)).rejects.toThrow('Too many redirects')
  })

  it('follows a redirect within the limit', async () => {
    nock(ORIGIN).get('/moved').reply(302, '', { location: `${ORIGIN}${PATH}` })
    nock(ORIGIN).get(PATH).reply(200, good)
    const stats = await fetchStats(`${ORIGIN}/moved`)
    expect(stats.ok).toBe(true)
  })

  it('refuses to follow a redirect off https', async () => {
    nock(ORIGIN).get(PATH).reply(302, '', { location: 'http://169.254.169.254/latest/meta-data/' })
    await expect(fetchStats(`${ORIGIN}${PATH}`)).rejects.toThrow('non-https redirect')
  })

  it('refuses to follow a redirect to another host', async () => {
    // https alone is not enough: this would reach an internal service
    nock(ORIGIN).get(PATH).reply(302, '', { location: 'https://internal.corp.example/admin' })
    await expect(fetchStats(`${ORIGIN}${PATH}`)).rejects.toThrow('Refusing to follow stats.test to internal.corp.example')
  })

  it('rejects a configured url that is not a url', async () => {
    await expect(fetchStats('not a url')).rejects.toThrow('Not a valid URL')
  })

  it('caps the response body', async () => {
    // The real document is ~48KB, so anything this size is a runaway
    nock(ORIGIN).get(PATH).reply(200, Buffer.alloc(MAX_RESPONSE_BYTES + 4096, 'x'))
    await expect(fetchStats(`${ORIGIN}${PATH}`)).rejects.toThrow('exceeded')
  })
})

describe('parseStats', () => {
  it('accepts the documented shape', () => {
    expect(parseStats(good, 'x').ok).toBe(true)
  })

  it('accepts a document with no history yet', () => {
    expect(parseStats({ ok: true }, 'x').ok).toBe(true)
  })

  it('rejects a non-object payload', () => {
    expect(() => parseStats('nope', 'x')).toThrow('did not return a JSON object')
    expect(() => parseStats(null, 'x')).toThrow('did not return a JSON object')
    expect(() => parseStats([], 'x')).toThrow('did not return a JSON object')
  })

  it('rejects a non-object historyPreview', () => {
    expect(() => parseStats({ historyPreview: 'nope' }, 'x')).toThrow('non-object historyPreview')
  })

  it('rejects a month whose name is not a string', () => {
    // monthLabel calls .slice() on this, which used to throw a raw TypeError
    expect(() => parseStats({ historyPreview: { monthly: [{ month: 202609, tokens: 1 }] } }, 'x'))
      .toThrow('malformed historyPreview.monthly')
  })

  it('rejects a non-numeric token count', () => {
    expect(() => parseStats({ historyPreview: { monthly: [{ month: '2026-09', tokens: 'lots' }] } }, 'x'))
      .toThrow('malformed historyPreview.monthly')
  })

  it('rejects a malformed daily entry', () => {
    expect(() => parseStats({ historyPreview: { daily: [{ tokens: 1 }] } }, 'x'))
      .toThrow('malformed historyPreview.daily')
  })
})

describe('safeForLog', () => {
  it('strips newlines and ANSI escapes from server-controlled values', () => {
    expect(safeForLog('https://x.test/\n[31mfake')).toEqual('https://x.test/[31mfake')
    expect(safeForLog('a[2Kb')).toEqual('a[2Kb')
  })

  it('keeps ordinary urls intact', () => {
    expect(safeForLog('https://stats.test/api/public/stats')).toEqual('https://stats.test/api/public/stats')
  })
})
