<template>
  <!-- The filament in the path: at the toolhead, or parked at the hub. -->
  <div class="d-flex align-center qidi-box-loaded-summary">
    <qidi-box-spool
      v-if="boxSlot"
      :box-slot="boxSlot"
      :size="size"
      :hole-ratio="0.4"
      :loaded="loaded"
    />
    <span
      v-else
      class="d-inline-flex align-center justify-center qidi-box-loaded-summary__none"
      :style="{ width: `${size}px`, height: `${size}px` }"
    >
      <v-icon :small="size < 48">
        {{ busy ? '$sync' : '$qidiBox' }}
      </v-icon>
    </span>

    <div class="qidi-box-loaded-summary__text">
      <div class="text-overline text--secondary text-truncate qidi-box-loaded-summary__overline">
        {{ overline }}
      </div>
      <div
        class="text-truncate font-weight-medium"
        :class="large ? 'text-h6' : 'text-subtitle-1'"
      >
        {{ title }}
      </div>
      <div
        v-if="subtitle"
        class="text-caption text--secondary text-truncate"
      >
        {{ subtitle }}
      </div>
      <v-progress-linear
        v-if="busy"
        indeterminate
        rounded
        height="3"
        class="mt-2"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'
import type { QidiBoxSlot } from '@/util/qidi-box'
import QidiBoxSpool from './QidiBoxSpool.vue'

@Component({
  components: {
    QidiBoxSpool
  }
})
export default class QidiBoxLoadedSummary extends Vue {
  @Prop({ type: Object, default: null })
  readonly boxSlot!: QidiBoxSlot | null

  // Loaded to the toolhead, rather than parked at the hub.
  @Prop({ type: Boolean })
  readonly loaded!: boolean

  @Prop({ type: Array, default: () => [] })
  readonly tools!: string[]

  @Prop({ type: Boolean })
  readonly busy!: boolean

  @Prop({ type: String, default: null })
  readonly step!: string | null

  @Prop({ type: Number, default: 52 })
  readonly size!: number

  @Prop({ type: Boolean })
  readonly large!: boolean

  get filamentName (): string {
    const slot = this.boxSlot

    if (!slot) return ''
    if (!slot.present) return this.$t('app.qidi_box.label.empty').toString()

    return slot.name ?? this.$t('app.qidi_box.label.unknown_filament').toString()
  }

  get overline (): string {
    if (this.busy) return this.$t('app.qidi_box.msg.box_busy').toString()

    const slot = this.boxSlot

    if (!slot) return this.$t('app.qidi_box.label.toolhead').toString()

    const where = this.loaded
      ? this.$t('app.qidi_box.msg.loaded', { slot: slot.label })
      : this.$t('app.qidi_box.msg.at_hub', { slot: slot.label })

    return [where, this.tools.join(', ')].filter(Boolean).join(' · ')
  }

  get title (): string {
    if (this.busy) return this.step ?? this.$t('app.qidi_box.msg.box_busy').toString()
    if (!this.boxSlot) return this.$t('app.qidi_box.msg.no_filament_loaded').toString()

    return this.filamentName
  }

  get subtitle (): string {
    const slot = this.boxSlot

    if (!slot) return ''
    if (this.busy) return `${slot.label} · ${this.filamentName}`

    return slot.present ? [slot.vendor, slot.type].filter(Boolean).join(' · ') : ''
  }
}
</script>

<style lang="scss" scoped>
.qidi-box-loaded-summary {
  gap: 12px;
  min-width: 0;
}

.qidi-box-loaded-summary__text {
  flex: 1 1 auto;
  min-width: 0;
}

.qidi-box-loaded-summary__overline {
  line-height: 1.6;
}

.qidi-box-loaded-summary__none {
  flex: none;
  border-radius: 50%;
  box-shadow: inset 0 0 0 2px var(--qidi-box-muted);
}
</style>
