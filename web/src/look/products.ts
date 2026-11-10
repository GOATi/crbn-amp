// The CRBN products and the brand colour each keeps (D-CRBN-018, D-CRBN-019, D-CRBN-020, D-CRBN-021). `--brand` is fixed per product: it is
// where a person tells the apps apart in a hurry (the taskbar icon, the mark and name in the header, a `.brand-strip`,
// the Hub card). It is never the user's to change; `--accent` (the look's, then the user's) is. In Capsule, Holo and
// Daylight the brand colour is also the product's default accent; Redline keeps forge orange in every product.
// Hex cyan (#4fe3ff) stays Holo's live colour and forge orange (#ff3200) Redline's accent, so neither is a product's.
// Data only: `./themes.css` carries the same values as `:root[data-product]` blocks.

export type ProductId = 'livewire' | 'mixtape' | 'console' | 'press' | 'rig'

export interface Product {
  id: ProductId
  /** The name a user sees. */
  name: string
  /** The part after "CRBN" in the header's brand-name. */
  main: string
  /** The brand colour, and the ink that reads on it. */
  brand: string
  ink: string
  /** The app's identity in Pavillion Hub (pavillion_client D-237), which the product name never changes. */
  appId: string
  /** The repo that builds it. */
  repo: string
}

export const PRODUCTS: readonly Product[] = [
  { id: 'livewire', name: 'CRBN Livewire', main: 'Livewire', brand: '#f375b9', ink: '#1a0b14', appId: 'com.pavillionhub.crbn.photo', repo: 'GOATi/crbn-photo' },
  { id: 'mixtape', name: 'CRBN Mixtape', main: 'Mixtape', brand: '#c8ff3d', ink: '#15200a', appId: 'com.pavillionhub.crbn.audio', repo: 'GOATi/crbn-audio' },
  { id: 'console', name: 'CRBN Console', main: 'Console', brand: '#ffb340', ink: '#241600', appId: 'com.pavillionhub.crbn.sound', repo: 'GOATi/crbn-sound' },
  { id: 'press', name: 'CRBN Press', main: 'Press', brand: '#5b8cff', ink: '#0a1430', appId: 'com.pavillionhub.crbn.pdf', repo: 'GOATi/crbn-pdf' },
  { id: 'rig', name: 'CRBN Rig', main: 'Rig', brand: '#d92b52', ink: '#ffffff', appId: 'com.pavillionhub.crbn.amp', repo: 'GOATi/crbn-amp' },
]

/** The Hub's own colour, so the suite stays distinct from its host (Livewire's accent list calls it heliotrope). */
export const HUB_BRAND = '#a25aff'

export const productOf = (id: ProductId): Product => PRODUCTS.find((p) => p.id === id) ?? PRODUCTS[0]!
