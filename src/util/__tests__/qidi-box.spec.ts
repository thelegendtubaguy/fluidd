import { matchQidiBoxSlots, parseQidiFilamentList, qidiBoxSlots } from '../qidi-box'

const filamentList = parseQidiFilamentList([
  '[fila18]',
  'filament                       = ASA',
  'box_max_temp                   = 45',
  'type                           = ASA',
  '',
  '[colordict]',
  '2                              = #060606',
  '',
  '[vendor_list]',
  '0                              = Generic'
].join('\n'))

const filamentInfo = (index: number, type: string, color: string) => ({
  index,
  filament_id: 'QFA90',
  filament_str: type,
  filament_type: type,
  vendor_str: 'Generic',
  color_rgb_str: [color],
  box_max_temp: 0
})

describe('qidiBoxSlots', () => {
  it('reads firmware 01.01.07.01 resolved slot filaments', () => {
    const slots = qidiBoxSlots({
      save_variables: { variables: { box_count: 1 } },
      box_extras: {
        boxes: [{
          filament_info: [
            filamentInfo(0, 'PLA', '#228332'),
            filamentInfo(1, 'PLA', 'ff362d'),
            filamentInfo(2, 'PETG', '#FFFFFF'),
            filamentInfo(3, 'PLA', '#000000')
          ]
        }]
      },
      'box_stepper slot0': { runout_button: 0 },
      'box_stepper slot1': { runout_button: 0 },
      'box_stepper slot2': { runout_button: 0 },
      'box_stepper slot3': { runout_button: 1 }
    }, null)

    expect(slots.map(slot => [slot.label, slot.present, slot.type, slot.color])).toStrictEqual([
      ['1A', true, 'PLA', '#228332'],
      ['1B', true, 'PLA', '#FF362D'],
      ['1C', true, 'PETG', '#FFFFFF'],
      ['1D', false, 'PLA', '#000000'],
      ['Ext', true, null, null]
    ])
  })

  it('resolves numeric IDs from earlier firmware through the filament list', () => {
    const [slot] = qidiBoxSlots({
      save_variables: { variables: { box_count: 1, filament_slot0: 18, color_slot0: 2, vendor_slot0: 0 } },
      'box_stepper slot0': { runout_button: 0 }
    }, filamentList)

    expect(slot).toMatchObject({ present: true, name: 'ASA', type: 'ASA', vendor: 'Generic', color: '#060606', boxMaxTemp: 45 })
  })
})

describe('matchQidiBoxSlots', () => {
  const slots = qidiBoxSlots({
    save_variables: { variables: { box_count: 1 } },
    box_extras: {
      boxes: [{
        filament_info: [
          filamentInfo(0, 'PLA', '#228332'),
          filamentInfo(1, 'PLA', '#FF362D'),
          filamentInfo(2, 'PETG', '#FFFFFF'),
          filamentInfo(3, 'PLA', '#000000')
        ]
      }]
    },
    'box_stepper slot0': { runout_button: 0 },
    'box_stepper slot1': { runout_button: 0 },
    'box_stepper slot2': { runout_button: 0 },
    'box_stepper slot3': { runout_button: 1 }
  }, null)

  it('gives each tool the nearest-colored unused loaded slot of its type', () => {
    expect(matchQidiBoxSlots([
      { tool: 0, type: 'PLA', color: '#FF0000' },
      { tool: 1, type: 'pla', color: '#FF0000' },
      { tool: 2, type: 'PETG', color: '#000000' }
    ], slots)).toStrictEqual({ 0: 1, 1: 0, 2: 2 })
  })

  it('leaves a tool unassigned when no unused slot of its type is loaded', () => {
    expect(matchQidiBoxSlots([
      { tool: 0, type: 'PETG', color: '#FFFFFF' },
      { tool: 1, type: 'PETG', color: '#FFFFFF' },
      { tool: 2, type: 'ABS', color: '#FFFFFF' }
    ], slots)).toStrictEqual({ 0: 2, 1: null, 2: null })
  })
})
