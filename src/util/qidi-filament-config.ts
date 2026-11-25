// QIDI firmware 01.01.07.01's filament database, filament-0.4.json: a JSON object keyed by display name
// ("<vendor> <filament>"), in list order. Klipper and the touchscreen read it when they start. The installer links
// QIDI's filament_config folder into the config root as qidi_filament_config.

export const QIDI_FILAMENT_CONFIG_PATH = 'qidi_filament_config'
export const QIDI_FILAMENT_CONFIG_FILENAME = 'filament-0.4.json'
export const QIDI_FILAMENT_CONFIG_FILE = `${QIDI_FILAMENT_CONFIG_PATH}/${QIDI_FILAMENT_CONFIG_FILENAME}`

export type QidiFilamentConfigEntry = Record<string, unknown>

export type QidiFilamentConfig = Record<string, QidiFilamentConfigEntry>

// The fields the page edits. Anything else in an entry, such as QIDI's drying presets, is kept as it is.
export interface QidiFilamentDraft {
  vendor: string;
  name: string;
  id: string;
  type: string;
  nozzleMin: number | null;
  nozzleMax: number | null;
  boxMax: number | null;
  chamber: number | null;
  support: boolean;
}

export interface QidiFilamentRow extends QidiFilamentDraft {
  key: string;
}

export type QidiFilamentImportStatus = 'new' | 'changed' | 'conflict' | 'temperature'

export interface QidiFilamentImportItem {
  key: string;
  id: string;
  status: QidiFilamentImportStatus;
  // For a conflict, the current filament that already uses the ID.
  conflictKey?: string;
  // For temperature, what is wrong with the filament's nozzle temperatures.
  problem?: QidiNozzleProblem;
}

// What is wrong with a nozzle temperature: missing, not a whole number, below 0, a maximum below the minimum, or a
// maximum above the printer's extruder max_temp.
export type QidiNozzleProblem = 'required' | 'whole' | 'negative' | 'below_min' | 'above_limit'

export interface QidiNozzleProblems {
  nozzleMin: QidiNozzleProblem | null;
  nozzleMax: QidiNozzleProblem | null;
}

// QIDI's IDs are QF, a family letter, and two digits; box2base rejects any other shape.
export const QIDI_FILAMENT_ID_PATTERN = /^QF[A-Z]\d{2}$/

// QIDI's Box flows, and from Max 4 01.01.07.02 and Plus 5 01.01.02.02 its compiled flush at print start, heat the
// nozzle to int(nozzle_temperature[1]) of the filament with no upper limit. A maximum above the extruder's max_temp
// fails those heats at M109, and one int() can't read stops Klipper. maxTemp is the printer's [extruder] max_temp;
// without it, as while Klipper is down, the maximum isn't limited.
const nozzleProblem = (value: number | null): QidiNozzleProblem | null => {
  if (value == null) return 'required'
  if (!Number.isInteger(value)) return 'whole'

  return value < 0 ? 'negative' : null
}

export const qidiNozzleProblems = (
  draft: Pick<QidiFilamentDraft, 'nozzleMin' | 'nozzleMax'>,
  maxTemp?: number | null
): QidiNozzleProblems => {
  const nozzleMin = nozzleProblem(draft.nozzleMin)
  let nozzleMax = nozzleProblem(draft.nozzleMax)
  const max = draft.nozzleMax ?? 0

  if (nozzleMax == null && nozzleMin == null && max < (draft.nozzleMin ?? 0)) nozzleMax = 'below_min'
  if (nozzleMax == null && maxTemp != null && max > maxTemp) nozzleMax = 'above_limit'

  return { nozzleMin, nozzleMax }
}

// The whole number Python's int() reads from a value in the file, or null.
const wholeNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isInteger(value) ? value : null

  return typeof value === 'string' && /^\s*[+-]?\d+\s*$/.test(value) ? Number(value) : null
}

// The first problem with a saved entry's nozzle_temperature, or null.
const entryNozzleProblem = (entry: QidiFilamentConfigEntry, maxTemp?: number | null): QidiNozzleProblem | null => {
  const nozzle = Array.isArray(entry.nozzle_temperature) ? entry.nozzle_temperature : []
  const problems = qidiNozzleProblems({ nozzleMin: wholeNumber(nozzle[0]), nozzleMax: wholeNumber(nozzle[1]) }, maxTemp)

  return problems.nozzleMin ?? problems.nozzleMax
}

const isEntry = (value: unknown): value is QidiFilamentConfigEntry => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)

// Null unless the text is a filament database: an object of entries that each carry a filament_id.
export const parseQidiFilamentConfig = (text: string): QidiFilamentConfig | null => {
  let data: unknown

  try {
    data = JSON.parse(text)
  } catch {
    return null
  }

  if (!isEntry(data)) return null

  const entries = Object.values(data)

  return entries.length > 0 && entries.every(entry => isEntry(entry) && typeof entry.filament_id === 'string')
    ? data as QidiFilamentConfig
    : null
}

export const serializeQidiFilamentConfig = (config: QidiFilamentConfig): string => `${JSON.stringify(config, null, 2)}\n`

const readNumber = (value: unknown): number | null => {
  const raw = Array.isArray(value) ? value[0] : value
  const number = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw

  return typeof number === 'number' && Number.isFinite(number) ? number : null
}

// Writes a number in the shape QIDI used for the field: a number, a numeric string, or a list holding either.
const writeNumber = (previous: unknown, value: number): unknown => {
  if (Array.isArray(previous)) {
    return previous.length ? [writeNumber(previous[0], value), ...previous.slice(1)] : [String(value)]
  }

  return typeof previous === 'number' ? value : String(value)
}

// The display name without its vendor prefix; QIDI resolves a vendor and filament pair by that name.
const filamentName = (key: string, vendor: string) => vendor && key.startsWith(`${vendor} `)
  ? key.slice(vendor.length + 1)
  : key

export const qidiFilamentKey = (draft: Pick<QidiFilamentDraft, 'vendor' | 'name'>) => `${draft.vendor.trim()} ${draft.name.trim()}`

export const qidiFilamentDraft = (key: string, entry: QidiFilamentConfigEntry): QidiFilamentDraft => {
  const vendor = String(entry.filament_vendor ?? '')
  const nozzle = Array.isArray(entry.nozzle_temperature) ? entry.nozzle_temperature : []

  return {
    vendor,
    name: filamentName(key, vendor),
    id: String(entry.filament_id ?? ''),
    type: String(entry.type ?? ''),
    nozzleMin: readNumber(nozzle[0]),
    nozzleMax: readNumber(nozzle[1]),
    boxMax: readNumber(entry.box_temperature_range_high),
    chamber: readNumber(entry.chamber_temperatures),
    support: readNumber(entry.filament_is_support) === 1
  }
}

export const qidiFilamentRows = (config: QidiFilamentConfig): QidiFilamentRow[] => Object.entries(config)
  .map(([key, entry]) => ({ key, ...qidiFilamentDraft(key, entry) }))

// nozzle_temperature is always written as QIDI ships it: [min, max], two whole numbers.
const applyDraft = (entry: QidiFilamentConfigEntry, draft: QidiFilamentDraft): QidiFilamentConfigEntry => {
  const result: QidiFilamentConfigEntry = {
    ...entry,
    type: draft.type.trim(),
    filament_id: draft.id,
    nozzle_temperature: [draft.nozzleMin ?? 0, draft.nozzleMax ?? 0],
    box_temperature_range_high: writeNumber(entry.box_temperature_range_high ?? ['0'], draft.boxMax ?? 0),
    filament_vendor: draft.vendor.trim(),
    filament_is_support: writeNumber(entry.filament_is_support ?? '0', draft.support ? 1 : 0),
    chamber_temperatures: writeNumber(entry.chamber_temperatures ?? '0', draft.chamber ?? 0)
  }

  if (!('box_temperature_range_low' in result)) result.box_temperature_range_low = ['0']

  return result
}

// The entry a new filament copies its other settings from: Generic's filament of the same type, else another
// filament of that type, else the first in the list.
export const qidiFilamentBaseKey = (config: QidiFilamentConfig, type: string): string | undefined => {
  const entries = Object.entries(config)
  const sameType = entries.filter(([, entry]) => String(entry.type ?? '').toLowerCase() === type.trim().toLowerCase())

  return (
    sameType.find(([, entry]) => entry.filament_vendor === 'Generic') ??
    sameType[0] ??
    entries[0]
  )?.[0]
}

// Saves a filament, replacing previousKey in place or, for a new filament, adding one based on baseKey. Refuses
// nozzle temperatures qidiNozzleProblems finds a problem with, given the printer's maxTemp.
export const setQidiFilament = (
  config: QidiFilamentConfig,
  draft: QidiFilamentDraft,
  options: { previousKey?: string, baseKey?: string, maxTemp?: number | null }
): QidiFilamentConfig => {
  const key = qidiFilamentKey(draft)
  const { previousKey, baseKey, maxTemp } = options
  const nozzle = qidiNozzleProblems(draft, maxTemp)

  if (nozzle.nozzleMax === 'above_limit') throw new Error(`Nozzle maximum of ${key} is above the printer's limit of ${maxTemp} °C`)
  if (nozzle.nozzleMin != null || nozzle.nozzleMax != null) throw new Error(`Nozzle temperatures of ${key} must be whole numbers from 0, the minimum no higher than the maximum`)

  if (key !== previousKey && key in config) throw new Error(`Filament already listed: ${key}`)

  const idOwner = qidiFilamentIdOwner(config, draft.id, previousKey)

  if (idOwner != null) throw new Error(`Filament ID ${draft.id} already used by ${idOwner}`)

  if (previousKey != null) {
    const previous = config[previousKey]

    if (previous == null) throw new Error(`Filament not found: ${previousKey}`)

    return Object.fromEntries(Object.entries(config)
      .map(([entryKey, entry]) => entryKey === previousKey
        ? [key, applyDraft(previous, draft)]
        : [entryKey, entry]
      )
    )
  }

  const base = baseKey != null ? config[baseKey] : undefined

  return { ...config, [key]: applyDraft(structuredClone(base ?? {}), draft) }
}

export const removeQidiFilament = (config: QidiFilamentConfig, key: string): QidiFilamentConfig => {
  const { [key]: removed, ...rest } = config

  if (removed == null) throw new Error(`Filament not found: ${key}`)

  return rest
}

export const qidiFilamentIdOwner = (config: QidiFilamentConfig, id: string, exceptKey?: string): string | undefined => (
  Object.entries(config).find(([key, entry]) => key !== exceptKey && entry.filament_id === id)?.[0]
)

// The first unused ID in the family of fromId, counting up from fromId.
export const nextQidiFilamentId = (config: QidiFilamentConfig, fromId: string): string | undefined => {
  const match = /^QF([A-Z])(\d{2})$/.exec(fromId)

  if (!match) return undefined

  const used = new Set(Object.values(config).map(entry => entry.filament_id))
  const start = parseInt(match[2], 10)

  for (let offset = 1; offset < 100; offset++) {
    const id = `QF${match[1]}${String((start + offset) % 100).padStart(2, '0')}`

    if (!used.has(id)) return id
  }

  return undefined
}

const sameEntry = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

// The imported filaments that differ from the current list. A new filament whose ID another current filament
// uses is a conflict, as is a changed one whose ID moved onto another filament. One whose nozzle temperatures
// qidiNozzleProblems finds a problem with, given the printer's maxTemp, is refused too.
export const diffQidiFilamentImport = (current: QidiFilamentConfig, imported: QidiFilamentConfig, maxTemp?: number | null): QidiFilamentImportItem[] => (
  Object.entries(imported)
    .filter(([key, entry]) => !sameEntry(current[key], entry))
    .map(([key, entry]): QidiFilamentImportItem => {
      const id = String(entry.filament_id)
      const conflictKey = qidiFilamentIdOwner(current, id, key)
      const problem = entryNozzleProblem(entry, maxTemp)

      if (conflictKey != null) return { key, id, status: 'conflict', conflictKey }
      if (problem != null) return { key, id, status: 'temperature', problem }

      return { key, id, status: key in current ? 'changed' : 'new' }
    })
)

// Adds or replaces the chosen imported filaments; replaced ones keep their place in the list.
export const applyQidiFilamentImport = (
  current: QidiFilamentConfig,
  imported: QidiFilamentConfig,
  keys: string[],
  maxTemp?: number | null
): QidiFilamentConfig => {
  const applied = diffQidiFilamentImport(current, imported, maxTemp)
    .filter(item => (item.status === 'new' || item.status === 'changed') && keys.includes(item.key))
  const result = { ...current }

  for (const { key } of applied) {
    result[key] = imported[key]
  }

  return result
}
