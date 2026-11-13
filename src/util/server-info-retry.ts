import { Globals } from '@/globals'

/**
 * How long to wait before reading Moonraker's server info again, or
 * undefined when it needn't be read until something else asks for it.
 *
 * Moonraker sends no notification when a component clears its warning or
 * failed state, for example once QIDI's MQTT connects, so it is read again
 * while any are shown.
 */
export const serverInfoRetryDelay = (info: Moonraker.Server.InfoResponse): number | undefined => {
  if (info.klippy_state !== 'ready') {
    return Globals.KLIPPY_RETRY_DELAY
  }

  if (
    (info.warnings?.length ?? 0) > 0 ||
    (info.failed_components?.length ?? 0) > 0
  ) {
    return Globals.MOONRAKER_WARNINGS_RECHECK_DELAY
  }
}
