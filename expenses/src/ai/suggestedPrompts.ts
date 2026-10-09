import type { DataPrompt, PromptKind } from './dataPrompts';

const LOAN_SIMULATION_PROMPTS = [
  'Cât timp am economisit din perioada creditului datorită plăților anticipate?',
  'Cu cât mi-a scăzut dobânda totală datorită plăților anticipate?',
  'Care plată anticipată a avut cel mai mare efect?',
  'Dacă plătesc 1.000 în plus la fiecare rată, când termin creditul?',
  'Cât trebuie să plătesc în plus lunar ca să închid creditul cu 5 ani mai devreme?',
  'Ce sumă trebuie să rambursez anticipat ca rata să scadă cu 20%?',
  'Ce se întâmplă dacă dobânda crește cu 2 puncte procentuale?',
  'Merită să refinanțez la o dobândă cu 1% mai mică, cu un comision de 5.000?',
  'Mai bine rambursez anticipat sau pun banii la depozit cu 6%?',
  'Cât dobândă voi plăti în fiecare an până la final?',
  'De când începe principalul să fie mai mare decât dobânda în rată?',
  'Când ajung să am jumătate din credit achitat?',
  'E mai bine să reduc perioada sau rata la o plată anticipată?',
];

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

  // More expenses
  'Cât am cheltuit în ultimele 30 de zile?',
  'Compară ultimele 3 luni între ele',
  'Ce categorie a scăzut cel mai mult anul acesta?',
  'Cât cheltui pe utilități iarna față de vară?',
  'Cât am dat pe familie în ultimul an?',
  'Cât cheltui pe produse pentru casă, pe lună?',
  'Care a fost cea mai scumpă săptămână din an?',
  'Cât cheltui, în medie, într-o zi lucrătoare?',
  'Ce categorie mi-a luat cel mai mult din buget în ultimul trimestru?',
  'Cât ar însemna să reduc fiecare categorie cu 10%?',
  'Ce buget să-mi pun pe luna viitoare, pe categorii?',
  'În ce lună am făcut cele mai multe cumpărături?',
  'Cât m-au costat sărbătorile anul trecut?',
  'Cât cheltui pe transport față de mâncare?',
  'Care e ziua din lună în care cheltui cel mai mult?',
  'Am vreo categorie care s-a dublat în ultimul an?',
  'Cât din cheltuieli sunt sume mici, sub 100?',
  'Care lună a avut cele mai puține tranzacții?',
  'Cât cheltui pe sănătate față de acum 2 ani?',
  'Ce cheltuieli aș putea tăia fără să observ?',
  'Cât m-au costat ieșirile în oraș în ultimele 6 luni?',
  'Cheltuiesc mai mult în weekend sau în timpul săptămânii?',
  'Cât am cheltuit pe cadouri de Crăciun, în fiecare an?',
  'Care categorie îmi ia cel mai mult dintr-un salariu?',
  'Cât de mult variază cheltuielile mele de la lună la lună?',
  'Ce lună din an e, de obicei, cea mai liniștită?',
  'Câte zile pe lună nu cheltui nimic?',
  'Care sunt cheltuielile recurente pe care le pot renegocia?',
  'Cât cheltui pe haine primăvara față de toamnă?',
  'Cât am cheltuit pe investiții anul acesta?',

  // More income
  'Care lună a avut venitul cel mai mic?',
  'Cât de stabil e venitul meu de la o lună la alta?',
  'În ce an am câștigat cel mai mult?',
  'Cât am pus deoparte, în medie, pe lună?',
  'Venitul meu acoperă un fond de urgență de 3 luni?',
  'Cum arată venitul din ultimele 3 luni față de anul trecut?',
  'Ce sursă de venit a crescut cel mai mult?',
  'Cât la sută din venit economisesc, de fapt?',
  'Am luni fără niciun venit?',
  'Dacă venitul rămâne la fel, cât pot pune deoparte anul viitor?',
  'Care e diferența dintre luna cu cel mai mare și cel mai mic venit?',
  'Cât din venit se duce pe cheltuieli fixe?',
  'Veniturile ocazionale contează mult în total?',
  'Cum a evoluat venitul mediu în ultimele 12 luni?',
  'Cât ar trebui să câștig ca să economisesc 20%?',
  'În ce trimestru câștig cel mai mult?',
  'Venitul crește mai ales din salariu sau din alte surse?',
  'Cât am câștigat anul acesta față de anul trecut?',
  'Care e venitul meu mediu pe zi?',
  'Dacă nu mai am venituri extra, îmi ajunge salariul?',

  // More loans
  'Cât dobândă mai am de plătit până la finalul creditelor?',
  'Ce procent din venitul meu se duce pe rate?',
  'Dacă plătesc o rată în plus pe an, cu cât termin mai repede?',
  'Care credit are dobânda cea mai mare?',
  'Cât am plătit deja în principal față de dobândă?',
  'Cum arată progresul la fiecare credit?',
  'Cât mă costă creditele pe an, în total?',
  'Merită să refinanțez vreun credit?',
  'Ce se întâmplă cu bugetul dacă rata crește cu 10%?',
  'Cât din rata lunară e dobândă și cât e principal?',
  'În ce lună am avut cea mai mare plată la credit?',
  'Cât aș plăti în plus dacă prelungesc perioada?',
  'Care e costul total al creditului, cu tot cu dobândă?',
  'Câte rate mai am până se termină?',
  'Am făcut plăți mai devreme decât scadența?',
  'Cât rămâne de plătit peste un an, în ritmul actual?',
  'Pe care credit ar trebui să pun banii în plus?',
  'Cum s-ar schimba rata dacă aș rambursa 10.000 acum?',
  'Cât dobândă plătesc anul acesta la toate creditele?',
  'Ratele mele cresc sau scad în timp?',
  ...LOAN_SIMULATION_PROMPTS,
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
  'Cât dobândă mai am de plătit până la finalul creditelor?',
  'Ce procent din venitul meu se duce pe rate?',
  'Dacă plătesc o rată în plus pe an, cu cât termin mai repede?',
  'Care credit are dobânda cea mai mare?',
  'Cât am plătit deja în principal față de dobândă?',
  'Cum arată progresul la fiecare credit?',
  'Cât mă costă creditele pe an, în total?',
  'Merită să refinanțez vreun credit?',
  'Ce se întâmplă cu bugetul dacă rata crește cu 10%?',
  'Cât din rata lunară e dobândă și cât e principal?',
  'În ce lună am avut cea mai mare plată la credit?',
  'Cât aș plăti în plus dacă prelungesc perioada?',
  'Care e costul total al creditului, cu tot cu dobândă?',
  'Câte rate mai am până se termină?',
  'Am făcut plăți mai devreme decât scadența?',
  'Cât rămâne de plătit peste un an, în ritmul actual?',
  'Pe care credit ar trebui să pun banii în plus?',
  'Cum s-ar schimba rata dacă aș rambursa 10.000 acum?',
  'Cât dobândă plătesc anul acesta la toate creditele?',
  'Ratele mele cresc sau scad în timp?',
  ...LOAN_SIMULATION_PROMPTS,
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
  'Care lună a avut venitul cel mai mic?',
  'Cât de stabil e venitul meu de la o lună la alta?',
  'În ce an am câștigat cel mai mult?',
  'Cât am pus deoparte, în medie, pe lună?',
  'Venitul meu acoperă un fond de urgență de 3 luni?',
  'Cum arată venitul din ultimele 3 luni față de anul trecut?',
  'Ce sursă de venit a crescut cel mai mult?',
  'Cât la sută din venit economisesc, de fapt?',
  'Am luni fără niciun venit?',
  'Dacă venitul rămâne la fel, cât pot pune deoparte anul viitor?',
  'Care e diferența dintre luna cu cel mai mare și cel mai mic venit?',
  'Cât din venit se duce pe cheltuieli fixe?',
  'Veniturile ocazionale contează mult în total?',
  'Cum a evoluat venitul mediu în ultimele 12 luni?',
  'Cât ar trebui să câștig ca să economisesc 20%?',
  'În ce trimestru câștig cel mai mult?',
  'Venitul crește mai ales din salariu sau din alte surse?',
  'Cât am câștigat anul acesta față de anul trecut?',
  'Care e venitul meu mediu pe zi?',
  'Dacă nu mai am venituri extra, îmi ajunge salariul?',
]);

const genericKind = (text: string): PromptKind => {
  if (LOAN_GENERIC.has(text)) return 'loan';
  if (INCOME_GENERIC.has(text)) return 'income';
  return 'expense';
};

const poolFor = (kind: PromptKind, dataPrompts: DataPrompt[]): SuggestedPrompt[] => {
  const byText = new Map<string, SuggestedPrompt>();
  for (const prompt of dataPrompts) {
    if (prompt.kind === kind) byText.set(prompt.text, { text: prompt.text, personal: true, kind });
  }
  if (kind === 'loan' && !dataPrompts.some((prompt) => prompt.kind === 'loan')) return [];
  for (const text of SUGGESTED_PROMPTS) {
    if (genericKind(text) !== kind || byText.has(text)) continue;
    byText.set(text, { text, personal: false, kind });
  }
  return shuffle([...byText.values()]);
};

const takeNext = (
  pools: Map<PromptKind, SuggestedPrompt[]>,
  order: PromptKind[],
  blocked: Set<string>,
  count: number,
  picked: SuggestedPrompt[]
) => {
  let added = true;
  while (picked.length < count && added) {
    added = false;
    for (const kind of order) {
      if (picked.length >= count) break;
      const prompt = (pools.get(kind) || []).find((item) => !blocked.has(item.text));
      if (!prompt) continue;
      blocked.add(prompt.text);
      picked.push(prompt);
      added = true;
    }
  }
};

/**
 * Six questions, drawn at random and mixed across expenses, income and loans.
 * Questions already shown are skipped until every question of that mix has
 * been used once; then the cycle starts again, still without repeating inside
 * the new batch. Loan questions appear only when the user actually has loans.
 */
export const pickSuggestedPrompts = (
  dataPrompts: DataPrompt[] = [],
  count = 6,
  seen: ReadonlySet<string> = new Set()
): { prompts: SuggestedPrompt[]; seen: Set<string> } => {
  const hasLoans = dataPrompts.some((prompt) => prompt.kind === 'loan');
  const kinds: PromptKind[] = hasLoans
    ? ['expense', 'income', 'loan']
    : ['expense', 'income'];
  const start = Math.floor(Math.random() * kinds.length);
  const order = [...kinds.slice(start), ...kinds.slice(0, start)];
  const pools = new Map(kinds.map((kind) => [kind, poolFor(kind, dataPrompts)]));

  const picked: SuggestedPrompt[] = [];
  takeNext(pools, order, new Set(seen), count, picked);

  if (picked.length < count) {
    const inBatch = new Set(picked.map((prompt) => prompt.text));
    takeNext(pools, order, inBatch, count, picked);
    return { prompts: picked, seen: new Set(picked.map((prompt) => prompt.text)) };
  }

  return {
    prompts: picked,
    seen: new Set([...seen, ...picked.map((prompt) => prompt.text)]),
  };
};
