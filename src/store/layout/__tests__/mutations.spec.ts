import { mutations } from '../mutations'
import { createState } from '../state'
import type { LayoutConfig, LayoutContainer, LayoutState } from '../types'

const find = (layout: LayoutContainer, id: string) => {
  for (const [container, cards] of Object.entries(layout)) {
    const index = cards.findIndex(card => card.id === id)

    if (index >= 0) return { container, index, card: cards[index] }
  }
}

const savedDashboard = (screenCard: LayoutConfig): LayoutContainer => {
  const dashboard = createState().layouts.dashboard

  for (const [container, cards] of Object.entries(dashboard)) {
    dashboard[container] = cards.filter(card => card.id !== 'vo-screen-card')
  }

  // Moved by the operator to the second column, second place, expanded and hidden.
  dashboard.container2.splice(1, 0, screenCard)

  return dashboard
}

describe('layout setInitLayout', () => {
  it.each(['dashboard', 'dashboard-lg-nick'])('keeps the place and state of a %s card saved under its tltg ID', (layoutKey) => {
    const state = createState()
    const payload: LayoutState = {
      layouts: {
        [layoutKey]: savedDashboard({ id: 'tltg-screen-card', enabled: false, collapsed: false })
      }
    }

    mutations.setInitLayout(state, payload)

    const layout = state.layouts[layoutKey]

    expect(find(layout, 'tltg-screen-card')).toBeUndefined()
    expect(find(layout, 'vo-screen-card')).toEqual({
      container: 'container2',
      index: 1,
      card: { id: 'vo-screen-card', enabled: false, collapsed: false }
    })
  })

  it('keeps a card already saved under its vo ID over a leftover tltg copy', () => {
    const state = createState()
    const dashboard = savedDashboard({ id: 'vo-screen-card', enabled: true, collapsed: false })

    dashboard.container1.push({ id: 'tltg-screen-card', enabled: false, collapsed: true })

    mutations.setInitLayout(state, { layouts: { dashboard } })

    const layout = state.layouts.dashboard
    const cards = Object.values(layout).flat()

    expect(cards.filter(card => card.id === 'vo-screen-card' || card.id === 'tltg-screen-card')).toHaveLength(1)
    expect(find(layout, 'vo-screen-card')).toEqual({
      container: 'container2',
      index: 1,
      card: { id: 'vo-screen-card', enabled: true, collapsed: false }
    })
  })
})
