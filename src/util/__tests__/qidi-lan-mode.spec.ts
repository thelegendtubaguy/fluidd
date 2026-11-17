import { qidiLanModeFromConfig, qidiLanModeValue } from '../qidi-lan-mode'

describe('qidiLanModeFromConfig', () => {
  it('reads QIDI Moonraker answers as QIDI\'s touchscreen app does', () => {
    expect(qidiLanModeFromConfig({ status: 'success', result: { 'general.lan_mode': '1' } })).toBe(true)
    expect(qidiLanModeFromConfig({ status: 'success', result: { 'general.lan_mode': '0' } })).toBe(false)
    expect(qidiLanModeFromConfig({ status: 'success', result: { 'general.lan_mode': 1 } })).toBe(true)
  })

  it('reports no setting for answers that aren\'t QIDI\'s', () => {
    expect(qidiLanModeFromConfig({ status: 'error', message: "Config item 'general.lan_mode' not found" })).toBeNull()
    expect(qidiLanModeFromConfig({ status: 'success', result: {} })).toBeNull()
    expect(qidiLanModeFromConfig(undefined)).toBeNull()
  })
})

describe('qidiLanModeValue', () => {
  it('writes the values QIDI\'s touchscreen app writes', () => {
    expect(qidiLanModeValue(true)).toBe('1')
    expect(qidiLanModeValue(false)).toBe('0')
  })
})
