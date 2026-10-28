import type { ElembiApi } from './index'

declare global {
  interface Window {
    elembi: ElembiApi
  }
}
