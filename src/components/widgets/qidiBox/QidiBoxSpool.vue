<template>
  <!-- A slot's spool: a ring in the filament color, the label in its hole. The hole turns primary when the slot is
       loaded, a dashed amber ring spins while the Box reads its RFID, and an empty slot is a dashed, hatched ring. -->
  <span
    class="qidi-box-spool"
    :class="classes"
    :style="{ width: `${size}px`, height: `${size}px`, background: boxSlot.present ? (boxSlot.color || '#9e9e9e') : undefined }"
    :data-port="port"
  >
    <span
      v-if="boxSlot.reading"
      class="qidi-box-spool__rfid"
    />
    <span
      v-if="reloadGroup"
      class="qidi-box-spool__reload"
      :style="{ background: reloadGroup.color || 'transparent', color: reloadTextColor }"
      :title="reloadTitle"
    >
      {{ reloadGroup.letter }}
    </span>
    <span
      class="qidi-box-spool__hole"
      :class="{ 'qidi-box-spool__hole--loaded': loaded }"
      :style="{ width: `${hole}px`, height: `${hole}px`, fontSize: `${Math.round(hole * 0.42)}px` }"
    >
      {{ label }}
    </span>
  </span>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'
import {
  qidiBoxSlotLabel,
  qidiColorNearBackground,
  qidiTextColor,
  type QidiBoxReloadGroup,
  type QidiBoxSlot
} from '@/util/qidi-box'

@Component({})
export default class QidiBoxSpool extends Vue {
  @Prop({ type: Object, required: true })
  readonly boxSlot!: QidiBoxSlot

  @Prop({ type: Number, default: 44 })
  readonly size!: number

  // The hole's share of the spool's diameter.
  @Prop({ type: Number, default: 0.52 })
  readonly holeRatio!: number

  @Prop({ type: String, default: '' })
  readonly label!: string

  @Prop({ type: Boolean })
  readonly loaded!: boolean

  @Prop({ type: Boolean })
  readonly selected!: boolean

  @Prop({ type: Object, default: null })
  readonly reloadGroup!: QidiBoxReloadGroup | null

  @Prop({ type: String })
  readonly port?: string

  get hole (): number {
    return Math.round(this.size * this.holeRatio)
  }

  get classes () {
    return {
      'qidi-box-spool--empty': !this.boxSlot.present,
      'qidi-box-spool--contrast': this.boxSlot.present && qidiColorNearBackground(this.boxSlot.color, this.$vuetify.theme.dark),
      'qidi-box-spool--selected': this.selected
    }
  }

  get reloadTextColor (): string {
    return qidiTextColor(this.reloadGroup?.color ?? null)
  }

  get reloadTitle (): string | undefined {
    const group = this.reloadGroup

    return group
      ? this.$t('app.qidi_box.msg.reload_group', { group: group.letter, slots: group.members.map(qidiBoxSlotLabel).join(', ') }).toString()
      : undefined
  }
}
</script>

<style lang="scss" scoped>
.qidi-box-spool {
  position: relative;
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px var(--qidi-box-edge);
}

.qidi-box-spool--contrast {
  box-shadow: 0 0 0 1.5px var(--qidi-box-contrast);
}

.qidi-box-spool--empty {
  border: 2px dashed var(--qidi-box-muted);
  box-shadow: none;
  background-image: repeating-linear-gradient(135deg, transparent 0 4px, var(--qidi-box-tint) 4px 7px);
}

.qidi-box-spool--selected {
  outline: 2px solid currentColor;
  outline-offset: 3px;
}

.qidi-box-spool__hole {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--qidi-box-surface);
  box-shadow: 0 0 0 1px var(--qidi-box-edge);
  font-weight: 700;
  line-height: 1;
}

.qidi-box-spool--empty .qidi-box-spool__hole {
  box-shadow: none;
  color: var(--qidi-box-muted);
}

// Ringed in the card color, so the primary hole stands out on a spool of a similar color.
.qidi-box-spool__hole--loaded {
  background: var(--v-primary-base);
  box-shadow: 0 0 0 2px var(--qidi-box-surface);
  color: #fff;
}

.qidi-box-spool__rfid {
  position: absolute;
  inset: -5px;
  border: 2px dashed #ffb300;
  border-radius: 50%;
  animation: qidi-box-spool-spin 6s linear infinite;
}

.qidi-box-spool__reload {
  position: absolute;
  top: -4px;
  right: -7px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  box-shadow: 0 0 0 1px var(--qidi-box-edge);
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}

@keyframes qidi-box-spool-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .qidi-box-spool__rfid {
    animation: none;
  }
}
</style>
