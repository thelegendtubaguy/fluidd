<template>
  <!-- One Box, or the external spool: a header with the Box's climate, then a spool per slot with its tools above
       and its inlet sensor on the frame edge facing the filament path. Below the path the unit is mirrored. -->
  <div
    class="qidi-box-unit"
    :class="{ 'qidi-box-unit--below': below, 'qidi-box-unit--external': external }"
  >
    <div class="qidi-box-unit__head">
      <span class="qidi-box-unit__title">{{ title }}</span>
      <template v-if="climate">
        <span
          v-if="climate.humidity != null"
          class="qidi-box-unit__climate"
          :title="humidityLevel(climate.humidity).label"
        >
          <v-icon
            small
            :color="humidityLevel(climate.humidity).color"
          >
            $qidiBoxHumidity
          </v-icon>
          {{ climate.humidity }}%
        </span>
        <span
          v-if="climate.temperature != null"
          class="qidi-box-unit__climate"
        >
          <v-icon
            small
            class="deep-orange--text text--lighten-2"
          >
            $thermometer
          </v-icon>
          {{ climate.temperature }}°C
        </span>
        <span
          v-if="climate.target != null"
          class="qidi-box-unit__climate"
        >
          <v-icon
            small
            class="red--text"
          >
            $fire
          </v-icon>
          {{ climate.target }}°C
        </span>
      </template>
    </div>

    <div class="qidi-box-unit__slots">
      <div
        v-for="slot in slots"
        :key="slot.index"
        class="qidi-box-unit__slot"
        :class="{ 'qidi-box-unit__slot--loaded': slot.index === loadedSlot }"
        :style="{ width: `${columnWidth}px` }"
        role="button"
        tabindex="0"
        :aria-pressed="slot.index === selected ? 'true' : 'false'"
        :title="slotTitle(slot)"
        @click="$emit('select', slot.index)"
        @keydown.enter.space.prevent="$emit('select', slot.index)"
      >
        <span class="qidi-box-unit__tools">
          <button
            v-for="tool in toolsBySlot[slot.index] || []"
            :key="tool"
            type="button"
            class="qidi-box-unit__tool"
            :class="{ 'qidi-box-unit__tool--loaded': slot.index === loadedSlot }"
            :title="`${tool} → ${slot.label}`"
            @click.stop="$emit('tool-click', { tool: Number(tool.slice(1)), slot: slot.index })"
          >
            {{ tool }}
          </button>
        </span>
        <span
          v-if="!labelInHole"
          class="qidi-box-unit__label"
        >
          {{ slot.label }}
        </span>
        <qidi-box-spool
          :box-slot="slot"
          :size="spoolSize"
          :label="labelInHole ? slot.label : ''"
          :loaded="slot.index === loadedSlot"
          :selected="slot.index === selected"
          :reload-group="reloadGroups[slot.index] || null"
        />
        <span
          class="qidi-box-unit__inlet"
          :class="{
            'qidi-box-unit__inlet--present': slot.present,
            'qidi-box-unit__inlet--hidden': external
          }"
          :data-port="external ? 'ext' : `inlet:${slot.index}`"
          :title="external ? undefined : $t('app.qidi_box.label.slot_inlet').toString()"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'
import type { QidiBoxClimate, QidiBoxReloadGroups, QidiBoxSlot } from '@/util/qidi-box'
import { qidiBoxFlowColumnWidth } from '@/util/qidi-box-flow'
import QidiBoxSpool from './QidiBoxSpool.vue'

@Component({
  components: {
    QidiBoxSpool
  }
})
export default class QidiBoxUnit extends Vue {
  @Prop({ type: String, required: true })
  readonly title!: string

  @Prop({ type: Array, required: true })
  readonly slots!: QidiBoxSlot[]

  @Prop({ type: Number, required: true })
  readonly selected!: number

  @Prop({ type: Number, default: null })
  readonly loadedSlot!: number | null

  @Prop({ type: Object, required: true })
  readonly toolsBySlot!: Record<number, string[]>

  @Prop({ type: Object, required: true })
  readonly reloadGroups!: QidiBoxReloadGroups

  @Prop({ type: Object, default: null })
  readonly climate!: QidiBoxClimate | null

  @Prop({ type: Number, default: 44 })
  readonly spoolSize!: number

  // Below the filament path: header at the bottom, inlets on the top edge.
  @Prop({ type: Boolean })
  readonly below!: boolean

  @Prop({ type: Boolean })
  readonly external!: boolean

  get columnWidth (): number {
    return qidiBoxFlowColumnWidth(this.spoolSize)
  }

  // Small spools put the label above instead.
  get labelInHole (): boolean {
    return this.spoolSize >= 40
  }

  slotTitle (slot: QidiBoxSlot): string {
    return slot.present
      ? [slot.label, slot.vendor, slot.name].filter(Boolean).join(' · ')
      : `${slot.label} · ${this.$t('app.qidi_box.label.empty')}`
  }

  // QIDI's Box humidity guide: below 40 %RH is normal, below 60 %RH slightly high, and above that high.
  humidityLevel (humidity: number) {
    if (humidity < 40) return { color: 'blue lighten-2', label: this.$t('app.qidi_box.humidity.normal').toString() }
    if (humidity < 60) return { color: '#5475FF', label: this.$t('app.qidi_box.humidity.high').toString() }

    return { color: '#FF4D4D', label: this.$t('app.qidi_box.humidity.over_high').toString() }
  }
}
</script>

<style lang="scss" scoped>
.qidi-box-unit {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 8px;
  border-radius: 12px;
  box-shadow: inset 0 0 0 1px var(--qidi-box-line);
}

.qidi-box-unit--below {
  flex-direction: column-reverse;
}

.qidi-box-unit--external {
  min-width: 80px;
}

.qidi-box-unit__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 8px;
  padding: 0 4px 6px;
  font-size: 12px;
}

.qidi-box-unit--below .qidi-box-unit__head {
  padding: 6px 4px 0;
}

.qidi-box-unit__title {
  margin-right: auto;
  font-size: 13px;
  font-weight: 500;
}

.qidi-box-unit__climate {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  white-space: nowrap;
  opacity: 0.8;
}

.qidi-box-unit__slots {
  display: flex;
  justify-content: space-around;
  gap: 4px;
}

.qidi-box-unit__slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding-top: 4px;
  border-radius: 8px;
  cursor: pointer;
  outline: none;
}

.qidi-box-unit--below .qidi-box-unit__slot {
  flex-direction: column-reverse;
  padding: 0 0 4px;
}

.qidi-box-unit__slot:hover,
.qidi-box-unit__slot:focus-visible {
  background: var(--qidi-box-tint);
}

.qidi-box-unit__tools {
  display: flex;
  justify-content: center;
  gap: 2px;
  height: 16px;
  white-space: nowrap;
}

.qidi-box-unit__tool {
  height: 16px;
  padding: 0 3px;
  border-radius: 4px;
  background: var(--qidi-box-tint);
  color: inherit;
  font-size: 9.5px;
  font-weight: 600;
  line-height: 16px;
  opacity: 0.8;
}

.qidi-box-unit__tool--loaded {
  background: var(--v-primary-base);
  color: #fff;
  opacity: 1;
}

.qidi-box-unit__label {
  font-size: 11px;
  font-weight: 700;
}

.qidi-box-unit__slot--loaded .qidi-box-unit__label {
  color: var(--v-primary-base);
}

// The inlet sensor sits centred on the frame edge: it overhangs the column by the frame padding plus half its size.
.qidi-box-unit__inlet {
  flex: none;
  width: 9px;
  height: 9px;
  margin: 2px 0 -13px;
  border-radius: 50%;
  background: var(--qidi-box-surface);
  box-shadow: inset 0 0 0 1.5px var(--qidi-box-muted);
}

.qidi-box-unit--below .qidi-box-unit__inlet {
  margin: -13px 0 2px;
}

.qidi-box-unit__inlet--present {
  background: var(--qidi-box-muted);
  box-shadow: none;
}

.qidi-box-unit__inlet--hidden {
  visibility: hidden;
}
</style>
