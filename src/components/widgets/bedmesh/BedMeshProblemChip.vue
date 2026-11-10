<template>
  <span class="bed-mesh-problem-chip">
    <v-icon
      small
      :color="warningColor"
      class="me-1"
    >
      $warning
    </v-icon>
    {{ $tc('app.bed_soak.label.problem_points_count', count, { count }) }}
  </span>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'
import { BedSoakColors } from '@/util/tltg-bed-soak'

@Component({})
export default class BedMeshProblemChip extends Vue {
  @Prop({ type: Number, required: true })
  readonly count!: number

  readonly warningColor = BedSoakColors.warning
}
</script>

<style lang="scss" scoped>
  .bed-mesh-problem-chip {
    display: inline-flex;
    align-items: center;
    border-radius: 12px;
    padding: 2px 10px 2px 6px;
    font-size: 0.8125rem;
    font-weight: 400;
    white-space: nowrap;
    background: rgba(250, 178, 25, 0.14);
  }
</style>
