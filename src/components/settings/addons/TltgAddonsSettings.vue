<template>
  <div>
    <v-subheader id="addons">
      {{ $t('app.tltg_addons.title.addons') }}
    </v-subheader>
    <v-card
      :elevation="5"
      dense
      class="mb-4"
    >
      <div
        v-if="!list || addons.length === 0"
        class="text-body-2 secondary--text px-4 py-3"
      >
        {{ !list ? (unavailable ? $t('app.tltg_addons.msg.unavailable') : $t('app.tltg_addons.msg.loading')) : $t('app.tltg_addons.msg.none') }}
      </div>

      <template v-for="(addon, index) in addons">
        <v-divider
          v-if="index > 0"
          :key="`divider-${addon.id}`"
        />

        <div :key="`addon-${addon.id}`">
          <app-setting :r-cols="5">
            <template #title>
              {{ addon.name }}
              <a
                v-if="addon.homepage"
                :href="addon.homepage"
                target="_blank"
                rel="noopener noreferrer"
              >
                <v-icon
                  small
                  right
                >
                  $openInNew
                </v-icon>
              </a>
              <v-chip
                small
                outlined
                :color="stateColor(addon)"
                class="ml-2"
              >
                {{ $t(`app.tltg_addons.state.${addon.state}`) }}
              </v-chip>
            </template>

            <template #sub-title>
              <div v-if="addon.description">
                {{ addon.description }}
              </div>
              <div v-if="versionText(addon)">
                {{ versionText(addon) }}
              </div>
            </template>

            <div class="d-flex flex-column align-end">
              <div class="d-flex flex-wrap justify-end align-center">
                <app-btn
                  v-if="actions(addon).remove"
                  small
                  outlined
                  color="error"
                  class="ml-2 my-1"
                  :disabled="actionsDisabled"
                  @click="handleAction(addon, 'remove')"
                >
                  {{ $t('app.tltg_addons.btn.remove') }}
                </app-btn>

                <app-btn
                  v-if="actions(addon).primary"
                  small
                  :outlined="actions(addon).primary === 'remove'"
                  :color="actions(addon).primary === 'remove' ? 'error' : 'primary'"
                  class="ml-2 my-1"
                  :loading="pendingAction != null && pendingAction.addon === addon.id"
                  :disabled="actionsDisabled"
                  @click="handleAction(addon, actions(addon).primary)"
                >
                  {{ $t(`app.tltg_addons.btn.${actions(addon).primary}`) }}
                </app-btn>
              </div>

              <div
                v-if="actions(addon).primary && printerBusyHint"
                class="text-caption secondary--text"
              >
                {{ $t('app.tltg_addons.msg.printer_busy') }}
              </div>
            </div>
          </app-setting>

          <div
            v-if="addon.state === 'foreign' || actionErrors[addon.id] || jobFor(addon) || hasStatusPanel(addon)"
            class="px-4 pb-3"
          >
            <v-alert
              v-if="addon.state === 'foreign'"
              dense
              text
              type="info"
              class="mb-2"
            >
              {{ $t('app.tltg_addons.msg.foreign', { name: addon.name }) }}
            </v-alert>

            <v-alert
              v-if="actionErrors[addon.id]"
              dense
              text
              type="error"
              class="mb-2"
            >
              {{ actionErrors[addon.id] }}
            </v-alert>

            <tltg-addon-job
              v-if="jobFor(addon)"
              :job="jobFor(addon)"
              :name="addon.name"
              class="mb-2"
              @dismiss="dismissJob"
            />

            <tltg-octo-everywhere-status
              v-if="addon.id === 'octoeverywhere' && hasStatusPanel(addon)"
              :addon="addon"
              :request="request"
            />
          </div>
        </div>
      </template>
    </v-card>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Watch } from 'vue-property-decorator'
import { getAccessToken } from '@/store/socket/actions'
import TltgAddonJob from './TltgAddonJob.vue'
import TltgOctoEverywhereStatus from './TltgOctoEverywhereStatus.vue'
import {
  parseTltgAddonsList,
  parseTltgAddonsJob,
  tltgAddonActions,
  tltgAddonsApiBase,
  tltgAddonsPollInterval,
  tltgAddonsRequest,
  TltgAddonsRequestError,
  type TltgAddon,
  type TltgAddonAction,
  type TltgAddonJob as AddonJob,
  type TltgAddonsList
} from '@/util/tltg-addons'

// Polls lose the list only after this many failures in a row, so a service restart mid-job keeps it on screen.
const FAILURES_BEFORE_UNAVAILABLE = 3
// A finished job stays on the printer until the next one starts. Its result here clears when dismissed, a success
// also by itself after a few seconds, and stays cleared across reloads.
const SUCCESS_VISIBLE_MS = 8000
const DISMISSED_JOBS_KEY = 'tltg-addons.dismissed-jobs'
const DISMISSED_JOBS_KEPT = 20

const loadDismissedJobs = (): string[] => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(DISMISSED_JOBS_KEY) ?? '[]')

    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

@Component({
  components: {
    TltgAddonJob,
    TltgOctoEverywhereStatus
  }
})
export default class TltgAddonsSettings extends Vue {
  list: TltgAddonsList | null = null
  unavailable = false
  failures = 0
  pendingAction: { addon: string, action: TltgAddonAction } | null = null
  actionErrors: Record<string, string> = {}
  dismissedJobs: string[] = loadDismissedJobs()
  successTimer: ReturnType<typeof setTimeout> | undefined = undefined

  timer: ReturnType<typeof setTimeout> | undefined = undefined
  abortController: AbortController | null = null
  destroyed = false

  get apiBase (): string | null {
    return tltgAddonsApiBase(this.$typedState.config.apiUrl, window.location)
  }

  get addons (): TltgAddon[] {
    return this.list?.addons ?? []
  }

  // A running job explains itself; the idle hint is only for a printer that's printing.
  get printerBusyHint (): boolean {
    return this.list != null && this.list.printer_busy && !this.list.busy
  }

  get actionsDisabled (): boolean {
    return (
      this.list == null ||
      this.list.busy ||
      this.list.printer_busy ||
      this.pendingAction != null
    )
  }

  mounted () {
    document.addEventListener('visibilitychange', this.onVisibility)
    this.poll()
  }

  beforeDestroy () {
    this.destroyed = true
    clearTimeout(this.successTimer)
    document.removeEventListener('visibilitychange', this.onVisibility)
    this.stop()
  }

  @Watch('apiBase')
  onApiBaseChanged () {
    this.list = null
    this.unavailable = false
    this.failures = 0
    this.poll()
  }

  onVisibility () {
    if (document.hidden) {
      this.stop()
    } else {
      this.poll()
    }
  }

  stop () {
    clearTimeout(this.timer)
    this.timer = undefined
    this.abortController?.abort()
    this.abortController = null
  }

  schedule () {
    clearTimeout(this.timer)

    if (!this.destroyed && !document.hidden) {
      this.timer = setTimeout(() => this.poll(), tltgAddonsPollInterval(this.list))
    }
  }

  async request (path: string, method: 'GET' | 'POST' = 'GET', signal?: AbortSignal): Promise<unknown> {
    const base = this.apiBase

    if (!base) {
      throw new TltgAddonsRequestError(0, 'Not connected to this printer')
    }

    let token: string | null = null

    try {
      token = await getAccessToken(this.$typedGetters['config/getTokenKeys'])
    } catch {
      token = null
    }

    return tltgAddonsRequest(base, path, { method, token, signal })
  }

  async poll () {
    this.stop()

    if (this.destroyed || document.hidden) {
      return
    }

    if (!this.apiBase) {
      this.list = null
      this.unavailable = true
      return
    }

    const abortController = new AbortController()

    this.abortController = abortController

    try {
      const list = parseTltgAddonsList(await this.request('/addons', 'GET', abortController.signal))

      if (abortController.signal.aborted) {
        return
      }

      if (list) {
        this.list = list
        this.unavailable = false
        this.failures = 0
      } else {
        this.onPollFailed()
      }
    } catch {
      if (abortController.signal.aborted) {
        return
      }

      this.onPollFailed()
    }

    if (this.abortController === abortController) {
      this.abortController = null
    }

    this.schedule()
  }

  onPollFailed () {
    this.failures++

    if (this.list == null || this.failures >= FAILURES_BEFORE_UNAVAILABLE) {
      this.list = null
      this.unavailable = true
    }
  }

  actions (addon: TltgAddon) {
    return tltgAddonActions(addon)
  }

  jobFor (addon: TltgAddon): AddonJob | null {
    const job = this.list?.job

    return job && job.addon === addon.id && (job.state === 'running' || !this.dismissedJobs.includes(job.id))
      ? job
      : null
  }

  @Watch('list.job.state')
  onJobState (state: string | undefined) {
    clearTimeout(this.successTimer)

    const id = this.list?.job?.id

    if (state === 'succeeded' && id && !this.dismissedJobs.includes(id)) {
      this.successTimer = setTimeout(() => this.dismissJob(id), SUCCESS_VISIBLE_MS)
    }
  }

  dismissJob (id: string) {
    if (this.dismissedJobs.includes(id)) {
      return
    }

    this.dismissedJobs = [...this.dismissedJobs, id].slice(-DISMISSED_JOBS_KEPT)

    try {
      localStorage.setItem(DISMISSED_JOBS_KEY, JSON.stringify(this.dismissedJobs))
    } catch {
      // Private browsing can refuse storage; the result still clears for this page.
    }
  }

  hasStatusPanel (addon: TltgAddon): boolean {
    return addon.state !== 'not_installed' && (addon.status != null || addon.service != null)
  }

  versionText (addon: TltgAddon): string {
    const { installed_version: installed, available_version: available } = addon

    if (addon.state === 'update_available' && installed && available) {
      return this.$t('app.tltg_addons.label.version_update', { installed, available }).toString()
    }

    if (addon.state !== 'not_installed' && installed) {
      return this.$t('app.tltg_addons.label.version', { version: installed }).toString()
    }

    if (available) {
      return this.$t('app.tltg_addons.label.version', { version: available }).toString()
    }

    return ''
  }

  stateColor (addon: TltgAddon): string {
    switch (addon.state) {
      case 'installed':
        return 'success'
      case 'update_available':
        return 'primary'
      case 'foreign':
        return 'warning'
      default:
        return 'grey'
    }
  }

  async handleAction (addon: TltgAddon, action: TltgAddonAction | null) {
    if (!action || this.actionsDisabled) {
      return
    }

    if (action === 'remove') {
      const confirmed = await this.$confirm(
        this.$t('app.tltg_addons.msg.confirm_remove', { name: addon.name }).toString(),
        { title: this.$t('app.tltg_addons.title.remove', { name: addon.name }).toString(), color: 'card-heading', icon: '$error' }
      )

      if (!confirmed || this.actionsDisabled) {
        return
      }
    }

    this.pendingAction = { addon: addon.id, action }
    Vue.delete(this.actionErrors, addon.id)

    try {
      const body = await this.request(`/addons/${encodeURIComponent(addon.id)}/${action}`, 'POST')
      const job = parseTltgAddonsJob(body)

      if (job && this.list) {
        this.list = { ...this.list, busy: job.state === 'running' || this.list.busy, job }
      }
    } catch (e) {
      Vue.set(this.actionErrors, addon.id, e instanceof Error ? e.message : String(e))
    } finally {
      this.pendingAction = null
    }

    this.poll()
  }
}
</script>
