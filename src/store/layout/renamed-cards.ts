import type { LayoutContainer } from './types'

/**
 * Dashboard card IDs Valve Oil's cards had before its tltg names became vo. A dashboard saved under an old ID keeps
 * the card's place, and whether it's enabled and collapsed, under the new one.
 */
export const RENAMED_CARD_IDS: ReadonlyMap<string, string> = new Map([
  ['tltg-screen-card', 'vo-screen-card'],
  ['tltg-qidi-box-card', 'vo-qidi-box-card']
])

export const renameLayoutCards = (layout: LayoutContainer, renamed: ReadonlyMap<string, string> = RENAMED_CARD_IDS) => {
  const ids = new Set(Object.values(layout).flat().map(card => card.id))

  for (const [containerKey, cards] of Object.entries(layout)) {
    layout[containerKey] = cards.flatMap(card => {
      const id = renamed.get(card.id)

      if (id == null) return [card]

      // A dashboard saved since the rename already has the card under its new ID.
      if (ids.has(id)) return []

      ids.add(id)

      return [{ ...card, id }]
    })
  }
}
