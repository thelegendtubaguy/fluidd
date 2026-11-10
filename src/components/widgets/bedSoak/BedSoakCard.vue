<template>
  <collapsable-card
    class="bed-soak-card"
    :title="$t('app.bed_soak.title.bed_soak')"
    icon="$bedSoak"
    :lazy="false"
  >
    <template #title>
      <div class="d-flex align-center">
        <v-tabs
          v-model="tab"
          background-color="transparent"
          mobile-breakpoint="0"
          height="41"
          hide-slider
          class="flex-grow-0 bed-soak-card__tabs"
        >
          <v-tab :title="$t('app.bed_soak.title.bed_soak')">
            <v-icon :left="!isMobileViewport">
              $bedSoak
            </v-icon>
            <span v-if="!isMobileViewport">{{ $t('app.bed_soak.title.bed_soak') }}</span>
          </v-tab>
          <v-tab>
            {{ $t('app.bed_soak.label.past_runs', { count: entries.length }) }}
          </v-tab>
        </v-tabs>
        <app-inline-help
          v-if="!isMobileViewport"
          bottom
          small
          :tooltip="$t('app.bed_soak.tooltip.card')"
        />
      </div>
    </template>

    <template #menu>
      <app-btn
        v-if="running && tab === 0"
        small
        color="error"
        class="me-1 my-1"
        :loading="hasWait($waits.onBedSoakStop)"
        :disabled="status.stop_requested"
        @click="handleStop"
      >
        <v-icon
          small
          left
        >
          $stop
        </v-icon>
        {{ $t('app.bed_soak.btn.stop') }}
      </app-btn>
      <app-btn
        v-else-if="tab === 0 && !showSetup"
        small
        class="me-1 my-1"
        @click="dismissedFile = status.file"
      >
        {{ $t('app.bed_soak.btn.new_test') }}
      </app-btn>
      <app-btn
        v-else-if="tab === 1 && openedEntry"
        small
        class="me-1 my-1"
        @click="openedPath = null"
      >
        {{ $t('app.bed_soak.btn.back') }}
      </app-btn>
    </template>

    <template v-if="tab === 0">
      <v-card-text>
        <bed-soak-setup
          v-if="showSetup"
          :status="status"
          :runs="setupRuns"
        />
        <bed-soak-run
          v-else
          :run="liveRun"
          :status="status"
          :live="running"
          :live-temps="liveTemps"
          :file="status.file"
        />
      </v-card-text>
    </template>

    <template v-else>
      <v-card-text v-if="openedEntry">
        <bed-soak-run
          :run="openedEntry.run"
          :file="openedEntry.path"
        />
      </v-card-text>
      <bed-soak-past-runs
        v-else
        :entries="entries"
        :live-file="running ? status.file : ''"
        @open="openedPath = $event"
      />
    </template>
  </collapsable-card>
</template>

<script lang="ts">
import { Component, Mixins, Watch } from 'vue-property-decorator'
import Vue from 'vue'
import { consola } from 'consola'
import StateMixin from '@/mixins/state'
import FilesMixin from '@/mixins/files'
import BrowserMixin from '@/mixins/browser'
import { SocketActions } from '@/api/socketActions'
import type { FileBrowserEntry } from '@/store/files/types'
import BedSoakSetup from './BedSoakSetup.vue'
import BedSoakRun from './BedSoakRun.vue'
import BedSoakPastRuns, { type BedSoakRunEntry } from './BedSoakPastRuns.vue'
import {
  BED_SOAK_FOLDER,
  BED_SOAK_PATH,
  BED_SOAK_ROOT,
  parseBedSoakFilename,
  parseBedSoakRun,
  type BedSoakRun as BedSoakRunData,
  type BedSoakTemp
} from '@/util/tltg-bed-soak'

interface CachedRun {
  modified: number;
  run: BedSoakRunData | null;
}

@Component({
  components: {
    BedSoakSetup,
    BedSoakRun,
    BedSoakPastRuns
  }
})
export default class BedSoakCard extends Mixins(StateMixin, FilesMixin, BrowserMixin) {
  tab = 0

  // The ended run whose results were put away with New test
  dismissedFile: string | null = null

  // The past run open in the Past runs tab
  openedPath: string | null = null

  runs: Record<string, CachedRun | undefined> = {}

  // Temperatures since the run file's last mesh, sampled as the test reports its time
  liveTemps: BedSoakTemp[] = []

  loading = new Set<string>()
  reload = new Set<string>()
  liveRetries = 0
  liveTimer: ReturnType<typeof setTimeout> | null = null

  get status (): Klipper.TltgBedSoakState {
    return this.$typedState.printer.printer.tltg_bed_soak as Klipper.TltgBedSoakState
  }

  get running (): boolean {
    return this.status.state === 'running'
  }

  get showSetup (): boolean {
    return (
      !this.running &&
      (
        this.status.state === 'idle' ||
        !this.status.file ||
        this.dismissedFile === this.status.file
      )
    )
  }

  get liveRun (): BedSoakRunData | null {
    return this.status.file ? this.runs[this.status.file]?.run ?? null : null
  }

  get files (): { filename: string, modified: number }[] {
    const directory: FileBrowserEntry[] | undefined = this.$typedGetters['files/getDirectory'](BED_SOAK_PATH)

    return (directory ?? [])
      .filter(entry => entry.type === 'file' && entry.name.endsWith('.jsonl'))
      .map(entry => ({ filename: entry.name, modified: entry.modified }))
  }

  get entries (): BedSoakRunEntry[] {
    return this.files
      .map(file => {
        const path = `${BED_SOAK_FOLDER}/${file.filename}`
        const parsed = parseBedSoakFilename(file.filename)

        return {
          path,
          filename: file.filename,
          started: parsed?.started ?? file.modified,
          bed: parsed?.bed ?? 0,
          chamber: parsed?.chamber ?? null,
          run: this.runs[path]?.run ?? null
        }
      })
      .sort((a, b) => b.filename.localeCompare(a.filename))
  }

  get setupRuns () {
    return this.entries
      .filter((entry): entry is BedSoakRunEntry & { run: BedSoakRunData } => entry.run != null)
      .map(entry => ({ started: entry.run.settings.started || entry.started, run: entry.run }))
  }

  get openedEntry (): BedSoakRunEntry | undefined {
    return this.openedPath ? this.entries.find(entry => entry.path === this.openedPath) : undefined
  }

  mounted () {
    this.requestDirectory()
    this.requestLive()
  }

  beforeDestroy () {
    if (this.liveTimer) clearTimeout(this.liveTimer)

    // A bed soak mesh shown on the Bed mesh card belongs to this page
    if (this.$typedState.mesh.preview) {
      this.$typedDispatch('mesh/onPreview', null)
    }
  }

  requestDirectory () {
    // Moonraker answers 400 while the folder doesn't exist yet
    SocketActions.serverFilesGetDirectory(BED_SOAK_PATH, { suppressError: true })
      .catch(() => {
        // No runs saved yet
      })
  }

  async loadRun (path: string, modified: number) {
    if (this.loading.has(path)) {
      this.reload.add(path)
      return
    }

    this.loading.add(path)

    try {
      const response = await this.serverFilesGet<string>(`${BED_SOAK_ROOT}/${path}`, {
        responseType: 'text',
        transformResponse: [(value: string) => value]
      })

      Vue.set(this.runs, path, Object.freeze({ modified, run: parseBedSoakRun(response.data) }))
    } catch (error) {
      consola.debug('[BedSoak] read failed', path, error)
    } finally {
      this.loading.delete(path)
    }

    if (this.reload.delete(path)) {
      await this.loadRun(path, modified)
    }
  }

  // Read new and changed run files
  @Watch('files', { immediate: true })
  onFiles () {
    for (const file of this.files) {
      const path = `${BED_SOAK_FOLDER}/${file.filename}`

      if (this.runs[path]?.modified !== file.modified) {
        this.loadRun(path, file.modified)
      }
    }

    if (this.openedPath && !this.entries.some(entry => entry.path === this.openedPath)) {
      this.openedPath = null
    }
  }

  get liveKey (): string {
    const { file, meshes, state, problems } = this.status

    return [file, meshes, state, problems?.jumps].join('|')
  }

  // The live status carries no grids, so read the run file each time it reports a new mesh
  @Watch('liveKey')
  onLiveKey () {
    this.liveRetries = 0
    this.requestLive()

    // The folder may not have existed when the run started
    const file = this.status.file
    if (file && !this.files.some(item => `${BED_SOAK_FOLDER}/${item.filename}` === file)) {
      this.requestDirectory()
    }
  }

  @Watch('status.file')
  onLiveFile (value: string, oldValue: string) {
    if (value !== oldValue) {
      this.liveTemps = []
      this.requestDirectory()
    }
  }

  @Watch('status.state')
  onState (value: string, oldValue: string) {
    if (value === 'running' && oldValue !== 'running') {
      this.tab = 0
      this.dismissedFile = null
    }
  }

  requestLive () {
    if (this.liveTimer) clearTimeout(this.liveTimer)

    const file = this.status.file

    if (!file) return

    this.liveTimer = setTimeout(async () => {
      this.liveTimer = null

      await this.loadRun(file, this.runs[file]?.modified ?? 0)

      // Klipper may report the mesh before the file has it
      const run = this.runs[file]?.run
      if (
        this.status.file === file &&
        (run == null || run.meshes.length < this.status.meshes) &&
        this.liveRetries < 5
      ) {
        this.liveRetries++
        this.liveTimer = setTimeout(() => this.requestLive(), 2000)
      }
    }, 300)
  }

  @Watch('status.elapsed')
  onElapsed (elapsed: number | null) {
    if (!this.running || elapsed == null) return

    const printer = this.$typedState.printer.printer
    const chamber = printer['heater_generic chamber'] ?? printer['temperature_sensor chamber']
    const temps = this.liveRun?.temps ?? []
    const last = temps.length > 0 ? temps[temps.length - 1][0] : -Infinity

    this.liveTemps = [
      ...this.liveTemps.filter(sample => sample[0] > last && sample[0] < elapsed),
      [elapsed, printer.heater_bed?.temperature ?? null, chamber?.temperature ?? null]
    ]
  }

  async handleStop () {
    const result = await this.$confirm(
      this.$t('app.bed_soak.msg.confirm_stop').toString(),
      { title: this.$tc('app.general.label.confirm'), color: 'card-heading', icon: '$error' }
    )

    if (result) {
      SocketActions.printerTltgBedSoakStop()
    }
  }
}
</script>

<style lang="scss" scoped>
  .bed-soak-card__tabs {
    width: auto;
  }
</style>
