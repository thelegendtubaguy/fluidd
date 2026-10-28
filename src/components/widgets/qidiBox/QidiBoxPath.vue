<template>
  <!-- Filament path for one slot. Each sensor lights, and the strand reaches it, only when it sees this slot's
       filament: the inlet when filament is in the slot, then the hub, then the toolhead. -->
  <svg
    viewBox="0 0 240 290"
    width="100%"
    class="qidi-box-path"
  >
    <rect
      x="4"
      y="14"
      width="232"
      height="84"
      rx="10"
      :fill="zone"
    />
    <text
      x="14"
      y="32"
      font-size="12"
      fill="currentColor"
      opacity="0.7"
    >{{ external ? $t('app.qidi_box.label.external') : $t('app.qidi_box.label.slot', { slot: boxSlot.label }) }}</text>
    <text
      x="108"
      y="132"
      font-size="12"
      fill="currentColor"
      opacity="0.6"
    >PTFE</text>
    <rect
      x="4"
      y="160"
      width="232"
      height="86"
      rx="10"
      :fill="zone"
    />
    <text
      x="14"
      y="178"
      font-size="12"
      fill="currentColor"
      opacity="0.7"
    >{{ $t('app.qidi_box.label.toolhead') }}</text>
    <path
      d="M66 14v248l6 6h2l6-6V14"
      fill="none"
      :stroke="outline"
    />
    <rect
      v-if="reach"
      x="67"
      y="14"
      width="12"
      :height="reach - 14"
      :fill="strand"
    />
    <polygon
      v-if="atToolhead"
      points="67,262 79,262 74,268 72,268"
      :fill="strand"
    />
    <template v-for="sensor in sensors">
      <circle
        :key="`${sensor.y}-dot`"
        cx="92"
        :cy="sensor.y"
        r="7"
        :fill="sensor.on ? '#4caf50' : 'rgba(128,128,128,0.35)'"
        :stroke="outline"
      />
      <text
        :key="`${sensor.y}-label`"
        x="108"
        :y="sensor.y + 5"
        font-size="13"
        fill="currentColor"
      >{{ sensor.label }}</text>
    </template>
    <circle
      cx="54"
      cy="228"
      r="9"
      fill="rgba(128,128,128,0.6)"
    />
    <circle
      cx="92"
      cy="228"
      r="9"
      fill="rgba(128,128,128,0.6)"
    />
    <text
      x="108"
      y="233"
      font-size="13"
      fill="currentColor"
    >{{ $t('app.qidi_box.label.extruder') }}</text>
    <text
      x="108"
      y="271"
      font-size="13"
      fill="currentColor"
    >{{ $t('app.qidi_box.label.nozzle') }}</text>
  </svg>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'
import { QIDI_BOX_EXTERNAL_SLOT, type QidiBoxSlot } from '@/util/qidi-box'

@Component({})
export default class QidiBoxPath extends Vue {
  @Prop({ type: Object, required: true })
  readonly boxSlot!: QidiBoxSlot

  @Prop({ type: Boolean })
  readonly atHub!: boolean

  @Prop({ type: Boolean })
  readonly atToolhead!: boolean

  readonly outline = 'rgba(128,128,128,0.8)'

  get external () {
    return this.boxSlot.index === QIDI_BOX_EXTERNAL_SLOT
  }

  get zone () {
    return this.$vuetify.theme.dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'
  }

  get strand () {
    return this.boxSlot.color ?? '#9e9e9e'
  }

  get reach () {
    if (this.atToolhead) return 262
    if (this.atHub) return 150

    return this.boxSlot.present && !this.external ? 54 : 0
  }

  get sensors () {
    return [
      ...(this.external
        ? []
        : [
            { y: 46, label: this.$t('app.qidi_box.label.slot_inlet'), on: this.boxSlot.present },
            { y: 78, label: this.$t('app.qidi_box.label.hub'), on: this.atHub }
          ]),
      { y: 196, label: this.$t('app.qidi_box.label.toolhead_sensor'), on: this.atToolhead }
    ]
  }
}
</script>

<style scoped>
.qidi-box-path {
  max-width: 260px;
}
</style>
