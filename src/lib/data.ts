import { getCollection, type CollectionEntry } from 'astro:content';
import site from '../content/site.json';
import membersSource from '../content/members.json';

export type Project = CollectionEntry<'projects'>;
export type Member = CollectionEntry<'members'>;
export type Award = CollectionEntry<'awards'>;
export type ArchiveEntry = CollectionEntry<'archive'>;

export { site };

export const GROUP_ORDER = ['23기', '24기', '25기', 'One Flap'];

export async function getProjects() {
  return (await getCollection('projects')).sort((a, b) => a.data.order - b.data.order);
}

export async function getMembers() {
  const members = await getCollection('members');
  // Keep the source-file order within each group (collections are keyed, not ordered).
  const order = new Map(membersSource.map((m, i) => [m.id, i]));
  return members.sort(
    (a, b) =>
      GROUP_ORDER.indexOf(a.data.group) - GROUP_ORDER.indexOf(b.data.group) ||
      (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
  );
}

export async function getAwards() {
  return (await getCollection('awards')).sort((a, b) => a.data.tier - b.data.tier || a.id.localeCompare(b.id));
}

export async function getArchive() {
  return (await getCollection('archive')).sort((a, b) => a.id.localeCompare(b.id));
}

/** Resolve award participant names to member ids where the member exists in members.json. */
export function linkParticipants(names: string[], members: Member[]) {
  return names.map((name) => {
    const member = members.find((m) => m.data.name === name);
    return { name, id: member?.id };
  });
}

/** Awards a member took part in, matched by name (the legacy data stores names only). */
export function awardsForMember(member: Member, awards: Award[]) {
  return awards.filter((a) => a.data.members.includes(member.data.name));
}

export const formatIndex = (i: number, pad = 2) => String(i + 1).padStart(pad, '0');
