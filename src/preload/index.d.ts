import type { AkisApi } from './index'

declare global {
  interface Window {
    akis: AkisApi
  }
}
