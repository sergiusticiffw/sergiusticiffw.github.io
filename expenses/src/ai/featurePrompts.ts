import { aiText, L } from './aiLocale';
import type { DataPrompt } from './dataPrompts';
import {
  hasActiveFamilyMembership,
  type FamilyAiSnapshot,
} from './tools/familyTools';

const prompt = (
  kind: DataPrompt['kind'],
  texts: Parameters<typeof aiText>[0]
): DataPrompt => ({ kind, priority: 50, text: aiText(texts) });

/**
 * Questions for the Family tools. Each one is offered only when the data it
 * needs is really there (goals, other members, household totals).
 */
export const buildFamilyPrompts = (
  family: FamilyAiSnapshot | null
): DataPrompt[] => {
  if (!hasActiveFamilyMembership(family)) return [];
  const out: DataPrompt[] = [];
  const household = family!.totalsSource === 'rpc';
  const others = family!.members.some((member) => !member.isYou);

  out.push(
    prompt(
      'family',
      L(
        'Cât am cheltuit împreună pe categoriile comune luna aceasta?',
        'How much have we spent together on the shared categories this month?',
        'Сколько мы вместе потратили на общие категории в этом месяце?'
      )
    )
  );
  if (family.goals.length) {
    out.push(
      prompt(
        'family',
        L(
          'Am depășit limita familiei la vreo categorie luna aceasta?',
          'Have we gone over any family limit this month?',
          'Мы превысили какой-либо семейный лимит в этом месяце?'
        )
      ),
      prompt(
        'family',
        L(
          'Cât mai putem cheltui în familie până la sfârșitul lunii, pe fiecare limită?',
          'How much can we still spend as a family this month, per limit?',
          'Сколько мы ещё можем потратить семьёй в этом месяце по каждому лимиту?'
        )
      )
    );
  }
  if (household && others) {
    out.push(
      prompt(
        'family',
        L(
          'Cine a contribuit cel mai mult la categoriile comune?',
          'Who contributed the most to the shared categories?',
          'Кто больше всех вложился в общие категории?'
        )
      ),
      prompt(
        'family',
        L(
          'Ce a cheltuit familia ieri pe categoriile comune?',
          'What did the family spend yesterday on the shared categories?',
          'Сколько семья потратила вчера на общие категории?'
        )
      )
    );
  }
  if (household && others && family.incomeMemberTotals.length) {
    out.push(
      prompt(
        'family',
        L(
          'Care e ponderea mea din venitul comun al familiei?',
          'What is my share of the family income?',
          'Какова моя доля в общем доходе семьи?'
        )
      )
    );
  }
  if (family.activity.length || family.invites.length) {
    out.push(
      prompt(
        'family',
        L(
          'Ce s-a schimbat recent în familie?',
          'What changed recently in the family?',
          'Что недавно изменилось в семье?'
        )
      )
    );
  }
  return out;
};

/** Questions for the Net Worth tool, shown only when Net Worth is enabled. */
export const buildNetWorthPrompts = (options: {
  enabled: boolean;
  goalsEnabled: boolean;
  hasLoans: boolean;
}): DataPrompt[] => {
  if (!options.enabled) return [];
  const out: DataPrompt[] = [
    prompt(
      'netWorth',
      L(
        'Care e valoarea mea netă acum?',
        'What is my net worth right now?',
        'Каков мой чистый капитал сейчас?'
      )
    ),
    prompt(
      'netWorth',
      L(
        'Ce dețin și ce datorez?',
        'What do I own and what do I owe?',
        'Чем я владею и что должен?'
      )
    ),
  ];
  if (options.goalsEnabled) {
    out.push(
      prompt(
        'netWorth',
        L(
          'Cât din valoarea mea netă reprezintă fondul de urgență?',
          'How much of my net worth is the emergency fund?',
          'Какую часть моего чистого капитала составляет резервный фонд?'
        )
      )
    );
  }
  if (options.hasLoans) {
    out.push(
      prompt(
        'netWorth',
        L(
          'Cât din datorii sunt dobânzi viitoare?',
          'How much of what I owe is future interest?',
          'Какая часть моих долгов — это будущие проценты?'
        )
      )
    );
  }
  return out;
};
