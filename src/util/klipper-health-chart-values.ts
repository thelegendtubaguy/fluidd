import decimalRound from '@/util/decimal-round'

/**
 * Chart values from QIDI Max 4 Optimized's tltg_klipper_health: Klipper's
 * timer count and its main thread's share of a core, in percent. Status
 * updates carry only changed fields, so the update is laid over the stored
 * state.
 */
const klipperHealthChartValues = (
  stored?: Partial<Klipper.TltgKlipperHealthState>,
  update?: Partial<Klipper.TltgKlipperHealthState>
): Record<string, number> => {
  const health = { ...stored, ...update }
  const values: Record<string, number> = {}

  if (typeof health.timers === 'number') {
    values.timers = health.timers
  }

  if (typeof health.main_thread_load === 'number') {
    values.main_thread = decimalRound(health.main_thread_load * 100, 2)
  }

  return values
}

export default klipperHealthChartValues
