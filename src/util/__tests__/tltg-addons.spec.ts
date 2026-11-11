import {
  parseTltgAddonsList,
  tltgAddonActions,
  tltgAddonsApiBase,
  tltgAddonsPollInterval,
  tltgAddonsRequest,
  TltgAddonsRequestError,
  tltgServerUrlValid
} from '../tltg-addons'

const octoEverywhere = {
  id: 'octoeverywhere',
  name: 'OctoEverywhere',
  description: 'Remote access.',
  homepage: 'https://octoeverywhere.com',
  available_version: '5.4.1',
  installed_version: null,
  state: 'not_installed',
  service: null,
  status: null
}

const runningJob = {
  id: 'job-1',
  addon: 'octoeverywhere',
  action: 'install',
  state: 'running',
  started: 1794337691.2,
  finished: null,
  message: 'Downloading',
  log: ['Starting', 'Downloading']
}

describe('tltgAddonsApiBase', () => {
  const location = { origin: 'http://192.168.1.166', hostname: '192.168.1.166' }

  it.each([
    ['the page', 'http://192.168.1.166'],
    ["Moonraker's own port", 'http://192.168.1.166:7125']
  ])('uses the nginx that served Fluidd when Fluidd talks to %s', (_, apiUrl) => {
    expect(tltgAddonsApiBase(apiUrl, location)).toBe('http://192.168.1.166/tltg-addons/api')
  })

  it.each([
    ['another printer', 'http://192.168.1.200'],
    ['no printer', ''],
    ['an invalid address', 'not a url']
  ])('is unavailable when Fluidd talks to %s', (_, apiUrl) => {
    expect(tltgAddonsApiBase(apiUrl, location)).toBeNull()
  })
})

describe('parseTltgAddonsList', () => {
  it.each([
    ['an HTML page', '<!doctype html>'],
    ['null', null],
    ['an object without add-ons', { error: 'Not found' }]
  ])('is unavailable for %s', (_, body) => {
    expect(parseTltgAddonsList(body)).toBeNull()
  })

  it('keeps well-formed add-ons and skips malformed or repeated ones', () => {
    const list = parseTltgAddonsList({
      busy: false,
      printer_busy: true,
      addons: [
        octoEverywhere,
        { ...octoEverywhere, name: 'Again' },
        { ...octoEverywhere, id: 'future', state: 'something_new' },
        { ...octoEverywhere, id: '' },
        'octoeverywhere'
      ],
      job: null
    })

    expect(list).toEqual({
      busy: false,
      printer_busy: true,
      addons: [{ ...octoEverywhere, status: null, blocked_by: [] }],
      job: null
    })
  })

  it('names the installed add-ons that block an install', () => {
    const list = parseTltgAddonsList({
      addons: [{ ...octoEverywhere, id: 'obico', name: 'Obico', blocked_by: ['OctoEverywhere', 3, ''] }],
      job: { ...runningJob, addon: 'obico', action: 'relink' }
    })

    expect(list?.addons[0].blocked_by).toEqual(['OctoEverywhere'])
    expect(list?.job?.action).toBe('relink')
  })

  it('treats a running job as busy and polls faster while it runs', () => {
    const running = parseTltgAddonsList({ busy: false, printer_busy: false, addons: [], job: runningJob })
    const finished = parseTltgAddonsList({ busy: false, printer_busy: false, addons: [], job: { ...runningJob, state: 'failed' } })

    expect(running?.busy).toBe(true)
    expect(running?.job?.log).toEqual(['Starting', 'Downloading'])
    expect(tltgAddonsPollInterval(running)).toBe(2000)

    expect(finished?.busy).toBe(false)
    expect(finished?.job?.state).toBe('failed')
    expect(tltgAddonsPollInterval(finished)).toBe(10000)
    expect(tltgAddonsPollInterval(null)).toBe(10000)
  })
})

describe('tltgAddonActions', () => {
  it.each([
    ['not_installed', { primary: 'install', remove: false }],
    ['update_available', { primary: 'update', remove: true }],
    ['installed', { primary: 'remove', remove: false }],
    ['foreign', { primary: null, remove: false }]
  ] as const)('offers the right actions when %s', (state, expected) => {
    expect(tltgAddonActions({ state })).toEqual(expected)
  })
})

describe('tltgAddonsRequest', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
  })

  const respond = (status: number, body: string) => {
    fetchMock.mockResolvedValueOnce(new Response(body, { status }))
  }

  it('sends the headers and body the service requires of a POST', async () => {
    respond(202, JSON.stringify({ job: runningJob }))

    await tltgAddonsRequest('http://printer/tltg-addons/api', '/addons/octoeverywhere/install', { method: 'POST', token: 'abc' })

    const [url, init] = fetchMock.mock.calls[0]

    expect(url).toBe('http://printer/tltg-addons/api/addons/octoeverywhere/install')
    expect(init).toMatchObject({
      method: 'POST',
      body: '{}',
      headers: {
        Authorization: 'Bearer abc',
        'X-Valve-Oil': 'addons',
        'Content-Type': 'application/json'
      }
    })
  })

  it("sends a relink's server in the body", async () => {
    respond(202, JSON.stringify({ job: { ...runningJob, action: 'relink' } }))

    await tltgAddonsRequest('http://printer/tltg-addons/api', '/addons/obico/relink', { method: 'POST', body: { server: 'http://192.168.1.10:3334' } })

    expect(fetchMock.mock.calls[0][1].body).toBe('{"server":"http://192.168.1.10:3334"}')
  })

  it('sends no token when Fluidd has none', async () => {
    respond(200, JSON.stringify({ addons: [] }))

    await tltgAddonsRequest('http://printer/tltg-addons/api', '/addons', { token: null })

    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('Authorization')
  })

  it("reports the server's error text with its status", async () => {
    respond(409, JSON.stringify({ error: 'The printer is printing' }))

    await expect(tltgAddonsRequest('http://printer/tltg-addons/api', '/addons/octoeverywhere/install', { method: 'POST' }))
      .rejects.toMatchObject({ status: 409, message: 'The printer is printing' })
  })

  it.each([
    ['answers with an HTML page', () => respond(200, '<!doctype html>')],
    ["can't be reached", () => fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))]
  ])('fails without a status when the printer %s', async (_, arrange) => {
    arrange()

    const request = tltgAddonsRequest('http://printer/tltg-addons/api', '/addons')

    await expect(request).rejects.toBeInstanceOf(TltgAddonsRequestError)
    await expect(request).rejects.toMatchObject({ status: 0 })
  })
})

describe('tltgServerUrlValid', () => {
  it.each([
    'https://app.obico.io',
    'http://192.168.1.10:3334',
    'http://obico.local/',
    'http://[fe80::1]:3334/obico'
  ])('accepts %s', (url) => {
    expect(tltgServerUrlValid(url)).toBe(true)
  })

  it.each([
    'obico.local',
    'ftp://obico.local',
    'http://obico.local/?next=x',
    'http://obico local',
    'javascript:alert(1)'
  ])('refuses %s', (url) => {
    expect(tltgServerUrlValid(url)).toBe(false)
  })
})
