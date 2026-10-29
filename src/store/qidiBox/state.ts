import type { QidiBoxState } from './types'

export const createState = (): QidiBoxState => {
  return {
    dialog: {
      show: false
    },
    filamentList: null,
    filamentDatabase: null,
    filamentDatabaseInvalid: false
  }
}
