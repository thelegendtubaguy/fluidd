<template>
  <!-- Hotend: heat break, heater block (where the strand ends), nozzle nut, and a tip in the loaded filament's
       color. -->
  <svg
    width="24"
    height="31"
    viewBox="0 0 20 26"
    class="qidi-box-nozzle"
    :class="{ 'qidi-box-nozzle--active': color != null }"
  >
    <rect
      x="7.5"
      y="0.75"
      width="5"
      height="6"
      rx="1"
      class="qidi-box-nozzle__break"
    />
    <rect
      x="1.75"
      y="6.75"
      width="16.5"
      height="11"
      rx="2"
      class="qidi-box-nozzle__block"
    />
    <path
      d="M4.5 18.5h11V21h-11Z"
      class="qidi-box-nozzle__nut"
    />
    <path
      d="M6 21h8l-3.3 4.5H9.3Z"
      class="qidi-box-nozzle__tip"
      :style="color != null ? { fill: color } : undefined"
    />
  </svg>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'

@Component({})
export default class QidiBoxNozzle extends Vue {
  @Prop({ type: String, default: null })
  readonly color!: string | null
}
</script>

<style lang="scss" scoped>
.qidi-box-nozzle {
  --qidi-box-nozzle-metal: var(--qidi-box-muted);

  overflow: visible;
}

.qidi-box-nozzle--active {
  --qidi-box-nozzle-metal: var(--qidi-box-contrast);
}

.qidi-box-nozzle__break {
  fill: var(--qidi-box-surface);
  stroke: var(--qidi-box-nozzle-metal);
  stroke-width: 1.5;
}

.qidi-box-nozzle__block {
  fill: var(--qidi-box-block);
  stroke: var(--qidi-box-nozzle-metal);
  stroke-width: 1.5;
}

.qidi-box-nozzle__nut {
  fill: var(--qidi-box-nozzle-metal);
}

.qidi-box-nozzle__tip {
  fill: var(--qidi-box-muted);
}

.qidi-box-nozzle--active .qidi-box-nozzle__tip {
  stroke: var(--qidi-box-edge);
  stroke-width: 1;
}
</style>
