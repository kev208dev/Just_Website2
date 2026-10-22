/** Verified public contact channels (taken from the original JUST website). */
export const SITE = {
  name: "JUST",
  concept: "JUST Digital Atelier",
  tagline: "From zero. To anything.",
  collective: "An independent creative technology collective.",
  description:
    "JUST는 아이디어를 발견하고, 실험하고, 기술로 실제 결과물을 만드는 창작 동아리입니다. 0에서 1을 창조합니다.",
  motto: "Journey starts from me",
  email: "start.justup@gmail.com",
  instagram: {
    handle: "@start_justup",
    url: "https://www.instagram.com/start_justup/",
  },
} as const;

export const NAV = [
  { label: "Work", href: "work" },
  { label: "About", href: "about" },
  { label: "People", href: "people" },
  { label: "Awards", href: "awards" },
  { label: "Contact", href: "contact" },
] as const;
