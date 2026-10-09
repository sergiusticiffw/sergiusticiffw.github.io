import type { DataPrompt, PromptKind } from './dataPrompts';

export const SUGGESTED_PROMPTS = [
  // Current month
  'Cum arată luna curentă față de media mea?',
  'Cât voi cheltui până la sfârșitul lunii, în ritmul actual?',
  'Ce categorie a crescut cel mai mult luna aceasta?',
  'Care au fost cele mai mari 5 cheltuieli luna aceasta?',
  'Sunt pe drumul cel bun să economisesc luna aceasta?',
  'Ce cheltuieli neobișnuite am avut luna aceasta?',
  'Compară luna aceasta cu aceeași lună de anul trecut',

  // Saving
  'Unde pot economisi 2000 luna viitoare?',
  'Care sunt abonamentele mele și cât mă costă pe an?',
  'Ce cheltuieli mici, dar frecvente, mă costă cel mai mult?',
  'Ce categorie ar trebui să reduc prima?',
  'Fă-mi un buget lunar realist pe categorii',
  'Câți bani aș economisi pe an dacă reduc mâncarea în oraș la jumătate?',
  'Ce rată de economisire am avut în fiecare an?',
  'În ce luni am cheltuit mai mult decât am câștigat?',

  // Trends
  'Care a fost cea mai scumpă lună și de ce?',
  'Care a fost cea mai ieftină lună din ultimii 2 ani?',
  'Cum au evoluat cheltuielile mele lunare în ultimii 5 ani?',
  'Ce categorii cresc constant de la an la an?',
  'Cheltuiesc mai mult vara sau iarna?',
  'Cât de mult au crescut costurile la utilități în timp?',
  'Cum s-a schimbat media zilnică a cheltuielilor de-a lungul anilor?',
  'Care e trendul cheltuielilor mele în ultimele 6 luni?',

  // Categories
  'Cât am cheltuit pe mâncare anul acesta vs anul trecut?',
  'Cât mă costă transportul pe lună, în medie?',
  'Cât am cheltuit pe călătorii în fiecare an?',
  'Cât am investit în total și cum a evoluat pe ani?',
  'Cât am cheltuit pe sănătate în ultimul an?',
  'Cât cheltui pe haine, în medie, pe an?',
  'Cât am dat pe cadouri în fiecare an?',
  'Ce pondere au cheltuielile pe locuință din total?',
  'Cât am cheltuit pe distracție în ultimele 12 luni?',

  // Habits
  'În ce zi a săptămânii cheltui cel mai mult?',
  'La ce magazine las cei mai mulți bani?',
  'Care sunt cele mai frecvente cheltuieli ale mele?',
  'Ce hashtag-uri mă costă cel mai mult?',
  'Cât cheltui de obicei într-un weekend?',
  'Câte tranzacții fac, în medie, pe lună?',
  'Care a fost cea mai mare cheltuială din istoric?',
  'Am cheltuieli care se repetă lunar cu aceeași sumă?',

  // Loans
  'Cât mai am de plătit la credite?',
  'Care e următoarea rată și când trebuie plătită?',
  'Cât dobândă am plătit până acum la credite?',
  'Cât aș economisi dacă aș rambursa anticipat?',
  'Cum arată ratele mele față de cheltuielile lunare?',
  'Cât plătesc pe lună la toate creditele?',
  'Când se termină creditul dacă păstrez ritmul actual?',

  // Income
  'Cum au evoluat veniturile mele pe ani?',
  'Care sunt principalele mele surse de venit?',
  'Ce procent din venit cheltui, în medie?',
  'În ce lună am avut cel mai mare venit?',
  'Cât am economisit în total în ultimii 5 ani?',
  'Veniturile mele cresc mai repede decât cheltuielile?',

  // Fun / overview
  'Fă-mi un rezumat al anului trecut',
  'Ce ar spune un consultant financiar despre cheltuielile mele?',
  'Care sunt 3 lucruri pe care le fac bine cu banii?',
  'Care sunt 3 obiceiuri care mă costă cel mai mult?',
  'Dacă păstrez ritmul actual, cât voi economisi până la sfârșitul anului?',

  // Seasons
  'Cât cheltui în decembrie față de restul anului?',
  'Cât mă costă vacanțele de vară, în fiecare an?',
  'Cum arată luna ianuarie după sărbători, comparativ cu alte luni?',

  // What if
  'Dacă aș investi lunar ce cheltui pe distracție, cât aș avea în 5 ani?',
  'În cât timp aș strânge 50.000 cu ritmul actual de economisire?',
  'Ce s-ar întâmpla cu economiile mele dacă venitul scade cu 20%?',

  // Records
  'Care a fost cea mai lungă perioadă fără cheltuieli mari?',
  'Care a fost cea mai scumpă zi din istoric?',
  'Ce lună a fost cea mai echilibrată între venituri și cheltuieli?',

  // Year over year
  'Cu cât mai mult cheltui acum pe mâncare decât acum 5 ani?',
  'Care an a fost cel mai bun financiar și de ce?',
  'Ce s-a schimbat cel mai mult în cheltuielile mele în ultimii 3 ani?',

  // Planning
  'Cât pot cheltui pe zi până la sfârșitul lunii ca să rămân în medie?',
  'Ce buget ar trebui să am pentru călătorii anul viitor?',
  'Cât ar trebui să economisesc lunar ca să am un fond de urgență de 6 luni?',
  'Care e suma minimă de care am nevoie lunar ca să-mi acopăr cheltuielile de bază?',
  'Ce cheltuieli aș putea amâna luna viitoare fără să-mi afecteze traiul?',

  // Behaviour
  'Cheltuiesc mai mult la început sau la sfârșit de lună?',
  'Cât de des fac cheltuieli impulsive, de sume mari, neplanificate?',
  'Am luni în care cheltui mult mai mult după ce primesc venitul?',

  // Comparisons
  'Cum arată primul semestru față de al doilea, în fiecare an?',
  'Care e diferența dintre cea mai scumpă și cea mai ieftină lună din acest an?',

  // Overview
  'Dă-mi o notă de la 1 la 10 pentru cum gestionez banii și explică de ce',
  'Ce tendință din cheltuielile mele ar trebui să mă îngrijoreze?',
];

const shuffle = <T,>(list: T[]): T[] => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export interface SuggestedPrompt {
  text: string;
  personal: boolean;
  kind: PromptKind;
}

const LOAN_GENERIC = new Set([
  'Cât mai am de plătit la credite?',
  'Care e următoarea rată și când trebuie plătită?',
  'Cât dobândă am plătit până acum la credite?',
  'Cât aș economisi dacă aș rambursa anticipat?',
  'Cum arată ratele mele față de cheltuielile lunare?',
  'Cât plătesc pe lună la toate creditele?',
  'Când se termină creditul dacă păstrez ritmul actual?',
]);

const INCOME_GENERIC = new Set([
  'În ce luni am cheltuit mai mult decât am câștigat?',
  'Cum au evoluat veniturile mele pe ani?',
  'Care sunt principalele mele surse de venit?',
  'Ce procent din venit cheltui, în medie?',
  'În ce lună am avut cel mai mare venit?',
  'Cât am economisit în total în ultimii 5 ani?',
  'Veniturile mele cresc mai repede decât cheltuielile?',
  'Ce s-ar întâmpla cu economiile mele dacă venitul scade cu 20%?',
  'Ce lună a fost cea mai echilibrată între venituri și cheltuieli?',
  'Am luni în care cheltui mult mai mult după ce primesc venitul?',
]);

const genericKind = (text: string): PromptKind => {
  if (LOAN_GENERIC.has(text)) return 'loan';
  if (INCOME_GENERIC.has(text)) return 'income';
  return 'expense';
};

const ranked = (prompts: DataPrompt[]) =>
  prompts
    .map((prompt) => ({ prompt, score: prompt.priority + Math.random() * 2 }))
    .sort((a, b) => b.score - a.score)
    .map(({ prompt }) => prompt);

/**
 * Six questions, taken in turn from expenses, income and loans so one topic
 * does not fill the list. Data-based questions come first; generic ones fill
 * a topic only when the data did not produce one. Loan questions appear only
 * when the user actually has loans.
 */
export const pickSuggestedPrompts = (dataPrompts: DataPrompt[] = [], count = 6): SuggestedPrompt[] => {
  const hasLoans = dataPrompts.some((prompt) => prompt.kind === 'loan');
  const kinds: PromptKind[] = hasLoans
    ? ['expense', 'income', 'loan']
    : ['expense', 'income'];
  const start = Math.floor(Math.random() * kinds.length);
  const order = [...kinds.slice(start), ...kinds.slice(0, start)];

  const personal = new Map<PromptKind, DataPrompt[]>();
  const generic = new Map<PromptKind, string[]>();
  for (const kind of kinds) {
    personal.set(kind, ranked(dataPrompts.filter((prompt) => prompt.kind === kind)));
    generic.set(
      kind,
      shuffle(SUGGESTED_PROMPTS.filter((text) => genericKind(text) === kind))
    );
  }

  const picked: SuggestedPrompt[] = [];
  const used = new Set<string>();
  const nextOf = (kind: PromptKind): SuggestedPrompt | null => {
    const own = personal.get(kind) || [];
    const match = own.find((prompt) => !used.has(prompt.text));
    if (match) return { text: match.text, personal: true, kind };
    if (kind === 'loan' && !hasLoans) return null;
    const fallback = (generic.get(kind) || []).find((text) => !used.has(text));
    return fallback ? { text: fallback, personal: false, kind } : null;
  };

  while (picked.length < count) {
    let added = false;
    for (const kind of order) {
      if (picked.length >= count) break;
      const prompt = nextOf(kind);
      if (!prompt) continue;
      used.add(prompt.text);
      picked.push(prompt);
      added = true;
    }
    if (!added) break;
  }
  return picked;
};
