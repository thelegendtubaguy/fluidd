<template>
  <div
    v-if="warnings.length > 0"
    class="app-tltg-warning-banner"
    :style="{ top: `${$vuetify.application.top}px` }"
  >
    <v-alert
      v-for="warning in warnings"
      :key="`tltg-warning::${warning.id}`"
      :type="warning.level"
      :icon="warning.level === 'error' ? '$alertCircle' : '$warning'"
      class="app-tltg-warning-banner__item"
      dense
      tile
    >
      <div class="app-tltg-warning-banner__text">
        <strong class="app-tltg-warning-banner__title">{{ warning.title }}</strong>
        <span
          v-if="warning.message"
          class="app-tltg-warning-banner__message"
        >{{ warning.message }}</span>
        <a
          v-if="warning.url"
          :href="warning.url"
          target="_blank"
          rel="noopener noreferrer"
          class="app-tltg-warning-banner__link"
        >{{ $t('app.tltg_valve_oil.btn.report_board') }}</a>
        <router-link
          v-if="isValveOil(warning)"
          v-slot="{ href, navigate }"
          :to="valveOilSettings"
          custom
        >
          <a
            :href="href"
            class="app-tltg-warning-banner__link"
            @click="navigate"
          >{{ $t('app.tltg_valve_oil.btn.details') }}</a>
        </router-link>
      </div>
    </v-alert>
  </div>
</template>

<script lang="ts">
import { Component, Mixins } from 'vue-property-decorator'
import type { Location } from 'vue-router'
import StateMixin from '@/mixins/state'

// Warnings QIDI Max 4 Optimized reports through tltg_printer_warnings, shown under the app bar on
// every page for as long as the printer reports them, and kept under the bar while the page scrolls. Title and message are plain text from
// Klipper, so they are not rendered as HTML, and any warning id shows without changes here. A Valve Oil update warning
// links to the Valve Oil settings section, and a board warning's issue link (checked by tltgPrinterWarnings) opens it.
@Component
export default class AppTltgWarningBanner extends Mixins(StateMixin) {
  readonly valveOilSettings: Location = { name: 'settings', hash: '#valveOil' }

  isValveOil (warning: Klipper.TltgPrinterWarning): boolean {
    return warning.id.startsWith('valve_oil_')
  }

  get warnings (): Klipper.TltgPrinterWarning[] {
    if (!this.socketReady || !this.klippyReady) {
      return []
    }

    return this.$typedGetters['printer/getTltgPrinterWarnings']
  }
}
</script>

<style lang="scss" scoped>
  .app-tltg-warning-banner {
    position: sticky;
    // Above collapsable card titles (4), level with the app bar it sits under.
    z-index: 5;
  }

  .app-tltg-warning-banner__item {
    margin-bottom: 0;
  }

  .app-tltg-warning-banner__text {
    display: flex;
    flex-wrap: wrap;
    column-gap: 0.5em;
    overflow-wrap: anywhere;
  }

  .app-tltg-warning-banner__link {
    color: inherit;
    font-weight: 500;
    text-decoration: underline;
    white-space: nowrap;
  }
</style>
