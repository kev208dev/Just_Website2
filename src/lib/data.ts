/**
 * Single source of truth for projects, members and awards.
 * Pages never duplicate data — they derive everything from these collections,
 * and records are cross-linked by slug / id / name.
 */
import projectsJson from "../data/projects.json";
import membersJson from "../data/members.json";
import awardsJson from "../data/awards.json";
import { asset, url } from "./paths";

export interface Project {
  slug: string;
  title: string;
  titleEn?: string;
  category: string;
  year: number | null;
  image: string | null;
  imageAlt: string | null;
  imageSize: [number, number] | null;
  accent: string;
  summary: string;
  problem: string | null;
  features: string[];
  stack: string[];
  members: string[];
  process: string | null;
  results: string | null;
  liveUrl: string | null;
  liveUrlLabel?: string;
  githubUrl: string | null;
  archive?: boolean;
}

export interface Member {
  id: string;
  name: string;
  generation: string;
  unit: string;
  role: string | null;
  nickname: string | null;
  easterEgg?: "spider-drop" | "flare";
  review?: string;
}

export type AwardTier = "grand" | "gold" | "silver" | "bronze" | "special" | "selection";

export interface Award {
  id: string;
  year: number | null;
  event: string;
  award: string | null;
  tier: AwardTier | null;
  institution: string | null;
  generations: string[];
  members: string[];
  project: string | null;
  source: string;
}

export const projects = projectsJson as unknown as Project[];
export const members = membersJson as unknown as Member[];
export const awards = awardsJson as unknown as Award[];

export const projectUrl = (slug: string) => url(`work/${slug}`);
export const projectImage = (p: Project) => (p.image ? asset(p.image) : null);

export function getProject(slug: string) {
  return projects.find((p) => p.slug === slug);
}

export function neighbours(slug: string) {
  const i = projects.findIndex((p) => p.slug === slug);
  return {
    prev: projects[(i - 1 + projects.length) % projects.length],
    next: projects[(i + 1) % projects.length],
  };
}

export const categories = Array.from(new Set(projects.map((p) => p.category)));

/* -------------------------------------------------------------- members */

export const GENERATION_ORDER = ["23기", "24기", "25기", "One Flap"];

export const generations = GENERATION_ORDER.filter((g) => members.some((m) => m.generation === g));

const memberByName = new Map(members.map((m) => [m.name, m]));
export const findMember = (name: string) => memberByName.get(name);

/* -------------------------------------------------------------- awards */

export const TIER_LABEL: Record<AwardTier, string> = {
  grand: "대상",
  gold: "최우수 · 금상",
  silver: "우수 · 은상",
  bronze: "장려 · 동상",
  special: "특별상",
  selection: "선정 · 본선",
};

export const TIER_ORDER: AwardTier[] = ["grand", "gold", "silver", "bronze", "special", "selection"];

export const awardsForMember = (name: string) => awards.filter((a) => a.members.includes(name));

export const awardsForProject = (slug: string) => awards.filter((a) => a.project === slug);

/** Records that carry a full citation (event, award, institution). */
export const detailedAwards = awards.filter((a) => a.award && a.institution);

export const featuredAwards = awards.filter((a) => a.year === 2025 && a.tier === "grand");

export const awardYears = Array.from(new Set(awards.map((a) => a.year))).sort((a, b) => (b ?? 0) - (a ?? 0));

export const awardGenerations = GENERATION_ORDER.filter((g) => awards.some((a) => a.generations.includes(g)));

/** Counts derived from the data — never hard-coded. */
export const stats = {
  projects: projects.length,
  members: members.length,
  generations: generations.length,
  awardRecords: awards.filter((a) => a.award).length,
  awards2025: awards.filter((a) => a.year === 2025).length,
  grandPrizes: awards.filter((a) => a.tier === "grand").length,
};
