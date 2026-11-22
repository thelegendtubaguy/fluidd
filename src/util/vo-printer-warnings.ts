import { voIssueUrlValid } from './vo-status'

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' &&
  value != null &&
  !Array.isArray(value)
)

const isVoPrinterWarning = (value: unknown): value is Klipper.VoPrinterWarning => (
  isRecord(value) &&
  typeof value.id === 'string' &&
  value.id !== '' &&
  (value.level === 'warning' || value.level === 'error') &&
  typeof value.title === 'string' &&
  value.title !== '' &&
  typeof value.message === 'string'
)

/**
 * Warnings reported by Valve Oil's vo_printer_warnings. The
 * object is absent on printers without the package, so anything that is not
 * the expected shape yields no warnings, and malformed entries, or repeats of
 * an id, are skipped rather than hiding the rest. A board warning's issue link
 * is kept only when it is Valve Oil's issue form, as in the Valve Oil section.
 */
const voPrinterWarnings = (state: unknown): Klipper.VoPrinterWarning[] => {
  if (!isRecord(state) || !Array.isArray(state.warnings)) {
    return []
  }

  const ids = new Set<string>()

  return state.warnings
    .filter(isVoPrinterWarning)
    .filter(warning => {
      if (ids.has(warning.id)) {
        return false
      }

      ids.add(warning.id)

      return true
    })
    .map(({ id, level, title, message, url }) => ({
      id,
      level,
      title,
      message,
      // A board's prefilled support issue, only when it is this project's issue form.
      ...(voIssueUrlValid(url) ? { url } : {})
    }))
}

export default voPrinterWarnings
