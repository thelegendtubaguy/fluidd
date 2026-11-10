// Import ECharts, loaded asynchronously from main.ts
import ECharts from 'vue-echarts'
import { use, connect } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { Grid3DComponent } from 'echarts-gl/components'
import { SurfaceChart, Scatter3DChart } from 'echarts-gl/charts'
import {
  DatasetComponent,
  TooltipComponent,
  GridComponent,
  DataZoomComponent,
  LegendComponent,
  VisualMapComponent,
  GraphicComponent,
  MarkLineComponent,
  MarkAreaComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

// Configure echarts
use([
  DatasetComponent,
  TooltipComponent,
  GridComponent,
  DataZoomComponent,
  LegendComponent,
  LineChart,
  VisualMapComponent,
  GraphicComponent,
  MarkLineComponent,
  MarkAreaComponent,
  SurfaceChart,
  Scatter3DChart,
  Grid3DComponent,
  CanvasRenderer
])

// Charts in these groups share their crosshair. Connecting here keeps ECharts in this
// one chunk; importing echarts/core anywhere else splits it into a chunk of its own.
connect('bed-soak-run')
connect('bed-soak-compare')

export default ECharts
