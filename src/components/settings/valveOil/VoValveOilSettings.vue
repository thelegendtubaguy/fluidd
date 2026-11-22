<template>
  <div>
    <v-subheader id="valveOil">
      {{ $t('app.vo_valve_oil.title.valve_oil') }}
    </v-subheader>
    <v-card
      :elevation="5"
      dense
      class="mb-4"
    >
      <div
        v-if="!view"
        class="text-body-2 secondary--text px-4 py-3"
      >
        {{ emptyText }}
      </div>

      <template v-else>
        <app-setting
          :title="$t('app.vo_valve_oil.label.valve_oil')"
          :r-cols="5"
        >
          <div class="d-flex flex-column align-end text-right">
            <div>{{ view.release || $t('app.vo_valve_oil.label.unknown') }}</div>
            <div
              v-if="view.devBuild != null"
              class="text-caption secondary--text"
            >
              {{ view.devBuild ? $t('app.vo_valve_oil.label.dev_build_commit', { commit: view.devBuild }) : $t('app.vo_valve_oil.label.dev_build') }}
            </div>
          </div>
        </app-setting>

        <v-divider />

        <app-setting
          :title="$t('app.vo_valve_oil.label.qidi_firmware')"
          :r-cols="5"
        >
          <div class="d-flex flex-column align-end text-right">
            <div>{{ view.firmware || $t('app.vo_valve_oil.label.unknown') }}</div>
            <div
              v-if="view.targetFirmware"
              class="text-caption secondary--text"
            >
              {{ $t('app.vo_valve_oil.msg.target_firmware', { version: view.targetFirmware }) }}
            </div>
          </div>
        </app-setting>

        <v-divider />

        <app-setting
          :title="$t('app.vo_valve_oil.label.auto_update')"
          :sub-title="$t('app.vo_valve_oil.msg.auto_update')"
          :r-cols="5"
        >
          <v-switch
            :input-value="autoUpdateValue"
            :loading="autoUpdateRequest != null"
            :disabled="autoUpdateDisabled"
            hide-details
            class="mt-0 pt-0 float-right"
            @change="setAutoUpdate"
          />
        </app-setting>

        <vo-valve-oil-update-window
          v-if="view.updateWindow"
          :update-window="view.updateWindow"
          :disabled="autoUpdateDisabled"
          :pending="windowPending"
          :error="windowError"
          @save="setUpdateWindow"
          @dismiss-error="windowError = ''"
        />

        <vo-qidi-lan-only />

        <v-divider />

        <app-setting
          :title="$t('app.vo_valve_oil.label.waiting')"
          :r-cols="5"
        >
          <template #sub-title>
            <div v-if="view.waiting.length === 0">
              {{ $t('app.vo_valve_oil.msg.nothing_waiting') }}
            </div>
            <div
              v-for="item in view.waiting"
              :key="`waiting-${item.kind}-${item.board || ''}-${item.version || ''}`"
            >
              {{ waitingText(item) }}
            </div>
          </template>

          <div
            v-if="view.updateNow.offered"
            class="d-flex flex-column align-end"
          >
            <app-btn
              small
              color="primary"
              class="my-1"
              :loading="updateNowPending"
              :disabled="updateNowDisabled"
              @click="handleUpdateNow"
            >
              {{ updateNowLabel }}
            </app-btn>
            <div
              v-if="!view.updateNow.allowed"
              class="text-caption secondary--text text-right"
            >
              {{ blockedText(view.updateNow.blockedBy) }}
            </div>
          </div>
        </app-setting>

        <div
          v-if="hasNotices"
          class="px-4 pb-3"
        >
          <v-alert
            v-if="view.notice !== 'none' && !view.updating"
            dense
            text
            :type="view.notice === 'next_check' ? 'info' : 'warning'"
            class="mb-2"
          >
            {{ noticeText }}
          </v-alert>

          <v-alert
            v-if="reconnecting"
            dense
            text
            type="info"
            class="mb-2"
          >
            {{ reconnectText }}
          </v-alert>

          <v-alert
            v-if="autoUpdateError"
            dense
            text
            type="error"
            dismissible
            class="mb-2"
            @input="autoUpdateError = ''"
          >
            {{ $t('app.vo_valve_oil.msg.auto_update_failed', { error: autoUpdateError }) }}
          </v-alert>

          <v-alert
            v-if="updateNowError"
            dense
            text
            type="error"
            dismissible
            class="mb-2"
            @input="updateNowError = ''; updateNowBlockedBy = []"
          >
            {{ updateNowBlockedBy.length > 0
              ? $t('app.vo_valve_oil.msg.update_now_refused', { reasons: blockedText(updateNowBlockedBy) })
              : $t('app.vo_valve_oil.msg.update_now_failed', { error: updateNowError }) }}
          </v-alert>

          <v-alert
            v-if="view.checkFailed != null"
            dense
            text
            type="warning"
            class="mb-2"
          >
            {{ view.checkFailed ? $t('app.vo_valve_oil.msg.check_failed', { message: view.checkFailed }) : $t('app.vo_valve_oil.msg.check_failed_plain') }}
          </v-alert>

          <vo-valve-oil-update
            v-if="shownUpdate"
            :update="shownUpdate"
            :recovery-required="recoveryRequired"
            class="mb-2"
            @dismiss="dismissUpdate"
          />
        </div>

        <template v-for="board in view.boards">
          <v-divider :key="`divider-${board.id}`" />

          <div :key="`board-${board.id}`">
            <app-setting :r-cols="5">
              <template #title>
                {{ board.name }}
              </template>

              <template #sub-title>
                {{ boardFirmwareText(board) }}
              </template>

              <div class="text-right">
                <v-chip
                  small
                  outlined
                  :color="boardColor(board)"
                >
                  {{ $t(`app.vo_valve_oil.board_state.${board.badge}`) }}
                </v-chip>
              </div>
            </app-setting>

            <div
              v-if="board.note || board.shownDetail || board.reportUrl"
              class="px-4 pb-3 text-body-2"
            >
              <div v-if="board.note">
                {{ boardExplanation(board) }}
              </div>
              <div
                v-if="board.shownDetail"
                :class="{ 'text-caption secondary--text': board.note }"
                class="vo-valve-oil__detail"
              >
                {{ board.shownDetail }}
              </div>
              <app-btn
                v-if="board.reportUrl"
                small
                outlined
                color="primary"
                class="mt-2"
                :href="board.reportUrl"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ $t('app.vo_valve_oil.btn.report_board') }}
                <v-icon
                  small
                  right
                >
                  $openInNew
                </v-icon>
              </app-btn>
            </div>
          </div>
        </template>

        <template v-if="view.supportIssueUrl">
          <v-divider />

          <app-setting
            :title="$t('app.vo_valve_oil.label.report_problem')"
            :sub-title="$t('app.vo_valve_oil.msg.report_problem')"
            :r-cols="5"
          >
            <app-btn
              small
              outlined
              color="primary"
              class="float-right"
              :loading="supportPending"
              @click="handleReportProblem"
            >
              {{ $t('app.vo_valve_oil.btn.report_problem') }}
              <v-icon
                small
                right
              >
                $openInNew
              </v-icon>
            </app-btn>
          </app-setting>

          <div
            v-if="supportError"
            class="px-4 pb-3"
          >
            <v-alert
              dense
              text
              type="error"
              dismissible
              class="mb-0"
              @input="supportError = ''"
            >
              {{ $t('app.vo_valve_oil.msg.support_bundle_failed', { error: supportError }) }}
            </v-alert>
          </div>
        </template>

        <template v-if="view.checkedAt">
          <v-divider />
          <div class="text-caption secondary--text px-4 py-2">
            {{ $t('app.vo_valve_oil.msg.checked_at', { time: $filters.formatDateTime(view.checkedAt) }) }}
          </div>
        </template>
      </template>
    </v-card>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Watch } from 'vue-property-decorator'
import { getAccessToken } from '@/store/socket/actions'
import downloadUrl from '@/util/download-url'
import getRenamedStorageItem from '@/util/renamed-storage-item'
import VoValveOilUpdate from './VoValveOilUpdate.vue'
import VoValveOilUpdateWindow from './VoValveOilUpdateWindow.vue'
import VoQidiLanOnly from './VoQidiLanOnly.vue'
import {
  parseVoStatus,
  parseVoStatusJob,
  voStatusApiBase,
  voStatusPollFailure,
  voStatusPollInterval,
  voStatusRequest,
  VoStatusRequestError,
  voStatusView,
  voShownUpdate,
  voSupportBundle,
  VO_STATUS_RECONNECT_PATIENCE_MS,
  VO_UPDATE_NOW_BLOCKERS,
  voSentence,
  voUpdateWindowLabel,
  type VoBoardView,
  type VoStatus,
  type VoStatusBlocker,
  type VoStatusPending,
  type VoStatusView,
  type VoUpdateView
} from '@/util/vo-status'

// A finished update's result stays on the printer until the next one; here it clears when dismissed, and stays
// cleared across reloads. A success also clears by itself a day after it finished (voShownUpdate).
const DISMISSED_UPDATES_KEY = 'vo-status.dismissed-updates'
// Read once and moved to the key above, from before Valve Oil's tltg names became vo.
const OLD_DISMISSED_UPDATES_KEY = 'tltg-status.dismissed-updates'
const DISMISSED_UPDATES_KEPT = 20
// Set while an update runs, so a page reloaded or re-shown while the printer restarts its services reads failed
// requests as reconnecting rather than as a printer without the service.
const UPDATING_KEY = 'vo-status.updating-since'
const OLD_UPDATING_KEY = 'tltg-status.updating-since'
const UPDATING_KEPT_MS = 6 * 60 * 60 * 1000

const loadDismissedUpdates = (): string[] => {
  try {
    const value: unknown = JSON.parse(getRenamedStorageItem(localStorage, DISMISSED_UPDATES_KEY, OLD_DISMISSED_UPDATES_KEY) ?? '[]')

    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

const loadUpdating = (): boolean => {
  try {
    const since = Number(getRenamedStorageItem(sessionStorage, UPDATING_KEY, OLD_UPDATING_KEY))

    return Number.isFinite(since) && since > 0 && Date.now() - since < UPDATING_KEPT_MS
  } catch {
    return false
  }
}

const saveUpdating = (updating: boolean) => {
  try {
    if (!updating) {
      sessionStorage.removeItem(UPDATING_KEY)
    } else if (!sessionStorage.getItem(UPDATING_KEY)) {
      sessionStorage.setItem(UPDATING_KEY, String(Date.now()))
    }
  } catch {
    // Private browsing can refuse storage; this page still knows.
  }
}

@Component({
  components: {
    VoValveOilUpdate,
    VoValveOilUpdateWindow,
    VoQidiLanOnly
  }
})
export default class VoValveOilSettings extends Vue {
  status: VoStatus | null = null
  unavailable = false
  failures = 0
  // An update is running or was just started, so failed requests mean the printer is restarting its services.
  expectUpdate = loadUpdating()
  reconnectingSince: number | null = null
  now = Date.now()
  autoUpdateRequest: boolean | null = null
  autoUpdateError = ''
  windowPending = false
  windowError = ''
  updateNowPending = false
  updateNowError = ''
  updateNowBlockedBy: VoStatusBlocker[] = []
  dismissedUpdates: string[] = loadDismissedUpdates()
  supportPending = false
  supportError = ''

  timer: ReturnType<typeof setTimeout> | undefined = undefined
  abortController: AbortController | null = null
  destroyed = false

  get apiBase (): string | null {
    return voStatusApiBase(this.$typedState.config.apiUrl, window.location)
  }

  get view (): VoStatusView | null {
    return this.status ? voStatusView(this.status) : null
  }

  get reconnecting (): boolean {
    return this.reconnectingSince != null
  }

  get emptyText (): string {
    if (this.reconnecting) {
      return this.reconnectText
    }

    return this.unavailable
      ? this.$t('app.vo_valve_oil.msg.unavailable').toString()
      : this.$t('app.vo_valve_oil.msg.loading').toString()
  }

  get reconnectText (): string {
    const waited = this.reconnectingSince != null ? this.now - this.reconnectingSince : 0

    return waited >= VO_STATUS_RECONNECT_PATIENCE_MS
      ? this.$t('app.vo_valve_oil.msg.reconnecting_long', { minutes: Math.floor(waited / 60000) }).toString()
      : this.$t('app.vo_valve_oil.msg.reconnecting').toString()
  }

  get autoUpdateValue (): boolean {
    return this.autoUpdateRequest ?? this.status?.auto_update.enabled === true
  }

  get autoUpdateDisabled (): boolean {
    return (
      this.status?.auto_update.enabled == null ||
      this.autoUpdateRequest != null ||
      this.windowPending ||
      this.reconnecting
    )
  }

  get updateNowDisabled (): boolean {
    return (
      this.view == null ||
      !this.view.updateNow.offered ||
      !this.view.updateNow.allowed ||
      this.updateNowPending ||
      this.reconnecting
    )
  }

  get updateNowLabel (): string {
    return this.view?.updateNow.action === 'continue'
      ? this.$t('app.vo_valve_oil.btn.continue_update').toString()
      : this.$t('app.vo_valve_oil.btn.update_now').toString()
  }

  get recoveryRequired (): boolean {
    return this.view?.updateNow.blockedBy.some(blocker => blocker.code === 'recovery_required') === true
  }

  get shownUpdate (): VoUpdateView | null {
    return voShownUpdate(this.view?.update ?? null, this.dismissedUpdates)
  }

  get hasNotices (): boolean {
    const view = this.view

    return view != null && (
      (view.notice !== 'none' && !view.updating) ||
      this.reconnecting ||
      this.autoUpdateError !== '' ||
      this.updateNowError !== '' ||
      view.checkFailed != null ||
      this.shownUpdate != null
    )
  }

  get noticeText (): string {
    const view = this.view

    // Installing the installed release again says so, rather than "the update".
    const reinstall = view?.reinstall ? '_reinstall' : ''

    switch (view?.notice) {
      case 'auto_off':
        return this.$t(`app.vo_valve_oil.msg.waiting_auto_off${reinstall}`).toString()
      case 'blocked':
        return this.$t(`app.vo_valve_oil.msg.waiting_blocked${reinstall}`, { reasons: view.reasons.join('; ') }).toString()
      case 'window': {
        const window = view.updateWindow?.hours
        const params = {
          window: window ? voUpdateWindowLabel(window) : '',
          timezone: view.updateWindow?.timezone ?? 'UTC'
        }

        return view.firmwareWaiting
          ? this.$t('app.vo_valve_oil.msg.waiting_window_firmware', params).toString()
          : this.$t(`app.vo_valve_oil.msg.waiting_window${reinstall}`, params).toString()
      }
      case 'next_check': {
        const key = view.firmwareWaiting
          ? 'app.vo_valve_oil.msg.waiting_next_check_firmware'
          : `app.vo_valve_oil.msg.waiting_next_check${reinstall}`

        return view.nextCheckAt != null
          ? this.$t(`${key}_at`, { time: this.formatSoon(view.nextCheckAt) }).toString()
          : this.$t(key).toString()
      }
      default:
        return ''
    }
  }

  /** A time later today as just the time, and one on another day with its date. */
  formatSoon (value: number): string {
    return new Date(value).toDateString() === new Date().toDateString()
      ? this.$filters.formatTime(value)
      : this.$filters.formatDateTime(value)
  }

  /**
   * Why Update now can't start, each reason in plain words. A recovery is shown as the printer says it, as its message
   * names what to run first, and a reason the page doesn't know is shown as the printer says it.
   */
  blockedText (blockedBy: VoStatusBlocker[]): string {
    if (blockedBy.length === 0) {
      return this.$t('app.vo_valve_oil.msg.update_now_blocked_unknown').toString()
    }

    return blockedBy
      .map(blocker => {
        if (VO_UPDATE_NOW_BLOCKERS.includes(blocker.code)) {
          return this.$t(`app.vo_valve_oil.msg.update_now_blocked.${blocker.code}`).toString()
        }

        return blocker.code === 'recovery_required'
          ? voSentence(blocker.message)
          : this.$t('app.vo_valve_oil.msg.update_now_blocked_other', { message: blocker.message }).toString()
      })
      .join(' ')
  }

  mounted () {
    document.addEventListener('visibilitychange', this.onVisibility)
    this.poll()
  }

  beforeDestroy () {
    this.destroyed = true
    document.removeEventListener('visibilitychange', this.onVisibility)
    this.stop()
  }

  @Watch('apiBase')
  onApiBaseChanged () {
    this.status = null
    this.unavailable = false
    this.failures = 0
    this.reconnectingSince = null
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
      this.timer = setTimeout(() => this.poll(), voStatusPollInterval(this.status, this.reconnecting))
    }
  }

  async request (path: string, method: 'GET' | 'POST' = 'GET', signal?: AbortSignal, body?: Record<string, unknown>): Promise<unknown> {
    const base = this.apiBase

    if (!base) {
      throw new VoStatusRequestError(0, 'Not connected to this printer')
    }

    return voStatusRequest(base, path, { method, token: await this.token(), signal, body })
  }

  async token (): Promise<string | null> {
    try {
      return await getAccessToken(this.$typedGetters['config/getTokenKeys'])
    } catch {
      return null
    }
  }

  /**
   * Opens the prefilled issue, then downloads the support bundle to attach to it. The issue opens first, while the
   * click still lets this page open a tab.
   */
  async handleReportProblem () {
    const url = this.view?.supportIssueUrl
    const base = this.apiBase

    if (!url || !base || this.supportPending) {
      return
    }

    window.open(url, '_blank', 'noopener,noreferrer')
    this.supportPending = true
    this.supportError = ''

    try {
      const { blob, name } = await voSupportBundle(base, { token: await this.token() })
      const objectUrl = URL.createObjectURL(blob)

      downloadUrl(name, objectUrl)

      // Deferred, as revoking right after the click can cancel the download
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
    } catch (e) {
      this.supportError = e instanceof Error ? e.message : String(e)
    } finally {
      this.supportPending = false
    }
  }

  applyStatus (status: VoStatus) {
    this.status = status
    this.unavailable = false
    this.failures = 0
    this.reconnectingSince = null
    this.expectUpdate = status.busy
    saveUpdating(status.busy)
  }

  async poll () {
    this.stop()

    if (this.destroyed || document.hidden) {
      return
    }

    if (!this.apiBase) {
      this.status = null
      this.unavailable = true
      return
    }

    const abortController = new AbortController()

    this.abortController = abortController

    try {
      const body = await this.request('/status', 'GET', abortController.signal)

      if (abortController.signal.aborted) {
        return
      }

      const status = parseVoStatus(body)

      if (status) {
        this.applyStatus(status)
      } else {
        // The service answered with something this page doesn't understand, such as a newer schema.
        this.status = null
        this.unavailable = true
        this.reconnectingSince = null
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
    this.now = Date.now()

    const outcome = voStatusPollFailure({
      hasStatus: this.status != null,
      failures: this.failures,
      updating: this.expectUpdate || this.status?.busy === true
    })

    if (outcome === 'reconnecting') {
      if (this.reconnectingSince == null) {
        this.reconnectingSince = this.now
      }
    } else if (outcome === 'unavailable') {
      this.status = null
      this.unavailable = true
      this.reconnectingSince = null
    }
  }

  waitingText (item: VoStatusPending): string {
    const current = item.current
      ? this.$t('app.vo_valve_oil.label.waiting_current', { version: item.current }).toString()
      : ''

    switch (item.kind) {
      case 'release':
        if (item.reinstall) {
          return this.$t('app.vo_valve_oil.label.waiting_reinstall').toString()
        }

        return item.version
          ? `${this.$t('app.vo_valve_oil.label.waiting_release', { version: item.version })}${current}`
          : this.$t('app.vo_valve_oil.label.waiting_release_unknown').toString()
      case 'firmware':
        return item.version
          ? `${this.$t('app.vo_valve_oil.label.waiting_firmware', { version: item.version })}${current}`
          : this.$t('app.vo_valve_oil.label.waiting_firmware_unknown').toString()
      default: {
        const board = this.status?.boards.find(board => board.id === item.board)

        return board || item.board
          ? this.$t('app.vo_valve_oil.label.waiting_board', { name: board?.name ?? item.board }).toString()
          : this.$t('app.vo_valve_oil.label.waiting_board_unknown').toString()
      }
    }
  }

  boardFirmwareText (board: VoBoardView): string {
    const version = board.firmware
      ? this.$t('app.vo_valve_oil.label.board_firmware', { version: board.firmware }).toString()
      : this.$t('app.vo_valve_oil.label.board_firmware_unknown').toString()
    const build = board.build && this.$te(`app.vo_valve_oil.board_build.${board.build}`)
      ? this.$t(`app.vo_valve_oil.board_build.${board.build}`).toString()
      : ''

    return build ? `${version} · ${build}` : version
  }

  boardExplanation (board: VoBoardView): string {
    if (board.note === 'after_firmware') {
      return board.noteVersion
        ? this.$t('app.vo_valve_oil.board_msg.after_firmware', { version: board.noteVersion }).toString()
        : this.$t('app.vo_valve_oil.board_msg.after_firmware_unknown').toString()
    }

    return board.note ? this.$t(`app.vo_valve_oil.board_msg.${board.note}`).toString() : ''
  }

  boardColor (board: VoBoardView): string {
    switch (board.badge) {
      case 'current':
        return 'success'
      case 'needs_image':
      case 'after_firmware':
        return 'primary'
      case 'unrecognized_bootloader':
      case 'unrecognized_firmware':
        return 'warning'
      default:
        return 'grey'
    }
  }

  dismissUpdate (id: string) {
    if (this.dismissedUpdates.includes(id)) {
      return
    }

    this.dismissedUpdates = [...this.dismissedUpdates, id].slice(-DISMISSED_UPDATES_KEPT)

    try {
      localStorage.setItem(DISMISSED_UPDATES_KEY, JSON.stringify(this.dismissedUpdates))
    } catch {
      // Private browsing can refuse storage; the result still clears for this page.
    }
  }

  async setAutoUpdate (value: boolean | null) {
    const enabled = value === true

    if (this.autoUpdateDisabled || enabled === this.status?.auto_update.enabled) {
      return
    }

    this.autoUpdateRequest = enabled
    this.autoUpdateError = ''

    try {
      const status = parseVoStatus(await this.request('/auto-update', 'POST', undefined, { enabled }))

      if (status) {
        this.applyStatus(status)
      }
    } catch (e) {
      this.autoUpdateError = e instanceof Error ? e.message : String(e)
    } finally {
      this.autoUpdateRequest = null
    }

    this.poll()
  }

  /** Saves the update window or its timezone: any of {"window": {...} | null, "timezone": "<IANA name>"}. */
  async setUpdateWindow (body: Record<string, unknown>) {
    if (this.autoUpdateDisabled) {
      return
    }

    this.windowPending = true
    this.windowError = ''

    try {
      const status = parseVoStatus(await this.request('/auto-update', 'POST', undefined, body))

      if (status) {
        this.applyStatus(status)
      }
    } catch (e) {
      this.windowError = e instanceof Error ? e.message : String(e)
    } finally {
      this.windowPending = false
    }

    this.poll()
  }

  async handleUpdateNow () {
    const view = this.view

    if (!view || this.updateNowDisabled) {
      return
    }

    const release = view.waiting.find(item => item.kind === 'release')
    const action = view.updateNow.action
    let message = this.$t('app.vo_valve_oil.msg.confirm_update_release_unknown')

    if (action === 'continue') {
      message = this.$t('app.vo_valve_oil.msg.confirm_update_continue')
    } else if (action === 'finish') {
      message = this.$t('app.vo_valve_oil.msg.confirm_update_resume')
    } else if (view.firmwareWaiting) {
      message = this.$t('app.vo_valve_oil.msg.confirm_update_firmware')
    } else if (release?.reinstall && release.version) {
      message = this.$t('app.vo_valve_oil.msg.confirm_update_reinstall', { version: release.version })
    } else if (release?.version && !release.reinstall) {
      message = this.$t('app.vo_valve_oil.msg.confirm_update_release', { version: release.version })
    }

    const confirmed = await this.$confirm(
      message.toString(),
      {
        title: this.$t(action === 'continue' ? 'app.vo_valve_oil.title.continue_update' : 'app.vo_valve_oil.title.update_now').toString(),
        color: 'card-heading',
        icon: '$warning'
      }
    )

    if (!confirmed || this.updateNowDisabled) {
      return
    }

    this.updateNowPending = true
    this.updateNowError = ''
    this.updateNowBlockedBy = []

    try {
      const job = parseVoStatusJob(await this.request('/update-now', 'POST'))

      this.expectUpdate = true
      saveUpdating(true)

      if (job && this.status) {
        this.status = { ...this.status, busy: job.state === 'running' || this.status.busy, job }
      }
    } catch (e) {
      this.updateNowError = e instanceof Error ? e.message : String(e)
      this.updateNowBlockedBy = e instanceof VoStatusRequestError && e.status === 409 ? e.blockedBy : []
    } finally {
      this.updateNowPending = false
    }

    this.poll()
  }
}
</script>

<style lang="scss" scoped>
  .vo-valve-oil__detail {
    overflow-wrap: anywhere;
  }
</style>
