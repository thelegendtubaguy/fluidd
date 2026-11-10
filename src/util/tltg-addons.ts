// Client for Valve Oil's add-ons service (tltg-addons), which the nginx serving Fluidd on the printer
// exposes at /tltg-addons/api. nginx authorizes each request through Moonraker, so requests carry
// Fluidd's Moonraker access token when there is one.

export type TltgAddonState = 'not_installed' | 'installed' | 'update_available' | 'foreign'

export type TltgAddonAction = 'install' | 'update' | 'remove'

export type TltgAddonJobState = 'running' | 'succeeded' | 'failed'

export interface TltgAddonService {
  name: string;
  active: string;
}

export interface TltgAddon {
  id: string;
  name: string;
  description: string;
  homepage: string;
  available_version: string | null;
  installed_version: string | null;
  state: TltgAddonState;
  service: TltgAddonService | null;
  status: Record<string, unknown> | null;
}

export interface TltgAddonJob {
  id: string;
  addon: string;
  action: TltgAddonAction;
  state: TltgAddonJobState;
  message: string;
  log: string[];
}

export interface TltgAddonsList {
  busy: boolean;
  printer_busy: boolean;
  addons: TltgAddon[];
  job: TltgAddonJob | null;
}

export interface TltgAddonLinkCode {
  code: string;
  url: string;
  expires_in: number;
}

export const TLTG_ADDONS_POLL_BUSY_MS = 2000
export const TLTG_ADDONS_POLL_IDLE_MS = 10000

const ADDON_STATES: readonly string[] = ['not_installed', 'installed', 'update_available', 'foreign']
const ADDON_ACTIONS: readonly string[] = ['install', 'update', 'remove']
const JOB_STATES: readonly string[] = ['running', 'succeeded', 'failed']

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value)
)

const text = (value: unknown): string => typeof value === 'string' ? value : ''

const optionalText = (value: unknown): string | null => typeof value === 'string' && value !== '' ? value : null

/**
 * The add-ons API base, on the nginx that served this Fluidd. Only used while Fluidd talks to that same
 * printer's Moonraker, so the access token and the add-ons shown both belong to the printer in use.
 */
export const tltgAddonsApiBase = (apiUrl: string, location: Pick<Location, 'origin' | 'hostname'>): string | null => {
  if (!apiUrl) {
    return null
  }

  try {
    if (new URL(apiUrl).hostname !== location.hostname) {
      return null
    }
  } catch {
    return null
  }

  return `${location.origin}/tltg-addons/api`
}

const parseService = (value: unknown): TltgAddonService | null => {
  if (!isRecord(value)) {
    return null
  }

  return {
    name: text(value.name),
    active: text(value.active) || 'unknown'
  }
}

const parseAddon = (value: unknown): TltgAddon | null => {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    value.id === '' ||
    typeof value.state !== 'string' ||
    !ADDON_STATES.includes(value.state)
  ) {
    return null
  }

  return {
    id: value.id,
    name: text(value.name) || value.id,
    description: text(value.description),
    homepage: /^https?:\/\//.test(text(value.homepage)) ? text(value.homepage) : '',
    available_version: optionalText(value.available_version),
    installed_version: optionalText(value.installed_version),
    state: value.state as TltgAddonState,
    service: parseService(value.service),
    status: isRecord(value.status) ? value.status : null
  }
}

const parseJob = (value: unknown): TltgAddonJob | null => {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.addon !== 'string' ||
    typeof value.action !== 'string' ||
    !ADDON_ACTIONS.includes(value.action) ||
    typeof value.state !== 'string' ||
    !JOB_STATES.includes(value.state)
  ) {
    return null
  }

  return {
    id: value.id,
    addon: value.addon,
    action: value.action as TltgAddonAction,
    state: value.state as TltgAddonJobState,
    message: text(value.message),
    log: Array.isArray(value.log)
      ? value.log.filter((line): line is string => typeof line === 'string')
      : []
  }
}

/**
 * Reads the add-ons list, or null when the response isn't one, as from a printer without the service.
 * Malformed add-ons are skipped and the rest kept.
 */
export const parseTltgAddonsList = (value: unknown): TltgAddonsList | null => {
  if (!isRecord(value) || !Array.isArray(value.addons)) {
    return null
  }

  const seen = new Set<string>()
  const addons = value.addons
    .map(parseAddon)
    .filter((addon): addon is TltgAddon => {
      if (addon == null || seen.has(addon.id)) {
        return false
      }

      seen.add(addon.id)

      return true
    })
  const job = parseJob(value.job)

  return {
    busy: value.busy === true || job?.state === 'running',
    printer_busy: value.printer_busy === true,
    addons,
    job
  }
}

/** Reads the job an install, update, or remove request started. */
export const parseTltgAddonsJob = (value: unknown): TltgAddonJob | null => (
  isRecord(value)
    ? parseJob(value.job)
    : null
)

export const parseTltgAddonLinkCode = (value: unknown): TltgAddonLinkCode | null => {
  if (
    !isRecord(value) ||
    typeof value.code !== 'string' ||
    value.code === ''
  ) {
    return null
  }

  return {
    code: value.code,
    url: /^https?:\/\//.test(text(value.url)) ? text(value.url) : '',
    expires_in: typeof value.expires_in === 'number' && value.expires_in > 0 ? value.expires_in : 0
  }
}

/**
 * What an add-on offers in its state: the main action, and whether it can be removed alongside it.
 * Add-ons installed outside Valve Oil offer nothing.
 */
export const tltgAddonActions = (addon: Pick<TltgAddon, 'state'>): { primary: TltgAddonAction | null, remove: boolean } => {
  switch (addon.state) {
    case 'not_installed':
      return { primary: 'install', remove: false }
    case 'update_available':
      return { primary: 'update', remove: true }
    case 'installed':
      return { primary: 'remove', remove: false }
    default:
      return { primary: null, remove: false }
  }
}

export const tltgAddonsPollInterval = (list: TltgAddonsList | null): number => (
  list?.busy
    ? TLTG_ADDONS_POLL_BUSY_MS
    : TLTG_ADDONS_POLL_IDLE_MS
)

export class TltgAddonsRequestError extends Error {
  readonly status: number

  constructor (status: number, message: string) {
    super(message)
    this.name = 'TltgAddonsRequestError'
    this.status = status
  }
}

export interface TltgAddonsRequestOptions {
  method?: 'GET' | 'POST';
  token?: string | null;
  signal?: AbortSignal;
}

/**
 * Calls the add-ons API and returns its JSON body. Throws TltgAddonsRequestError with the server's
 * error text on an error status, and with status 0 when the printer can't be reached or doesn't answer
 * with JSON. POSTs carry the header and body the service requires of them.
 */
export const tltgAddonsRequest = async (base: string, path: string, options: TltgAddonsRequestOptions = {}): Promise<unknown> => {
  const method = options.method ?? 'GET'
  const headers: Record<string, string> = {
    Accept: 'application/json'
  }

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`
  }

  if (method === 'POST') {
    headers['X-Valve-Oil'] = 'addons'
    headers['Content-Type'] = 'application/json'
  }

  let response: Response

  try {
    response = await fetch(`${base}${path}`, {
      method,
      headers,
      body: method === 'POST' ? '{}' : undefined,
      cache: 'no-store',
      credentials: 'same-origin',
      signal: options.signal
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw e
    }

    throw new TltgAddonsRequestError(0, e instanceof Error ? e.message : String(e))
  }

  let body: unknown = null

  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (!response.ok) {
    const error = isRecord(body) ? text(body.error) : ''

    throw new TltgAddonsRequestError(response.status, error || `${response.status} ${response.statusText}`.trim())
  }

  if (body === null) {
    throw new TltgAddonsRequestError(0, 'Invalid response')
  }

  return body
}
