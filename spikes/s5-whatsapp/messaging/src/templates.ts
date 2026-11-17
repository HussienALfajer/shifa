// Message templates (MSG-03 types, MSG-19 variants only): 3–5 Arabic wordings per type with a
// fixed placeholder set; free text is never sent. The variant is drawn from the seeded random
// source at enqueue time.

export interface Template {
  placeholders: readonly string[];
  variants: readonly string[];
}

export const TEMPLATES: Readonly<Record<string, Template>> = {
  appointment_reminder: {
    placeholders: ['name', 'date', 'time'],
    variants: [
      'مرحباً {name}، نذكّرك بموعدك في العيادة يوم {date} الساعة {time}.',
      '{name}، موعدك القادم يوم {date} عند الساعة {time}. نراك قريباً.',
      'تذكير لطيف يا {name}: لديك موعد يوم {date} الساعة {time}.',
      'أهلاً {name}، لا تنسَ موعدك يوم {date} في تمام الساعة {time}.',
    ],
  },
  appointment_confirmation: {
    placeholders: ['name', 'date', 'time'],
    variants: [
      'تم تأكيد موعدك يا {name} يوم {date} الساعة {time}.',
      '{name}، حجزك مؤكد: {date} الساعة {time}.',
      'أهلاً {name}، ثبّتنا موعدك يوم {date} عند الساعة {time}.',
    ],
  },
  delay_notice: {
    placeholders: ['name', 'minutes'],
    variants: [
      '{name}، نعتذر، الطبيب متأخر نحو {minutes} دقيقة.',
      'عذراً {name}، سيتأخر موعدك قرابة {minutes} دقيقة.',
      'تنبيه يا {name}: تأخير متوقع بحدود {minutes} دقيقة. شكراً لصبرك.',
    ],
  },
  optout_confirmation: {
    placeholders: [],
    variants: [
      'تم إيقاف رسائل واتساب من العيادة. أرسل أي رسالة لإعادة تفعيلها.',
      'لن تصلك رسائل واتساب منّا بعد الآن. لإعادة التفعيل أرسل لنا أي رسالة.',
      'أوقفنا رسائل واتساب كما طلبت. يمكنك إعادة تفعيلها بإرسال أي رسالة.',
    ],
  },
};

export class TemplateError extends Error {}

export function pickVariant(key: string, random: () => number): number {
  const template = TEMPLATES[key];
  if (!template) throw new TemplateError('unknown template');
  return Math.min(template.variants.length - 1, Math.floor(random() * template.variants.length));
}

/** Checks the key and the placeholder set (no missing, no extra) and renders the variant. */
export function render(
  key: string,
  variant: number,
  vars: Readonly<Record<string, string>>,
): string {
  const template = TEMPLATES[key];
  if (!template) throw new TemplateError('unknown template');
  const given = Object.keys(vars).sort();
  const expected = [...template.placeholders].sort();
  if (given.length !== expected.length || given.some((k, i) => k !== expected[i])) {
    throw new TemplateError('placeholder mismatch');
  }
  const text = template.variants[variant];
  if (text === undefined) throw new TemplateError('unknown template variant');
  return text.replace(/\{(\w+)\}/g, (_, name: string) => vars[name] ?? '');
}
