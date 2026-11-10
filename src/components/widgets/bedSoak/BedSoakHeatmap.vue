<template>
  <div class="bed-soak-heatmap">
    <div class="d-flex align-center">
      <span class="body-2 font-weight-medium">{{ $t('app.bed_soak.label.change_from_cold') }}</span>
      <app-inline-help
        bottom
        small
        :tooltip="$t('app.bed_soak.tooltip.heatmap')"
      />
    </div>

    <div
      v-if="grid"
      class="bed-soak-heatmap__map mt-2"
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
            rx="2"
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
              :x="cell.x + 1.5"
              :y="cell.y + 1.5"
              :width="cellSize - 3"
              :height="cellSize - 3"
              rx="2"
              fill="none"
              :stroke="warningColor"
              stroke-width="2.5"
              pointer-events="none"
            />
            <circle
              :key="`badge:${cell.key}`"
              :cx="cell.x + cellSize - badge"
              :cy="cell.y + badge"
              :r="badge - 3"
              :fill="warningColor"
              pointer-events="none"
            />
            <text
              :key="`mark:${cell.key}`"
              :x="cell.x + cellSize - badge"
              :y="cell.y + badge + 3.5"
              text-anchor="middle"
              font-size="10"
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

      <div class="bed-soak-heatmap__scale caption secondary--text">
        <span>−{{ Math.round(maxAbs) }}</span>
        <div
          class="bed-soak-heatmap__bar"
          :style="{ background: scaleGradient }"
        />
        <span>+{{ Math.round(maxAbs) }} µm</span>
      </div>

      <v-slider
        v-if="run.meshes.length > 1"
        :value="index"
        :min="0"
        :max="run.meshes.length - 1"
        step="1"
        dense
        hide-details
        class="mt-1"
        @input="handleSelect"
      />
      <div class="body-2 secondary--text">
        {{ meshLabel }}
      </div>
      <div class="d-flex align-center mt-1">
        <v-switch
          v-model="withHeight"
          :label="$t('app.bed_soak.label.with_height')"
          dense
          hide-details
          class="mt-0 pt-0"
        />
        <v-spacer />
        <app-btn
          small
          @click="handleViewIn3d"
        >
          {{ $t('app.bed_soak.btn.view_in_3d') }}
        </app-btn>
      </div>
    </div>
    <div
      v-else
      class="secondary--text mt-2"
    >
      {{ $t('app.bed_soak.msg.heatmap_after_cold') }}
    </div>

    <div
      v-if="problems.length > 0"
      class="mt-3"
    >
      <div class="body-2 font-weight-medium d-flex align-center mb-1">
        <v-icon
          small
          :color="warningColor"
          class="me-1"
        >
          $warning
        </v-icon>
        {{ $tc('app.bed_soak.label.problems_count', problems.length, { count: problems.length }) }}
      </div>
      <div
        v-for="problem in shownProblems"
        :key="problem.key"
        class="body-2 bed-soak-heatmap__problem"
      >
        <b>{{ problem.name }}</b> {{ problem.text }}
      </div>
      <a
        v-if="problems.length > shownProblems.length || showAllProblems"
        class="body-2"
        @click="showAllProblems = !showAllProblems"
      >
        {{ showAllProblems ? $t('app.bed_soak.btn.show_fewer') : $t('app.bed_soak.btn.show_all', { count: problems.length }) }}
      </a>
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

  readonly size = 260
  readonly pad = 2
  readonly warningColor = BedSoakColors.warning

  withHeight = false
  showAllProblems = false

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
    const grid = bedSoakChangeGrid(this.run, mesh, this.withHeight)

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
      bedSoakClock(mesh.time)
    ]

    if (!mesh.used) parts.push(this.$t('app.bed_soak.label.not_used').toString())

    return parts.join(' · ')
  }

  get problemPoints (): BedSoakProblemPoint[] {
    return bedSoakProblemPoints(this.run)
  }

  // Flagged points and dropped meshes, most often flagged first
  get problems (): { key: string, name: string, text: string }[] {
    return [
      ...this.problemPoints.map(point => ({
        key: `point:${point.row}:${point.col}`,
        name: this.pointName(point),
        text: this.problemText(point)
      })),
      ...this.run.jumps.map(jump => ({
        key: `jump:${jump.mesh}`,
        name: this.meshName(jump.mesh),
        text: this.$t('app.bed_soak.msg.problem_jump', { size: Math.round(jump.size * 1000) }).toString()
      }))
    ]
  }

  get shownProblems () {
    return this.showAllProblems ? this.problems : this.problems.slice(0, 4)
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

    return parts.join('; ')
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
        mode: this.withHeight
          ? this.$t('app.bed_soak.label.shape_and_height').toString().toLowerCase()
          : this.$t('app.bed_soak.label.shape').toString().toLowerCase()
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
  .bed-soak-heatmap {
    min-width: 0;
  }

  .bed-soak-heatmap__map {
    position: relative;
    width: 260px;

    svg {
      display: block;
    }

    rect:focus {
      outline: none;
    }
  }

  .bed-soak-heatmap__tip {
    position: absolute;
    z-index: 2;
    pointer-events: none;
    max-width: 230px;
    padding: 6px 8px;
    font-size: 0.75rem;
    border-radius: 4px;
    background: rgba(15, 15, 15, 0.92);
    color: rgba(255, 255, 255, 0.9);
  }

  .bed-soak-heatmap__scale {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 6px;
  }

  .bed-soak-heatmap__bar {
    flex: 1;
    height: 6px;
    border-radius: 2px;
  }

  .bed-soak-heatmap__problem {
    margin: 2px 0 2px 20px;
  }
</style>
