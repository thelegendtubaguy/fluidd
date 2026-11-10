<template>
  <collapsable-card
    class="bed-mesh-card"
    :title="$t('app.general.title.bedmesh')"
    :lazy="false"
    icon="$bedMesh"
    :draggable="!fullscreen"
    :collapsable="!fullscreen"
    layout-path="dashboard.bed-mesh-card"
  >
    <template #menu>
      <bed-mesh-problem-chip
        v-if="!preview && problemPoints.length > 0"
        :count="problemPoints.length"
        class="me-2"
      />

      <app-btn
        v-if="!fullscreen"
        small
        class="me-1 my-1"
        :loading="hasWait($waits.onMeshCalibrate)"
        :disabled="printerBusy || !allHomed"
        @click="calibrate()"
      >
        {{ $t('app.general.btn.calibrate') }}
      </app-btn>

      <v-tooltip bottom>
        <template #activator="{ on, attrs }">
          <app-btn
            v-bind="attrs"
            icon
            :disabled="!hasMeshLoaded"
            v-on="on"
            @click="downloadImage()"
          >
            <v-icon dense>
              $screenshot
            </v-icon>
          </app-btn>
        </template>
        <span>{{ $t('app.bedmesh.tooltip.download_image') }}</span>
      </v-tooltip>

      <app-btn
        v-if="!fullscreen"
        icon
        @click="$filters.routeTo({ name: 'tune' })"
      >
        <v-icon dense>
          $fullScreen
        </v-icon>
      </app-btn>
    </template>

    <v-card-text>
      <div
        v-if="preview"
        class="d-flex flex-wrap align-center mb-2"
      >
        <span class="me-2">{{ $t('app.bed_soak.msg.showing_in_bed_mesh', { title: preview.title }) }}</span>
        <v-spacer />
        <app-btn
          small
          @click="clearPreview"
        >
          {{ $t('app.bed_soak.btn.show_loaded_mesh') }}
        </app-btn>
      </div>

      <bed-mesh-chart
        v-if="hasMeshLoaded"
        ref="chart"
        :options="options"
        :data="series"
        :graphics="graphics"
        :height="(isMobileViewport) ? 225 : 525"
      />

      <span v-else>{{ $t('app.bedmesh.msg.not_loaded') }}</span>

      <bed-mesh-problem-points
        v-if="!preview && hasMeshLoaded && problemPoints.length > 0"
        :points="problemPoints"
        class="mt-2"
      />
    </v-card-text>
  </collapsable-card>
</template>

<script lang="ts">
import { Component, Mixins, Prop, Ref } from 'vue-property-decorator'
import BedMeshChart from './BedMeshChart.vue'
import BedMeshProblemChip from './BedMeshProblemChip.vue'
import BedMeshProblemPoints from './BedMeshProblemPoints.vue'
import StateMixin from '@/mixins/state'
import ToolheadMixin from '@/mixins/toolhead'
import BrowserMixin from '@/mixins/browser'
import type { AppMeshes, MatrixType, MeshMarker, MeshPreview } from '@/store/mesh/types'
import { BedSoakColors } from '@/util/tltg-bed-soak'

@Component({
  components: {
    BedMeshChart,
    BedMeshProblemChip,
    BedMeshProblemPoints
  }
})
export default class BedMeshCard extends Mixins(StateMixin, ToolheadMixin, BrowserMixin) {
  @Prop({ type: Boolean })
  readonly fullscreen?: boolean

  @Ref('chart')
  readonly bedMeshChart!: BedMeshChart

  get hasMeshLoaded () {
    const mesh = this.mesh
    const matrix = this.matrix

    return mesh && mesh[matrix] && mesh[matrix].coordinates && mesh[matrix].coordinates.length > 0
  }

  // These define the visualMap scaling and the 3d box scaling.
  get zScale () {
    const { min, max, mid } = this.mesh[this.matrix]

    // A bed soak change map is centred on no change
    if (this.preview) {
      const extent = Math.max(Math.abs(min), Math.abs(max), 0.005)
      const box = Math.ceil(extent * 2 * 100) / 100

      return { zMin: -extent, zMax: extent, zBoxMin: -box, zBoxMax: box }
    }

    const map_scale = this.scale / 2
    const box_scale = this.boxScale / 2

    let zMin = -Math.abs(map_scale - min)
    let zMax = map_scale + max
    if (this.scale === 0) {
      // Applies the scale based on the min and max of the mesh.
      zMin = min
      zMax = max
    }

    return {
      zMin,
      zMax,
      zBoxMin: -Math.abs(mid - box_scale),
      zBoxMax: mid + box_scale
    }
  }

  get options () {
    const { zMin, zMax, zBoxMin, zBoxMax } = this.zScale

    const legends = this.series.reduce((obj, series) => {
      return Object.assign(
        obj,
        {
          [series.name]: (
            !series.name.endsWith('_flat') ||
            (
              this.flatSurface &&
              series.name.startsWith(this.matrix)
            )
          )
        }
      )
    }, Object.assign({}))

    const opts = {
      legend: {
        show: false,
        selected: legends
      },
      visualMap: {
        min: zMin,
        max: zMax,
        dimension: 2,
        seriesIndex: 0
      },
      zAxis3D: {
        min: zBoxMin,
        max: zBoxMax
      }
    }
    return opts
  }

  get series () {
    const matrix = this.matrix
    const wireframe = this.wireframe
    const series = [
      {
        type: 'surface',
        name: matrix,
        shading: 'color',
        wireframe: {
          show: wireframe
        },
        data: this.mesh[matrix].coordinates,
        dataShape: this.mesh[matrix].dimensions
      },
      this.createFlatSeries('probed_matrix_flat'),
      this.createFlatSeries('mesh_matrix_flat'),
      ...this.createMarkerSeries()
    ]
    return series
  }

  get preview (): MeshPreview | null {
    return this.$typedState.mesh.preview
  }

  get problemPoints (): Klipper.TltgProbeReportPoint[] {
    return this.$typedGetters['printer/getTltgProbeReportPoints']
  }

  // Points marked on the surface: the preview's, or else the loaded mesh's retried probe points
  get markers (): MeshMarker[] {
    if (this.preview) return this.preview.markers

    return this.problemPoints.map(point => ({
      x: point.x,
      y: point.y,
      label: this.$t('app.bed_soak.label.point_tries', {
        point: this.$t('app.bed_soak.label.point', { x: Math.round(point.x), y: Math.round(point.y) }),
        tries: point.tries
      }).toString()
    }))
  }

  createMarkerSeries () {
    const { coordinates } = this.mesh[this.matrix]

    if (this.markers.length === 0 || coordinates.length === 0) return []

    // Raised above the surface so it isn't hidden in it
    const { zBoxMin, zBoxMax } = this.zScale
    const lift = (zBoxMax - zBoxMin) * 0.06

    const data = this.markers.map(marker => {
      // The surface's height at the marker's nearest mesh point
      const nearest = coordinates.reduce((best, coordinate) => (
        Math.hypot(coordinate.value[0] - marker.x, coordinate.value[1] - marker.y) <
        Math.hypot(best.value[0] - marker.x, best.value[1] - marker.y)
          ? coordinate
          : best
      ))

      return {
        name: marker.label,
        value: [marker.x, marker.y, nearest.value[2] + lift]
      }
    })

    return [{
      type: 'scatter3D',
      name: 'problem_points',
      symbol: 'pin',
      symbolSize: 30,
      itemStyle: {
        color: BedSoakColors.warning,
        opacity: 1,
        borderColor: '#0b0b0b',
        borderWidth: 1
      },
      tooltip: {
        formatter: (params: { name: string }) => params.name
      },
      data
    }]
  }

  clearPreview () {
    this.$typedDispatch('mesh/onPreview', null)
  }

  get graphics () {
    const { range } = this.mesh[this.matrix]

    return [{
      type: 'text',
      right: 10,
      top: 0,
      z: 100,
      silent: true,
      style: {
        text: `${this.$t('app.general.label.range')}: ${range.toFixed(4)}`
      }
    }]
  }

  createFlatSeries (matrix: string) {
    const wireframe = this.wireframe
    return {
      type: 'surface',
      name: matrix,
      itemStyle: {
        color: [0.5, 0.5, 0.5, 0.25]
      },
      wireframe: {
        show: wireframe,
        lineStyle: {
          opacity: 0.25,
          width: 1,
          color: '#ffffff'
        }
      },
      data: this.mesh[matrix].coordinates,
      dataShape: this.mesh[matrix].dimensions
    }
  }

  calibrate () {
    this.sendGcode('BED_MESH_CALIBRATE', this.$waits.onMeshCalibrate)
  }

  get matrix (): MatrixType {
    return this.$typedState.mesh.matrix
  }

  get scale (): number {
    return this.$typedState.mesh.scale
  }

  get boxScale (): number {
    return this.$typedState.mesh.boxScale
  }

  get wireframe (): boolean {
    return this.$typedState.mesh.wireframe
  }

  get flatSurface (): boolean {
    return this.$typedState.mesh.flatSurface
  }

  // The current processed mesh data, if any.
  get mesh (): AppMeshes {
    return this.$typedGetters['mesh/getCurrentMeshData']
  }

  downloadImage () {
    this.bedMeshChart.downloadImage()
  }
}
</script>
