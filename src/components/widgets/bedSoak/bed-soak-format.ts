import type Vue from 'vue'

/** m:ss, or h:mm:ss from an hour */
export const bedSoakClock = (seconds: number): string => {
  const total = Math.max(0, Math.round(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = String(total % 60).padStart(2, '0')

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${secs}`
    : `${minutes}:${secs}`
}

/** 9 min 30 s */
export const bedSoakDuration = (vm: Vue, seconds: number): string => {
  const total = Math.max(0, Math.round(seconds))

  return vm.$t('app.bed_soak.label.duration', {
    min: Math.floor(total / 60),
    s: String(total % 60).padStart(2, '0')
  }).toString()
}

export const bedSoakMeshName = (vm: Vue, index: number): string => (
  index === 0
    ? vm.$t('app.bed_soak.label.cold_mesh').toString()
    : vm.$t('app.bed_soak.label.mesh_n', { n: index }).toString()
)

export const bedSoakPointName = (vm: Vue, point: { x: number, y: number }): string => (
  vm.$t('app.bed_soak.label.point', { x: Math.round(point.x), y: Math.round(point.y) }).toString()
)

export const bedSoakMeshList = (indices: number[]): string => indices.join(', ')
