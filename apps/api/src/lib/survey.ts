/**
 * Small deterministic helpers shared by the routes.
 */

export function generateId(): string {
  return crypto.randomUUID();
}

export type SurveyOption = {
  id: string;
  option_value: string | null;
  option_text: string;
  display_order: number;
};

export type SurveyCondition = {
  id: string;
  question_id: string;
  depends_on_question_id: string;
  condition_type: string;
  condition_value: string;
};

export type SurveyQuestion = {
  id: string;
  question_type: string;
  is_required: number;
  display_order: number;
  validation_rules: string | null;
  image_url: string | null;
  product_type: string | null;
  question_text: string;
  options: SurveyOption[];
  conditions: SurveyCondition[];
};

export type SurveyVersion = {
  id: string;
  title: string;
  description: string | null;
  product_id?: string;
};

export type SurveyConfigResult = {
  version: SurveyVersion | null;
  questions: SurveyQuestion[];
};

/**
 * Load a survey version and every question/option/condition with **three**
 * queries rather than the previous 1 + 2N (which the survey page polled every
 * 12 seconds). All rows are grouped in memory.
 */
export async function loadSurveyConfig(
  db: D1Database,
  lang: string,
  versionId?: string
): Promise<SurveyConfigResult> {
  const version = versionId
    ? await db
        .prepare(
          `SELECT id, title, description, product_id FROM survey_versions
           WHERE id = ? AND is_active = 1 LIMIT 1`
        )
        .bind(versionId)
        .first<SurveyVersion>()
    : await db
        .prepare(
          `SELECT id, title, description, product_id FROM survey_versions
           WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1`
        )
        .first<SurveyVersion>();

  if (!version) return { version: null, questions: [] };

  const [questionRows, optionRows, conditionRows] = await Promise.all([
    db
      .prepare(
        `SELECT q.id, q.question_type, q.is_required, q.display_order, q.validation_rules,
                q.image_url, q.product_type,
                COALESCE(qt.question_text, q.question_text) AS question_text
         FROM survey_questions q
         LEFT JOIN survey_question_translations qt
           ON q.id = qt.question_id AND qt.language = ?
         WHERE q.survey_version_id = ? AND q.is_active = 1
         ORDER BY q.display_order`
      )
      .bind(lang, version.id)
      .all<Record<string, unknown>>(),
    db
      .prepare(
        `SELECT o.id, o.question_id, o.option_value, o.display_order,
                COALESCE(ot.option_text, o.option_text) AS option_text
         FROM survey_options o
         JOIN survey_questions q ON q.id = o.question_id
         LEFT JOIN survey_option_translations ot
           ON o.id = ot.option_id AND ot.language = ?
         WHERE q.survey_version_id = ? AND q.is_active = 1 AND o.is_active = 1
         ORDER BY o.display_order`
      )
      .bind(lang, version.id)
      .all<Record<string, unknown>>(),
    db
      .prepare(
        `SELECT c.id, c.question_id, c.depends_on_question_id, c.condition_type, c.condition_value
         FROM survey_question_conditions c
         JOIN survey_questions q ON q.id = c.question_id
         WHERE q.survey_version_id = ? AND q.is_active = 1 AND c.is_active = 1`
      )
      .bind(version.id)
      .all<Record<string, unknown>>(),
  ]);

  const optionsByQuestion = new Map<string, SurveyOption[]>();
  for (const row of optionRows.results || []) {
    const list = optionsByQuestion.get(row.question_id as string) || [];
    list.push(row as unknown as SurveyOption);
    optionsByQuestion.set(row.question_id as string, list);
  }

  const conditionsByQuestion = new Map<string, SurveyCondition[]>();
  for (const row of conditionRows.results || []) {
    const list = conditionsByQuestion.get(row.question_id as string) || [];
    list.push(row as unknown as SurveyCondition);
    conditionsByQuestion.set(row.question_id as string, list);
  }

  const questions: SurveyQuestion[] = (questionRows.results || []).map((row) => ({
    ...(row as unknown as Omit<SurveyQuestion, 'options' | 'conditions'>),
    options: optionsByQuestion.get(row.id as string) || [],
    conditions: conditionsByQuestion.get(row.id as string) || [],
  }));

  return { version, questions };
}

export function getAgeGroup(age: number): string {
  if (age < 18) return 'under_18';
  if (age <= 24) return '18-24';
  if (age <= 34) return '25-34';
  if (age <= 44) return '35-44';
  if (age <= 54) return '45-54';
  return '55+';
}

export function isAnswerPresent(type: string | undefined, value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (type === 'multiple_choice') return Array.isArray(value) && value.length > 0;
  if (type === 'text' || type === 'long_text') return String(value).trim().length > 0;
  if (type === 'rating' || type === 'number') return value !== '' && !Number.isNaN(Number(value));
  if (Array.isArray(value)) return value.length > 0;
  return String(value).trim().length > 0;
}

/**
 * Weighted selection across eligible rewards. `winning_ratio` values are
 * treated as fixed percentages and the remaining probability mass is shared by
 * weight among the rest.
 */
export function buildWeightedPool<T extends { weight?: number | null; winning_ratio?: number | null }>(
  rewards: T[]
): { reward: T; weight: number }[] {
  const withRatio = rewards.filter((r) => r.winning_ratio != null);
  const withoutRatio = rewards.filter((r) => r.winning_ratio == null);
  if (withRatio.length === 0) {
    return rewards.map((reward) => ({ reward, weight: Number(reward.weight || 0) }));
  }
  const totalRatio = withRatio.reduce((sum, r) => sum + Number(r.winning_ratio), 0);
  const remaining = Math.max(0, 100 - totalRatio);
  const restWeight = withoutRatio.reduce((sum, r) => sum + Number(r.weight || 0), 0);
  return [
    ...withRatio.map((reward) => ({ reward, weight: Number(reward.winning_ratio) })),
    ...withoutRatio.map((reward) => ({
      reward,
      weight:
        restWeight > 0
          ? remaining * (Number(reward.weight || 0) / restWeight)
          : withoutRatio.length > 0
            ? remaining / withoutRatio.length
            : 0,
    })),
  ];
}

export type WeightedPoolEntry<T> = { reward: T; weight: number };

/** Pick an index from the pool proportional to weight; -1 when no mass. */
export function pickWeightedIndex<T>(pool: WeightedPoolEntry<T>[]): number {
  const total = pool.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  if (total <= 0) return -1;
  let random = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    random -= Math.max(0, pool[i].weight);
    if (random <= 0) return i;
  }
  return pool.length - 1;
}
