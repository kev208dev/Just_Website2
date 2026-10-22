import { triggerFlashbang, triggerSpiderDrop } from './easter-eggs';

interface PersonData {
  id: string;
  name: string;
  group: string;
  dept?: string;
  role?: string;
  nickname?: string;
  easterEgg?: 'spider-drop' | 'flashbang';
  awards: { id: string; event: string; grade: string; year: number }[];
}

export function initPeople() {
  const root = document.querySelector<HTMLElement>('[data-people]');
  if (!root) return;
  const people: PersonData[] = JSON.parse(document.querySelector('[data-people-data]')!.textContent || '[]');
  const config = JSON.parse(document.querySelector('[data-people-config]')!.textContent || '{}');
  const byId = new Map(people.map((p) => [p.id, p]));

  // ---- Filters ----
  const chips = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-group]'));
  const blocks = Array.from(root.querySelectorAll<HTMLElement>('[data-group-block]'));
  chips.forEach((chip) =>
    chip.addEventListener('click', () => {
      const g = chip.dataset.group!;
      chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      blocks.forEach((b) => b.classList.toggle('is-hidden', g !== 'all' && b.dataset.groupBlock !== g));
    }),
  );

  // ---- Nickname easter egg (legacy behaviour: double-click a name) ----
  const toggleNickname = (card: HTMLElement) => {
    const nick = card.dataset.nickname;
    if (!nick) return false;
    const label = card.querySelector<HTMLElement>('[data-name-label]')!;
    const on = card.classList.toggle('is-nick');
    label.textContent = on ? nick : card.dataset.name!;
    if (card.dataset.egg === 'spider-drop') triggerSpiderDrop(card, config.spider);
    if (card.dataset.egg === 'flashbang') triggerFlashbang(card, root.querySelector('h1') ?? undefined);
    return on;
  };

  // ---- Profile panel ----
  const dialog = document.querySelector<HTMLDialogElement>('[data-profile]')!;
  const el = <T extends HTMLElement>(sel: string) => dialog.querySelector<T>(sel)!;
  const nickBtn = el<HTMLButtonElement>('[data-profile-nick]');
  let openCard: HTMLElement | null = null;

  const open = (id: string, card: HTMLElement | null) => {
    const p = byId.get(id);
    if (!p) return;
    openCard = card;
    el('[data-profile-meta]').textContent = [p.group, p.dept].filter(Boolean).join(' · ');
    el('[data-profile-name]').textContent = card?.classList.contains('is-nick') && p.nickname ? p.nickname : p.name;
    el('[data-profile-role]').textContent = p.role ?? `${p.group} 멤버`;
    nickBtn.hidden = !p.nickname;
    nickBtn.setAttribute('aria-pressed', String(!!card?.classList.contains('is-nick')));
    nickBtn.textContent = card?.classList.contains('is-nick') ? '이름 보기' : '별명 보기';
    const list = el('[data-profile-awards]');
    el('[data-profile-awards-wrap]').hidden = p.awards.length === 0;
    list.replaceChildren(
      ...p.awards.map((a) => {
        const li = document.createElement('li');
        const link = document.createElement('a');
        link.href = `${config.awards}#${a.id}`;
        const event = document.createElement('span');
        event.textContent = `${a.year} · ${a.event}`;
        const grade = document.createElement('span');
        grade.className = 'grade';
        grade.textContent = a.grade;
        link.append(event, grade);
        li.append(link);
        return li;
      }),
    );
    dialog.showModal();
    const url = new URL(location.href);
    url.searchParams.set('member', id);
    history.replaceState(null, '', url);
  };

  const close = () => dialog.close();
  dialog.addEventListener('close', () => {
    const url = new URL(location.href);
    url.searchParams.delete('member');
    history.replaceState(null, '', url);
    openCard?.focus();
  });
  el('[data-profile-close]').addEventListener('click', close);
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close();
  });
  nickBtn.addEventListener('click', () => {
    if (!openCard) return;
    const on = toggleNickname(openCard);
    const p = byId.get(openCard.dataset.person!)!;
    el('[data-profile-name]').textContent = on ? p.nickname! : p.name;
    nickBtn.setAttribute('aria-pressed', String(on));
    nickBtn.textContent = on ? '이름 보기' : '별명 보기';
  });

  // Single click opens the profile; a double click toggles the nickname instead.
  let clickTimer = 0;
  root.querySelectorAll<HTMLButtonElement>('[data-person]').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.detail > 1) return;
      window.clearTimeout(clickTimer);
      if (e.detail === 0) return open(card.dataset.person!, card); // keyboard activation
      clickTimer = window.setTimeout(() => open(card.dataset.person!, card), 240);
    });
    card.addEventListener('dblclick', () => {
      window.clearTimeout(clickTimer);
      toggleNickname(card);
    });
  });

  // Deep link: /people/?member=<id>
  const initial = new URLSearchParams(location.search).get('member');
  if (initial && byId.has(initial)) {
    open(initial, root.querySelector<HTMLElement>(`[data-person="${CSS.escape(initial)}"]`));
  }
}
