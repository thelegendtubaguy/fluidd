<template>
  <div class="qidi-box-unit rounded-lg pa-2 pb-1">
    <div class="d-flex qidi-box-unit__slots">
      <div
        v-for="slot in slots"
        :key="slot.index"
        class="qidi-box-unit__slot d-flex flex-column align-center rounded py-1"
        :class="{ 'qidi-box-unit__slot--selected': slot.index === selected }"
        :title="slotTitle(slot)"
        @click="$emit('select', slot.index)"
      >
        <div
          class="text-caption font-weight-bold text-truncate px-1 qidi-box-unit__tools"
          :class="slot.index === loadedSlot ? 'primary white--text rounded-pill' : 'text--secondary'"
        >
          {{ (toolsBySlot[slot.index] || []).join(' ') }}
        </div>

        <svg
          width="52"
          height="72"
          viewBox="0 0 52 72"
          :class="{ 'qidi-box-unit__spool--loaded': slot.index === loadedSlot }"
        >
          <rect
            x="10"
            y="8"
            width="32"
            height="56"
            rx="3"
            :fill="slot.present && slot.color ? slot.color : 'none'"
            :stroke="slot.present ? 'rgba(0,0,0,0.35)' : 'rgba(128,128,128,0.7)'"
            :stroke-dasharray="slot.present ? undefined : '3 3'"
          />
          <rect
            v-if="slot.present"
            x="11"
            y="9"
            width="10"
            height="54"
            fill="#fff"
            opacity="0.15"
          />
          <rect
            x="22"
            y="9"
            width="8"
            height="54"
            fill="rgba(0,0,0,0.18)"
          />
          <rect
            x="4"
            y="2"
            width="44"
            height="7"
            rx="3"
            fill="#8d8d93"
          />
          <rect
            x="4"
            y="63"
            width="44"
            height="7"
            rx="3"
            fill="#8d8d93"
          />
        </svg>

        <!-- Slot tile: green border with filament at the inlet, dashed amber while reading RFID, and an outline
             in its auto-reload group's filament color, edged so dark and light filaments stay visible. -->
        <svg
          width="52"
          height="26"
          viewBox="0 0 120 60"
        >
          <template v-if="reloadGroups[slot.index]">
            <rect
              x="3"
              y="1"
              width="114"
              height="58"
              rx="15"
              fill="none"
              stroke="rgba(128,128,128,0.9)"
              stroke-width="8"
            />
            <rect
              x="3"
              y="1"
              width="114"
              height="58"
              rx="15"
              fill="none"
              :stroke="reloadGroups[slot.index].color || 'transparent'"
              stroke-width="5"
            />
          </template>
          <rect
            x="12"
            y="8"
            width="96"
            height="44"
            rx="10"
            stroke-width="5"
            :fill="slot.present && slot.color ? slot.color : 'rgba(128,128,128,0.15)'"
            :stroke="slot.reading ? '#ffb300' : slot.present ? '#4caf50' : '#757575'"
            :stroke-dasharray="slot.reading ? '14 8' : undefined"
          />
          <text
            x="60"
            y="41"
            text-anchor="middle"
            font-weight="700"
            font-size="26"
            :fill="slot.present && slot.color ? textColor(slot.color) : 'currentColor'"
          >{{ slot.label }}</text>
        </svg>

        <div
          class="text-caption font-weight-bold d-flex align-center justify-center rounded-pill px-2 mt-1 qidi-box-unit__reload"
          :style="reloadStyle(slot.index)"
          :title="reloadTitle(slot.index)"
        >
          <template v-if="reloadGroups[slot.index]">
            <v-icon
              x-small
              class="mr-1"
              :style="{ color: 'inherit' }"
            >
              $sync
            </v-icon>
            {{ reloadGroups[slot.index].letter }}
          </template>
        </div>
      </div>
    </div>

    <div class="d-flex align-center text-caption text--secondary mt-1 pt-1 px-1 qidi-box-unit__footer">
      <span class="font-weight-medium text--primary">{{ title }}</span>
      <template v-if="climate">
        <span
          v-if="climate.humidity != null"
          class="d-inline-flex align-center"
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
          class="d-inline-flex align-center"
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
          class="d-inline-flex align-center ml-auto"
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
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'
import { qidiBoxSlotLabel, qidiTextColor, type QidiBoxSlot } from '@/util/qidi-box'

export type QidiBoxReloadGroups = Record<number, { letter: string, color: string | null, members: number[] }>

export interface QidiBoxClimate {
  humidity: number | null;
  temperature: number | null;
  target: number | null;
}

@Component({})
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

  textColor (color: string | null) {
    return qidiTextColor(color)
  }

  slotTitle (slot: QidiBoxSlot): string {
    return slot.present
      ? [slot.label, slot.vendor, slot.name].filter(Boolean).join(' · ')
      : `${slot.label} · ${this.$t('app.qidi_box.label.empty')}`
  }

  reloadStyle (index: number): Record<string, string> {
    const group = this.reloadGroups[index]

    return group
      ? { visibility: 'visible', background: group.color ?? 'transparent', color: qidiTextColor(group.color), border: '1px solid rgba(128,128,128,0.9)' }
      : { visibility: 'hidden' }
  }

  reloadTitle (index: number): string | undefined {
    const group = this.reloadGroups[index]

    return group
      ? this.$t('app.qidi_box.msg.reload_group', { group: group.letter, slots: group.members.map(qidiBoxSlotLabel).join(', ') }).toString()
      : undefined
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
  background: rgba(128, 128, 128, 0.08);
}

.qidi-box-unit__slots {
  gap: 4px;
}

.qidi-box-unit__slot {
  width: 60px;
  cursor: pointer;
}

.qidi-box-unit__slot--selected {
  background: rgba(33, 150, 243, 0.15);
  outline: 1px solid rgba(33, 150, 243, 0.55);
}

.qidi-box-unit__tools {
  min-height: 18px;
  max-width: 58px;
}

.qidi-box-unit__spool--loaded {
  transform: translateY(-3px);
  filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.35));
}

.qidi-box-unit__reload {
  height: 16px;
}

.qidi-box-unit__footer {
  gap: 8px;
  border-top: 1px solid rgba(128, 128, 128, 0.3);
}
</style>
