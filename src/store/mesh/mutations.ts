import type { MutationTree } from 'vuex'
import { createState } from './state'
import type { MatrixType, MeshPreview, MeshState } from './types'

export const mutations = {
  /**
   * Reset state
   */
  setReset (state) {
    Object.assign(state, createState())
  },

  setMatrix (state, payload: MatrixType) {
    state.matrix = payload
  },

  setScale (state, payload: number) {
    state.scale = payload
  },

  setBoxScale (state, payload: number) {
    state.boxScale = payload
  },

  setWireframe (state, payload: boolean) {
    state.wireframe = payload
  },

  setFlatSurface (state, payload: boolean) {
    state.flatSurface = payload
  },

  setPreview (state, payload: MeshPreview | null) {
    state.preview = payload && Object.freeze(payload)
  }
} satisfies MutationTree<MeshState>
