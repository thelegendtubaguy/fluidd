<template>
  <div class="bed-soak-heatmap">
    <div class="bed-soak-heatmap__title">
      {{ $t('app.bed_soak.label.change_from_cold') }}
    </div>
    <div class="bed-soak-heatmap__sub">
      {{ $t('app.bed_soak.label.top_view') }}
    </div>

    <v-btn-toggle
      v-model="mode"
      mandatory
      dense
      color="primary"
      class="bed-soak-heatmap__mode mb-2"
    >
      <v-btn
        small
        value="shape"
      >
        {{ $t('app.bed_soak.label.shape') }}
      </v-btn>
      <v-btn
        small
        value="height"
      >
        {{ $t('app.bed_soak.label.shape_and_height') }}
      </v-btn>
    </v-btn-toggle>

    <div
      v-if="grid"
      class="bed-soak-heatmap__map"
    >
      <svg
        :viewBox="`0 0 ${size} ${size}`"
        :width="size"
        :height="size"
        role="img"
        :aria-label="$t('app.bed_soak.label.change_from_cold').toString()"
      >
        <template v-for="cell in cells">
          <rect
            :key="`cell:${cell.key}`"
            :x="cell.x"
            :y="cell.y"
            :width="cellSize"
            :height="cellSize"
            rx="3"
            :fill="cell.color"
            :stroke="hover === cell.key ? strongColor : 'none'"
            stroke-width="1.5"
            tabindex="0"
            @pointerenter="hover = cell.key"
            @pointerleave="hover = null"
            @focus="hover = cell.key"
            @blur="hover = null"
          />
          <template v-if="cell.flag">
            <rect
              :key="`ring:${cell.key}`"
              :x="cell.x + 2"
              :y="cell.y + 2"
              :width="cellSize - 4"
              :height="cellSize - 4"
              rx="3"
              fill="none"
              :stroke="warningColor"
              stroke-width="2.5"
              pointer-events="none"
            />
            <circle
              :key="`badge:${cell.key}`"
              :cx="cell.x + cellSize - badge"
              :cy="cell.y + badge"
              :r="badge - 4"
              :fill="warningColor"
              pointer-events="none"
            />
            <text
              :key="`mark:${cell.key}`"
              :x="cell.x + cellSize - badge"
              :y="cell.y + badge + 4"
              text-anchor="middle"
              font-size="11"
              font-weight="700"
              fill="#0b0b0b"
              pointer-events="none"
            >!</text>
          </template>
        </template>
      </svg>

      <div
        v-if="hoverCell"
        class="bed-soak-heatmap__tip"
        :style="{
          left: `${Math.min(hoverCell.x + 8, size - 200)}px`,
          top: `${hoverCell.y + cellSize - 4}px`
        }"
      >
        <div>
          <b>{{ formatChange(hoverCell.value) }}</b>
          <span class="ms-2">{{ hoverCell.name }}</span>
        </div>
        <div
          v-for="text in hoverCell.flag"
          :key="text"
          class="mt-1"
        >
          {{ text }}
        </div>
      </div>
    </div>
    <div
      v-else
      class="bed-soak-heatmap__empty"
      :style="{ height: `${size}px` }"
    >
      {{ $t('app.bed_soak.msg.heatmap_after_cold') }}
    </div>

    <div class="bed-soak-heatmap__scale">
      <span>{{ $t('app.bed_soak.label.lower') }}</span>
      <div
        class="bed-soak-heatmap__bar"
        :style="{ background: scaleGradient }"
      />
      <span>{{ $t('app.bed_soak.label.higher') }}</span>
    </div>
    <div class="bed-soak-heatmap__scale bed-soak-heatmap__scale--values">
      <span>−{{ Math.round(maxAbs) }} µm</span>
      <span>0</span>
      <span>+{{ Math.round(maxAbs) }} µm</span>
    </div>

    <template v-if="run.meshes.length > 1">
      <v-slider
        :value="index"
        :min="0"
        :max="run.meshes.length - 1"
        step="1"
        hide-details
        class="mt-2"
        @input="handleSelect"
      />
      <div class="bed-soak-heatmap__slider-label">
        <span>{{ $t('app.bed_soak.label.cold') }}</span>
        <span>{{ meshLabel }}</span>
      </div>
    </template>

    <div class="d-flex flex-wrap mt-3">
      <app-btn
        small
        class="me-2 mb-2"
        :disabled="!grid"
        @click="handleViewIn3d"
      >
        {{ $t('app.bed_soak.btn.view_in_3d') }}
      </app-btn>
      <slot name="actions" />
    </div>

    <div
      v-if="problemPoints.length > 0 || run.jumps.length > 0"
      class="bed-soak-problems"
    >
      <v-divider class="mb-2" />
      <div class="bed-soak-problems__title">
        <v-icon
          small
          :color="warningColor"
          class="me-1"
        >
          $warning
        </v-icon>
        {{ $t('app.bed_soak.label.problem_points_n', { count: problemPoints.length + run.jumps.length }) }}
      </div>
      <div
        v-for="point in problemPoints"
        :key="`point:${point.row}:${point.col}`"
        class="bed-soak-problems__item"
      >
        <v-icon
          small
          :color="warningColor"
          class="me-2"
        >
          $warning
        </v-icon>
        <span>
          <b>{{ pointName(point) }}</b>
          {{ problemText(point) }}
        </span>
      </div>
      <div
        v-for="jump in run.jumps"
        :key="`jump:${jump.mesh}`"
        class="bed-soak-problems__item"
      >
        <v-icon
          small
          :color="warningColor"
          class="me-2"
        >
          $warning
        </v-icon>
        <span>
          <b>{{ meshName(jump.mesh) }}</b>
          {{ $t('app.bed_soak.msg.problem_jump', { size: Math.round(jump.size * 1000) }) }}
        </span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'
import {
  BedSoakColors,
  bedSoakChangeGrid,
  bedSoakHeatmapColor,
  bedSoakPointPosition,
  bedSoakProblemPoints,
  type BedSoakMesh,
  type BedSoakProblemPoint,
  type BedSoakRun
} from '@/util/tltg-bed-soak'
import type { MeshMarker } from '@/store/mesh/types'
import { bedSoakClock, bedSoakMeshList, bedSoakMeshName, bedSoakPointName } from './bed-soak-format'

interface HeatmapCell {
  key: string;
  row: number;
  col: number;
  x: number;
  y: number;
  value: number;
  color: string;
  name: string;
  flag: string[] | null;
}

@Component({})
export default class BedSoakHeatmap extends Vue {
  @Prop({ type: Object, required: true })
  readonly run!: BedSoakRun

  readonly size = 270
  readonly pad = 2
  readonly warningColor = BedSoakColors.warning

  mode: 'shape' | 'height' = 'shape'

  // null follows the latest mesh
  selected: number | null = null

  hover: string | null = null

  get isDark (): boolean {
    return this.$typedState.config.uiSettings.theme.isDark
  }

  get neutralColor () {
    return this.isDark ? '#3a3a3d' : '#e4e4e7'
  }

  get strongColor () {
    return this.isDark ? '#f0efec' : '#1b1b1d'
  }

  get scaleGradient () {
    return `linear-gradient(90deg, #3987e5, ${this.neutralColor}, #e66767)`
  }

  get index (): number {
    const last = this.run.meshes.length - 1

    return this.selected != null && this.selected < last
      ? this.selected
      : last
  }

  get mesh (): BedSoakMesh | undefined {
    return this.run.meshes[this.index]
  }

  get rows (): number {
    return this.mesh?.matrix.length ?? 0
  }

  get cols (): number {
    return this.mesh?.matrix[0]?.length ?? 0
  }

  get cellSize (): number {
    const count = Math.max(this.rows, this.cols, 1)

    return (this.size - this.pad * (count - 1)) / count
  }

  get badge (): number {
    return Math.min(11, this.cellSize / 4)
  }

  changeGrid (mesh: BedSoakMesh): number[][] | null {
    const grid = bedSoakChangeGrid(this.run, mesh, this.mode === 'height')

    return grid && grid.map(row => row.map(value => value * 1000))
  }

  // µm
  get grid (): number[][] | null {
    return this.mesh ? this.changeGrid(this.mesh) : null
  }

  // The same scale for every mesh, so moving the slider doesn't rescale it
  get maxAbs (): number {
    const values = this.run.meshes
      .filter(mesh => mesh.used)
      .flatMap(mesh => this.changeGrid(mesh)?.flat() ?? [])
      .map(Math.abs)

    return Math.max(5, ...values)
  }

  // What was flagged at each point in the selected mesh
  get flags (): Map<string, string[]> {
    const flags = new Map<string, string[]>()
    const add = (row: number, col: number, text: string) => {
      const key = `${row}:${col}`
      flags.set(key, [...(flags.get(key) ?? []), text])
    }

    for (const point of this.mesh?.retried ?? []) {
      add(point.row, point.col, this.$t('app.bed_soak.msg.cell_retried', {
        tries: point.tries,
        spread: Math.round(point.spread * 1000)
      }).toString())
    }

    for (const point of this.mesh?.out_of_line ?? []) {
      add(point.row, point.col, this.$t('app.bed_soak.msg.cell_out_of_line', {
        change: this.formatChange(point.change * 1000)
      }).toString())
    }

    return flags
  }

  get cells (): HeatmapCell[] {
    const grid = this.grid

    if (!grid) return []

    const step = this.cellSize + this.pad

    return grid.flatMap((row, r) => row.map((value, c) => {
      const position = bedSoakPointPosition(this.run.settings, this.rows, this.cols, r, c)
      const key = `${r}:${c}`

      return {
        key,
        row: r,
        col: c,
        x: c * step,
        // Front of the bed (the first row) at the bottom
        y: (this.rows - 1 - r) * step,
        value,
        color: bedSoakHeatmapColor(value, this.maxAbs, this.neutralColor),
        name: bedSoakPointName(this, position),
        flag: this.flags.get(key) ?? null
      }
    }))
  }

  get hoverCell (): HeatmapCell | undefined {
    return this.cells.find(cell => cell.key === this.hover)
  }

  get meshLabel (): string {
    const mesh = this.mesh

    if (!mesh) return ''
    if (mesh.index === 0) return this.meshName(0)

    const parts = [
      this.meshName(mesh.index),
      this.$t('app.bed_soak.label.after_heaters_on', { time: bedSoakClock(mesh.time) }).toString()
    ]

    if (!mesh.used) parts.push(this.$t('app.bed_soak.label.not_used').toString())

    return parts.join(' · ')
  }

  get problemPoints (): BedSoakProblemPoint[] {
    return bedSoakProblemPoints(this.run)
  }

  meshName (index: number) {
    return bedSoakMeshName(this, index)
  }

  pointName (point: { x: number, y: number }) {
    return bedSoakPointName(this, point)
  }

  formatChange (value: number) {
    const sign = value >= 0 ? '+' : '−'

    return `${sign}${Math.abs(value).toFixed(1)} µm`
  }

  meshes (indices: number[]) {
    return indices.length <= 6
      ? this.$tc('app.bed_soak.label.in_meshes', indices.length, { list: bedSoakMeshList(indices) }).toString()
      : this.$t('app.bed_soak.label.in_count_of_meshes', { count: indices.length, total: this.run.meshes.length }).toString()
  }

  problemText (point: BedSoakProblemPoint) {
    const parts: string[] = []

    if (point.retried.length > 0) {
      parts.push(this.$t('app.bed_soak.msg.problem_retried', {
        meshes: this.meshes(point.retried),
        tries: point.maxTries,
        spread: Math.round(point.maxSpread * 1000)
      }).toString())
    }

    if (point.outOfLine.length > 0) {
      parts.push(this.$t('app.bed_soak.msg.problem_out_of_line', {
        meshes: this.meshes(point.outOfLine),
        change: this.formatChange(point.maxChange * 1000)
      }).toString())
    }

    return `${parts.join('; ')}. ${this.$t('app.bed_soak.msg.problem_check_plate')}`
  }

  handleSelect (value: number) {
    this.selected = value >= this.run.meshes.length - 1 ? null : value
  }

  handleViewIn3d () {
    const grid = this.grid
    const mesh = this.mesh

    if (!grid || !mesh) return

    const markers: MeshMarker[] = this.cells
      .filter(cell => cell.flag)
      .map(cell => {
        const position = bedSoakPointPosition(this.run.settings, this.rows, this.cols, cell.row, cell.col)

        return {
          ...position,
          label: `${cell.name} · ${cell.flag?.join(' ')}`
        }
      })

    this.$typedDispatch('mesh/onPreview', {
      title: this.$t('app.bed_soak.label.preview_title', {
        mesh: this.meshName(mesh.index),
        mode: this.mode === 'height'
          ? this.$t('app.bed_soak.label.shape_and_height')
          : this.$t('app.bed_soak.label.shape')
      }).toString(),
      mesh_min: this.run.settings.mesh_min,
      mesh_max: this.run.settings.mesh_max,
      matrix: grid.map(row => row.map(value => value / 1000)),
      markers
    })

    try {
      this.$vuetify.goTo('.bed-mesh-card', { offset: 64 })
    } catch {
      // The Bed mesh card isn't on this page
    }
  }
}
</script>

<style lang="scss" scoped>
  .bed-soak-heatmap__title {
    font-size: 0.8125rem;
    font-weight: 500;
    margin-top: 4px;
  }

  .bed-soak-heatmap__sub {
    font-size: 0.75rem;
    opacity: 0.6;
    margin-bottom: 8px;
  }

  .bed-soak-heatmap__mode {
    display: flex;
    width: 270px;

    .v-btn {
      flex: 1;
    }
  }

  .bed-soak-heatmap__map {
    position: relative;
    width: 270px;

    svg {
      display: block;
    }

    rect:focus {
      outline: none;
    }
  }

  .bed-soak-heatmap__empty {
    width: 270px;
    display: grid;
    place-items: center;
    font-size: 0.75rem;
    opacity: 0.6;
    border: 1px dashed rgba(128, 128, 128, 0.4);
    border-radius: 4px;
    text-align: center;
    padding: 16px;
  }

  .bed-soak-heatmap__tip {
    position: absolute;
    z-index: 2;
    pointer-events: none;
    max-width: 230px;
    padding: 8px 10px;
    font-size: 0.75rem;
    border-radius: 4px;
    background: rgba(15, 15, 15, 0.92);
    color: rgba(255, 255, 255, 0.9);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
  }

  .bed-soak-heatmap__scale {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 270px;
    font-size: 0.6875rem;
    opacity: 0.7;
    margin-top: 6px;

    &--values {
      justify-content: space-between;
      margin-top: 2px;
    }
  }

  .bed-soak-heatmap__bar {
    flex: 1;
    height: 8px;
    border-radius: 2px;
  }

  .bed-soak-heatmap__slider-label {
    display: flex;
    justify-content: space-between;
    width: 270px;
    font-size: 0.75rem;
    opacity: 0.8;
  }

  .bed-soak-heatmap :deep(.v-slider) {
    width: 270px;
  }

  .bed-soak-problems {
    margin-top: 8px;
  }

  .bed-soak-problems__title {
    display: flex;
    align-items: center;
    font-size: 0.75rem;
    font-weight: 500;
    margin-bottom: 4px;
  }

  .bed-soak-problems__item {
    display: flex;
    align-items: flex-start;
    font-size: 0.75rem;
    margin: 6px 0;
  }
</style>
