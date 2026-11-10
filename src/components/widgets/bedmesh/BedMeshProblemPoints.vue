<template>
  <div class="bed-mesh-problem-points">
    <v-divider class="mb-2" />
    <div class="bed-mesh-problem-points__title">
      <v-icon
        small
        :color="warningColor"
        class="me-1"
      >
        $warning
      </v-icon>
      {{ $t('app.bed_soak.label.problem_points_in_mesh') }}
    </div>
    <div
      v-for="point in points"
      :key="`point:${point.x}:${point.y}`"
      class="bed-mesh-problem-points__point"
    >
      <v-icon
        small
        :color="warningColor"
        class="me-2"
      >
        $warning
      </v-icon>
      <span>
        <b>{{ $t('app.bed_soak.label.point', { x: Math.round(point.x), y: Math.round(point.y) }) }}</b>
        {{ $t('app.bed_soak.msg.retried_point', { tries: point.tries, spread: Math.round(point.spread * 1000) }) }}
      </span>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'
import { BedSoakColors } from '@/util/tltg-bed-soak'

@Component({})
export default class BedMeshProblemPoints extends Vue {
  @Prop({ type: Array, required: true })
  readonly points!: Klipper.TltgProbeReportPoint[]

  readonly warningColor = BedSoakColors.warning
}
</script>

<style lang="scss" scoped>
  .bed-mesh-problem-points__title {
    display: flex;
    align-items: center;
    font-size: 0.75rem;
    font-weight: 500;
    margin-bottom: 4px;
  }

  .bed-mesh-problem-points__point {
    display: flex;
    align-items: flex-start;
    font-size: 0.8125rem;
    margin: 4px 0;
  }
</style>
