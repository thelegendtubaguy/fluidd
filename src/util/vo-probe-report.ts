const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' &&
  value != null &&
  !Array.isArray(value)
)

const isFiniteNumber = (value: unknown): value is number => (
  typeof value === 'number' &&
  Number.isFinite(value)
)

const isProbeReportPoint = (value: unknown): value is Klipper.VoProbeReportPoint => (
  isRecord(value) &&
  isFiniteNumber(value.x) &&
  isFiniteNumber(value.y) &&
  isFiniteNumber(value.tries) &&
  isFiniteNumber(value.spread)
)

/**
 * Probe points that needed a retry in the loaded bed mesh, from Valve Oil's
 * vo_probe_report. Empty when the object is absent, or when the loaded mesh isn't the one the report describes.
 */
const voProbeReportPoints = (state: unknown): Klipper.VoProbeReportPoint[] => {
  if (!isRecord(state) || state.loaded !== true || !Array.isArray(state.points)) {
    return []
  }

  return state.points
    .filter(isProbeReportPoint)
    .map(({ x, y, tries, spread }) => ({ x, y, tries, spread }))
}

export default voProbeReportPoints
