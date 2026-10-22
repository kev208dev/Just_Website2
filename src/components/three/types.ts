import type { Quaternion, Vector3 } from "three";

/** Project data the gallery needs — serialised by the page and read on the client. */
export interface GalleryItem {
  index: number;
  slug: string;
  title: string;
  category: string;
  year: number | null;
  summary: string;
  href: string;
  /** Absolute (base-aware) URL of the thumbnail, or null for typographic cards. */
  image: string | null;
  imageAspect: number;
}

export type GalleryMode = "rings" | "spiral";

/** A physical card in the scene. Items are repeated across cards to fill the space. */
export interface CardSlot {
  /** global card index (0 … cardCount-1) — position in the spiral */
  index: number;
  /** item index (0 … itemCount-1) */
  item: number;
  /** ring index in the rings layout */
  ring: number;
  /** slot inside the ring */
  slot: number;
}

export interface CardTransform {
  position: Vector3;
  quaternion: Quaternion;
  scale: number;
  opacity: number;
}

export interface LayoutContext {
  /** continuous scroll position, measured in cards */
  offset: number;
  itemCount: number;
  cardCount: number;
  time: number;
}

export interface GalleryLayout {
  compute(card: CardSlot, ctx: LayoutContext, out: CardTransform): void;
}
