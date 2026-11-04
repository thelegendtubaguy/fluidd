const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' &&
  value != null &&
  !Array.isArray(value)
)

const isTltgPrinterWarning = (value: unknown): value is Klipper.TltgPrinterWarning => (
  isRecord(value) &&
  typeof value.id === 'string' &&
  value.id !== '' &&
  (value.level === 'warning' || value.level === 'error') &&
  typeof value.title === 'string' &&
  value.title !== '' &&
  typeof value.message === 'string'
)

/**
 * Warnings reported by QIDI Max 4 Optimized's tltg_printer_warnings. The
 * object is absent on printers without the package, so anything that is not
 * the expected shape yields no warnings, and malformed entries, or repeats of
 * an id, are skipped rather than hiding the rest.
 */
const tltgPrinterWarnings = (state: unknown): Klipper.TltgPrinterWarning[] => {
  if (!isRecord(state) || !Array.isArray(state.warnings)) {
    return []
  }

  const ids = new Set<string>()

  return state.warnings
    .filter(isTltgPrinterWarning)
    .filter(warning => {
      if (ids.has(warning.id)) {
        return false
      }

      ids.add(warning.id)

      return true
    })
    .map(({ id, level, title, message }) => ({ id, level, title, message }))
}

export default tltgPrinterWarnings
