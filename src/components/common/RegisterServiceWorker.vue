<template>
  <div>
    <v-snackbar
      v-model="needRefresh"
      timeout="-1"
      multi-line
      elevation="24"
      bottom
      right
    >
      <span v-safe-html="$t('app.general.msg.needs_refresh')" />
      <template #action="{ attrs }">
        <app-btn
          v-bind="attrs"
          @click="updateServiceWorker"
        >
          {{ $t('app.general.btn.reload') }}
        </app-btn>
      </template>
    </v-snackbar>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'
import { consola } from 'consola'
import { EventBus } from '@/eventBus'

// Open tabs look for a newly installed build this often and whenever they become visible again.
const BUILD_CHECK_INTERVAL = 5 * 60 * 1000
const BUILD_RELOAD_KEY = 'fluidd-build-reload'

@Component({})
export default class RegisterServiceWorker extends Vue {
  updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null
  registration: ServiceWorkerRegistration | null = null
  needRefresh = false
  buildCheckTimer: number | null = null

  onOfflineReady () {
    consola.debug('[PWA] ready for offline work')
    EventBus.$emit(this.$tc('app.general.msg.offline_ready'), { timeout: 5000 })
  }

  onNeedRefresh () {
    consola.debug('[PWA] needs refresh')
    this.needRefresh = true
  }

  onRegistered (registration?: ServiceWorkerRegistration) {
    consola.debug('[PWA] registered', registration)
    this.registration = registration ?? null
  }

  // Without a service worker, which browsers only run on secure origins, nothing tells an open tab that the
  // printer now serves a newer build. A changed build reloads the tab once; a service worker instead installs
  // the update, which takes over and reloads its tabs.
  async checkBuild () {
    if (document.visibilityState !== 'visible') return

    let served: unknown
    try {
      const response = await fetch('release_info.json', { cache: 'no-store' })
      if (!response.ok) return
      const releaseInfo: unknown = await response.json()
      if (releaseInfo && typeof releaseInfo === 'object' && 'version' in releaseInfo) served = releaseInfo.version
    } catch {
      return
    }

    if (typeof served !== 'string' || served === import.meta.env.BUILD_VERSION) return

    if (navigator.serviceWorker?.controller) {
      await this.registration?.update().catch(() => undefined)
    } else if (sessionStorage.getItem(BUILD_RELOAD_KEY) !== served) {
      consola.debug('[PWA] reloading for build', served)
      sessionStorage.setItem(BUILD_RELOAD_KEY, served)
      window.location.reload()
    }
  }

  onRegisterError (e: unknown) {
    consola.error('[PWA] registration error', e)
  }

  updateServiceWorker () {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    this.updateSW && this.updateSW(true)
  }

  async mounted () {
    if (!import.meta.env.DEV) {
      document.addEventListener('visibilitychange', this.checkBuild)
      this.buildCheckTimer = window.setInterval(this.checkBuild, BUILD_CHECK_INTERVAL)
    }

    try {
      const { registerSW } = await import('virtual:pwa-register')

      this.updateSW = registerSW({
        immediate: true,
        onOfflineReady: this.onOfflineReady,
        onNeedRefresh: this.onNeedRefresh,
        onRegistered: this.onRegistered,
        onRegisterError: this.onRegisterError
      })
    } catch {
      consola.error('[PWA] disabled')
    }
  }

  beforeDestroy () {
    document.removeEventListener('visibilitychange', this.checkBuild)
    if (this.buildCheckTimer !== null) window.clearInterval(this.buildCheckTimer)
  }
}
</script>

<style lang="scss" scoped>
  :deep(.v-snack__wrapper .v-snack__content) {
    overflow: hidden;
    overflow-wrap: break-word;
  }
</style>
