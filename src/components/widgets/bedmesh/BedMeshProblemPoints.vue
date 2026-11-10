<template>
  <v-alert
    type="warning"
    text
    dense
    class="mb-0"
  >
    {{ $tc('app.bed_soak.msg.mesh_problem_points', points.length, { points: list }) }}
  </v-alert>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'

@Component({})
export default class BedMeshProblemPoints extends Vue {
  @Prop({ type: Array, required: true })
  readonly points!: Klipper.TltgProbeReportPoint[]

  get list (): string {
    return this.points
      .map(point => this.$t('app.bed_soak.label.point_retried', {
        point: this.$t('app.bed_soak.label.point', { x: Math.round(point.x), y: Math.round(point.y) }),
        tries: point.tries,
        spread: Math.round(point.spread * 1000)
      }).toString())
      .join(', ')
  }
}
</script>
