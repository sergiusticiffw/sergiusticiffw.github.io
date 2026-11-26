import { AiLocalizedString, L } from './aiLocale';
import type { PromptKind } from './dataPrompts';

/** Curated “what the assistant can do” questions mixed into suggested prompts. */
export const CAPABILITY_PROMPTS: {
  kind: PromptKind;
  prompt: AiLocalizedString;
}[] = [
  {
    kind: 'expense',
    prompt: L(
      'Dacă cumpăr un covor, în ce categorie să-l pun?',
      'If I buy a carpet, which category should I put it in?'
    ),
  },
  {
    kind: 'expense',
    prompt: L(
      'Ajută-mă să categorisez: unde pun detergent, unde pun o lampă?',
      'Help me categorize: where do detergent and a lamp go?'
    ),
  },
  {
    kind: 'expense',
    prompt: L(
      'Am mai cumpărat ceva asemănător cu un covor?',
      'Have I bought something similar to a carpet before?'
    ),
  },
  {
    kind: 'expense',
    prompt: L(
      'Care sunt cheltuielile mele recurente sau abonamentele?',
      'What are my recurring expenses or subscriptions?'
    ),
  },
  {
    kind: 'expense',
    prompt: L(
      'Ce tag-uri am pe categoria Articole casnice?',
      'Which tags do I have on the Household category?'
    ),
  },
  {
    kind: 'expense',
    prompt: L(
      'Cum arată luna curentă față de media mea?',
      'How does this month look versus my usual average?'
    ),
  },
  {
    kind: 'expense',
    prompt: L(
      'Arată-mi un grafic cu cheltuielile mele lunare pe ultimele 12 luni.',
      'Show me a chart of my monthly spending over the last 12 months.'
    ),
  },
  {
    kind: 'expense',
    prompt: L(
      'Compară luna aceasta cu aceeași lună de anul trecut, pe categorii.',
      'Compare this month with the same month last year by category.'
    ),
  },
  {
    kind: 'expense',
    prompt: L(
      'Împarte-mi cheltuielile pe categorii pentru ultimele 12 luni.',
      'Break down my spending by category for the last 12 months.'
    ),
  },
  {
    kind: 'expense',
    prompt: L(
      'Arată-mi cele mai mari cheltuieli din luna aceasta, cu date și descrieri.',
      'Show my largest expenses this month with dates and descriptions.'
    ),
  },
  {
    kind: 'expense',
    prompt: L(
      'Sunt în buget luna aceasta? Cât mi-a rămas pe fiecare categorie?',
      'Am I on budget this month? Show remaining per category.'
    ),
  },
  {
    kind: 'expense',
    prompt: L(
      'La ce categorii am depășit bugetul și cât mi-a rămas la celelalte?',
      'Which categories am I overspending, and what is left in the others?'
    ),
  },
  {
    kind: 'expense',
    prompt: L(
      'Ce creșteri neobișnuite de cheltuieli am luna aceasta?',
      'What unusual spending spikes do I have this month?'
    ),
  },
  {
    kind: 'expense',
    prompt: L(
      'Care e cea mai lungă perioadă fără nicio cheltuială?',
      'What is the longest stretch with no expenses recorded?'
    ),
  },
  {
    kind: 'expense',
    prompt: L(
      'Care e luna cu cele mai multe zile fără cheltuieli?',
      'Which month has the most days without expenses?'
    ),
  },
  {
    kind: 'income',
    prompt: L(
      'Care e rata mea de economisire pe ultimele 12 luni și se îmbunătățește?',
      'What is my monthly savings rate over the last 12 months, and is it improving?'
    ),
  },
  {
    kind: 'income',
    prompt: L(
      'Cum au evoluat veniturile mele în ultimele 12 luni?',
      'How has my income evolved over the last 12 months?'
    ),
  },
  {
    kind: 'loan',
    prompt: L(
      'Rezumă-mi toate creditele: rest, dobândă, următoarea rată.',
      'Summarize all my loans: remaining, rate, next installment.'
    ),
  },
  {
    kind: 'loan',
    prompt: L(
      'Dă-mi detaliile creditului principal, inclusiv plățile următoare.',
      'Give me the details of my main loan, including upcoming payments.'
    ),
  },
  {
    kind: 'loan',
    prompt: L(
      'Ce se întâmplă dacă rambursez anticipat 10.000 azi — perioadă vs rată mai mică?',
      'What if I make a 10,000 early repayment today — term vs lower installment?'
    ),
  },
  {
    kind: 'loan',
    prompt: L(
      'Dacă adaug 1.000 în plus la fiecare rată, când termin creditul?',
      'If I add 1,000 extra to every installment, when do I finish the loan?'
    ),
  },
  {
    kind: 'loan',
    prompt: L(
      'Cât trebuie să plătesc în plus lunar ca să închid creditul cu 5 ani mai devreme?',
      'How much extra do I need each month to pay off the loan 5 years early?'
    ),
  },
  {
    kind: 'loan',
    prompt: L(
      'Ce se întâmplă dacă dobânda crește cu 2 puncte procentuale?',
      'What happens if the interest rate rises by 2 percentage points?'
    ),
  },
  {
    kind: 'loan',
    prompt: L(
      'Cât dobândă voi plăti în fiecare an până la finalul creditului?',
      'How much interest will I pay each year until the loan ends?'
    ),
  },
  {
    kind: 'loan',
    prompt: L(
      'Dacă am 5.000 pentru o plată anticipată, pe care credit merită să-i pun?',
      'If I have 5,000 for an early payment, which loan should I put it on?'
    ),
  },
  {
    kind: 'loan',
    prompt: L(
      'Merită să rambursez anticipat sau să pun banii la depozit cu 6%?',
      'Is it better to prepay the loan or put the money in a deposit at 6%?'
    ),
  },
  {
    kind: 'loan',
    prompt: L(
      'Cât timp și câtă dobândă am economisit deja din plățile anticipate?',
      'How much time and interest have my early payments already saved?'
    ),
  },
  {
    kind: 'loan',
    prompt: L(
      'Ce se întâmplă dacă rambursez anticipat în 2027 și dobânda se schimbă în 2028?',
      'What if I prepay in 2027 and the rate changes in 2028?'
    ),
  },
];
