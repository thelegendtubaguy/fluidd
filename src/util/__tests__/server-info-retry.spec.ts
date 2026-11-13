import { serverInfoRetryDelay } from '../server-info-retry'
import { Globals } from '@/globals'

const serverInfo = (info: Partial<Moonraker.Server.InfoResponse>) => ({
  klippy_connected: true,
  klippy_state: 'ready',
  components: [],
  failed_components: [],
  warnings: [],
  ...info
}) as Moonraker.Server.InfoResponse

describe('serverInfoRetryDelay', () => {
  it('reads again shortly while Klipper is not ready', () => {
    expect(serverInfoRetryDelay(serverInfo({ klippy_state: 'startup' }))).toBe(Globals.KLIPPY_RETRY_DELAY)
  })

  it('reads again while Moonraker reports warnings or failed components, so cleared ones go away', () => {
    expect(serverInfoRetryDelay(serverInfo({ warnings: ['MQTT Connection Failed: Not authorized'] })))
      .toBe(Globals.MOONRAKER_WARNINGS_RECHECK_DELAY)
    expect(serverInfoRetryDelay(serverInfo({ failed_components: ['mqtt'] })))
      .toBe(Globals.MOONRAKER_WARNINGS_RECHECK_DELAY)
  })

  it('stops reading once Klipper is ready and Moonraker reports nothing', () => {
    expect(serverInfoRetryDelay(serverInfo({}))).toBeUndefined()
  })
})
