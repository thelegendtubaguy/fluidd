<template>
  <!-- Box units around the filament path hub → toolhead → extruder → nozzle. Strands in the filament's color show
       what the sensors see: the slot parked at the hub, and the slot loaded to the nozzle. -->
  <div class="qidi-box-flow">
    <qidi-box-loaded-summary
      v-if="layout.narrow"
      class="mb-3 pa-3 rounded-lg qidi-box-flow__summary"
      large
      v-bind="summary"
    />

    <div
      ref="diagram"
      class="qidi-box-flow__diagram"
    >
      <svg
        class="qidi-box-flow__strands"
        :width="svgWidth"
        :height="svgHeight"
        aria-hidden="true"
      >
        <template v-for="path in paths">
          <path
            v-if="path.slot == null"
            :key="path.key"
            :d="path.d"
            class="qidi-box-flow__guide"
          />
          <template v-else>
            <path
              :key="`${path.key}:edge`"
              :d="path.d"
              class="qidi-box-flow__strand-edge"
              :class="{ 'qidi-box-flow__strand-edge--contrast': path.contrast }"
            />
            <path
              :key="path.key"
              :d="path.d"
              class="qidi-box-flow__strand"
              :style="{ stroke: path.color ?? undefined }"
            />
          </template>
        </template>
      </svg>

      <div
        v-if="!layout.compact"
        class="qidi-box-flow__tier"
      >
        <qidi-box-unit
          v-for="box in layout.top"
          :key="`unit:${box}`"
          v-bind="unitProps(box)"
          v-on="unitListeners"
        />
      </div>

      <div
        class="qidi-box-flow__rail"
        :class="{
          'qidi-box-flow__rail--first': layout.compact,
          'qidi-box-flow__rail--last': !layout.compact && !layout.bottom.length
        }"
      >
        <div class="qidi-box-flow__path">
          <template v-if="boxCount">
            <div
              class="qidi-box-flow__node"
              :class="{ 'qidi-box-flow__node--on': hubTriggered }"
              :title="$t('app.qidi_box.label.hub').toString()"
            >
              <span
                class="qidi-box-flow__sensor"
                data-port="hub"
              />
              <small>{{ hubLabel }}</small>
            </div>
            <div class="qidi-box-flow__ptfe">
              <small>PTFE</small>
            </div>
          </template>
          <div
            class="qidi-box-flow__node"
            :class="{ 'qidi-box-flow__node--on': toolheadSlot != null }"
            :title="$t('app.qidi_box.label.toolhead_sensor').toString()"
          >
            <span
              class="qidi-box-flow__sensor"
              data-port="th"
            />
            <small>{{ $t('app.qidi_box.label.toolhead') }}</small>
          </div>
          <div class="qidi-box-flow__node">
            <span
              class="qidi-box-flow__extruder"
              data-port="ex"
            />
            <small>{{ $t('app.qidi_box.label.extruder') }}</small>
          </div>
          <div
            class="qidi-box-flow__node"
            :class="{ 'qidi-box-flow__node--on': nozzleColor != null }"
          >
            <span
              class="qidi-box-flow__nozzle"
              data-port="noz"
            >
              <qidi-box-nozzle :color="nozzleColor" />
            </span>
            <small>{{ $t('app.qidi_box.label.nozzle') }}</small>
          </div>
        </div>

        <qidi-box-loaded-summary
          v-if="!layout.narrow"
          class="qidi-box-flow__inline-summary"
          :size="40"
          v-bind="summary"
        />
      </div>

      <div
        v-if="layout.compact || layout.bottom.length"
        class="qidi-box-flow__tier"
      >
        <qidi-box-unit
          v-for="box in (layout.compact ? layout.top : layout.bottom)"
          :key="`unit:${box}`"
          v-bind="unitProps(box)"
          :below="!layout.compact"
          v-on="unitListeners"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'
import { markRaw } from 'vue'
import {
  QIDI_BOX_EXTERNAL_SLOT,
  qidiBoxSlotLabel,
  qidiColorNearBackground,
  type QidiBoxClimate,
  type QidiBoxReloadGroups,
  type QidiBoxSlot
} from '@/util/qidi-box'
import {
  qidiBoxFlowConnections,
  qidiBoxFlowLayout,
  qidiBoxFlowPath,
  type QidiBoxFlowLayout
} from '@/util/qidi-box-flow'
import QidiBoxUnit from './QidiBoxUnit.vue'
import QidiBoxNozzle from './QidiBoxNozzle.vue'
import QidiBoxLoadedSummary from './QidiBoxLoadedSummary.vue'

interface FlowPath {
  key: string;
  d: string;
  slot: number | null;
  color: string | null;
  contrast: boolean;
}

@Component({
  components: {
    QidiBoxUnit,
    QidiBoxNozzle,
    QidiBoxLoadedSummary
  }
})
export default class QidiBoxFlow extends Vue {
  @Prop({ type: Array, required: true })
  readonly slots!: QidiBoxSlot[]

  @Prop({ type: Number, required: true })
  readonly boxCount!: number

  @Prop({ type: Object, required: true })
  readonly climates!: Record<number, QidiBoxClimate>

  @Prop({ type: Number, required: true })
  readonly selected!: number

  @Prop({ type: Number, default: null })
  readonly loadedSlot!: number | null

  // The slot whose filament the hub sensor sees, and the one at the toolhead sensor.
  @Prop({ type: Number, default: null })
  readonly hubSlot!: number | null

  @Prop({ type: Number, default: null })
  readonly toolheadSlot!: number | null

  @Prop({ type: Boolean })
  readonly hubTriggered!: boolean

  @Prop({ type: Object, required: true })
  readonly toolsBySlot!: Record<number, string[]>

  @Prop({ type: Object, required: true })
  readonly reloadGroups!: QidiBoxReloadGroups

  @Prop({ type: Boolean })
  readonly busy!: boolean

  @Prop({ type: String, default: null })
  readonly step!: string | null

  width = 0
  svgWidth = 0
  svgHeight = 0
  paths: FlowPath[] = []
  pathsKey = ''
  observer: ResizeObserver | null = null
  frame = 0

  get layout (): QidiBoxFlowLayout {
    return qidiBoxFlowLayout(this.width, this.boxCount)
  }

  get slotByIndex (): Record<number, QidiBoxSlot> {
    return Object.fromEntries(this.slots.map(slot => [slot.index, slot]))
  }

  get unitListeners () {
    return {
      select: (index: number) => this.$emit('select', index),
      'tool-click': (entry: { tool: number, slot: number }) => this.$emit('tool-click', entry)
    }
  }

  get pathSlot (): QidiBoxSlot | null {
    const index = this.toolheadSlot ?? this.hubSlot

    return index != null ? this.slotByIndex[index] ?? null : null
  }

  get summary () {
    const slot = this.pathSlot

    return {
      boxSlot: slot,
      loaded: slot != null && slot.index === this.loadedSlot,
      tools: slot ? this.toolsBySlot[slot.index] ?? [] : [],
      busy: this.busy,
      step: this.step
    }
  }

  get hubLabel (): string {
    const hub = this.$t('app.qidi_box.label.hub').toString()

    return this.hubSlot != null ? `${hub} · ${qidiBoxSlotLabel(this.hubSlot)}` : hub
  }

  get nozzleColor (): string | null {
    const slot = this.toolheadSlot != null ? this.slotByIndex[this.toolheadSlot] : null

    return slot ? slot.color ?? '#9e9e9e' : null
  }

  unitProps (box: number) {
    const external = box === 0

    return {
      title: external ? this.$t('app.qidi_box.label.external').toString() : this.$t('app.qidi_box.label.box', { box }).toString(),
      slots: this.slots.filter(slot => external
        ? slot.index === QIDI_BOX_EXTERNAL_SLOT
        : slot.index !== QIDI_BOX_EXTERNAL_SLOT && Math.floor(slot.index / 4) === box - 1),
      climate: external ? null : this.climates[box] ?? null,
      external,
      selected: this.selected,
      loadedSlot: this.loadedSlot,
      toolsBySlot: this.toolsBySlot,
      reloadGroups: this.reloadGroups,
      spoolSize: this.layout.spoolSize
    }
  }

  mounted () {
    this.width = this.$el.clientWidth

    if (typeof ResizeObserver !== 'undefined') {
      this.observer = markRaw(new ResizeObserver(() => {
        this.width = this.$el.clientWidth
        this.scheduleMeasure()
      }))
      this.observer.observe(this.$el)

      const diagram = this.$refs.diagram

      if (diagram instanceof HTMLElement) this.observer.observe(diagram)
    }

    document.fonts?.ready.then(() => this.scheduleMeasure())
    this.scheduleMeasure()
  }

  updated () {
    this.scheduleMeasure()
  }

  beforeDestroy () {
    this.observer?.disconnect()
    cancelAnimationFrame(this.frame)
  }

  scheduleMeasure () {
    if (this.frame) return

    this.frame = requestAnimationFrame(() => {
      this.frame = 0
      this.measure()
    })
  }

  // The connectors follow the laid-out ports, so they are measured after each render rather than computed.
  measure () {
    const diagram = this.$refs.diagram

    if (!(diagram instanceof HTMLElement)) return

    const bounds = diagram.getBoundingClientRect()

    if (bounds.width === 0) return

    const ports = new Map<string, [number, number]>()

    for (const element of Array.from(diagram.querySelectorAll<HTMLElement>('[data-port]'))) {
      const rect = element.getBoundingClientRect()

      ports.set(element.dataset.port ?? '', [
        rect.left + rect.width / 2 - bounds.left,
        rect.top + rect.height / 2 - bounds.top
      ])
    }

    const dark = this.$vuetify.theme.dark
    const paths: FlowPath[] = []

    for (const connection of qidiBoxFlowConnections(this.hubSlot, this.toolheadSlot, this.layout.compact)) {
      const points = connection.via.flatMap(port => {
        const point = ports.get(port)

        return point ? [point] : []
      })

      if (points.length < 2) continue

      const slot = connection.slot != null ? this.slotByIndex[connection.slot] : null
      const color = slot ? slot.color ?? '#9e9e9e' : null

      paths.push({
        key: connection.key,
        d: qidiBoxFlowPath(points, connection.dir),
        slot: connection.slot,
        color,
        contrast: color != null && qidiColorNearBackground(color, dark)
      })
    }

    const key = JSON.stringify([bounds.width, bounds.height, paths])

    if (key === this.pathsKey) return

    this.pathsKey = key
    this.svgWidth = Math.ceil(bounds.width)
    this.svgHeight = Math.ceil(bounds.height)
    this.paths = paths
  }
}
</script>

<style lang="scss" scoped>
.qidi-box-flow__summary {
  background: var(--qidi-box-tint);
}

.qidi-box-flow__diagram {
  position: relative;
}

.qidi-box-flow__strands {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}

.qidi-box-flow__diagram > :not(.qidi-box-flow__strands) {
  position: relative;
}

.qidi-box-flow__guide {
  fill: none;
  stroke: var(--qidi-box-track);
  stroke-width: 2;
}

.qidi-box-flow__strand-edge {
  fill: none;
  stroke: var(--qidi-box-edge);
  stroke-width: 6.5;
  stroke-linecap: round;
}

.qidi-box-flow__strand-edge--contrast {
  stroke: var(--qidi-box-contrast);
  stroke-width: 7.5;
}

.qidi-box-flow__strand {
  fill: none;
  stroke-width: 4;
  stroke-linecap: round;
}

.qidi-box-flow__tier {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px 10px;
}

.qidi-box-flow__rail {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 14px 28px;
  padding: 40px 0;
}

.qidi-box-flow__rail--first {
  padding: 4px 0 16px;
}

.qidi-box-flow__rail--last {
  padding-bottom: 4px;
}

.qidi-box-flow__path {
  display: flex;
  flex: none;
  align-items: flex-start;
}

.qidi-box-flow__node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 11px;
  width: 64px;
  opacity: 0.6;
}

.qidi-box-flow__node--on {
  opacity: 1;
}

.qidi-box-flow__node small {
  padding: 0 3px;
  border-radius: 3px;
  background: var(--qidi-box-surface);
  font-size: 11px;
  white-space: nowrap;
}

.qidi-box-flow__sensor {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--qidi-box-surface);
  box-shadow: inset 0 0 0 2px var(--qidi-box-muted);
}

.qidi-box-flow__node--on .qidi-box-flow__sensor {
  background: #4caf50;
  box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.25);
}

.qidi-box-flow__extruder {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  background: var(--qidi-box-surface);
  box-shadow: inset 0 0 0 1.5px var(--qidi-box-muted);
}

// The heater block's centre lines up with the sensors; the heat break and tip overhang.
.qidi-box-flow__nozzle {
  position: relative;
  width: 24px;
  height: 14px;

  svg {
    position: absolute;
    top: -8px;
    left: 0;
  }
}

.qidi-box-flow__ptfe {
  display: flex;
  justify-content: center;
  width: 30px;

  small {
    margin-top: -12px;
    font-size: 9px;
    letter-spacing: 0.08em;
    opacity: 0.6;
  }
}

.qidi-box-flow__inline-summary {
  flex: 0 1 280px;
}
</style>
