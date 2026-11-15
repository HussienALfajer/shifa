// Refusal and conflict codes with the Arabic text staff see (strings inline: throwaway spike).
export const MESSAGES = {
  invalid_command: 'الطلب غير صالح ولم يُنفَّذ.',
  forbidden: 'هذا الإجراء غير مسموح لهذا الحساب.',
  unknown_reference: 'السجل المطلوب غير موجود في هذا الفرع.',
  duplicate_id: 'هذا السجل موجود مسبقاً.',
  appointment_overlap: 'الموعد يتعارض مع موعد آخر للطبيب نفسه، ولم يُحجز.',
  invalid_slot: 'وقت نهاية الموعد يجب أن يكون بعد وقت بدايته.',
  offline_cash_type:
    'أثناء انقطاع الإنترنت يُسمح بالبيع والاسترداد فقط. أعد المحاولة بعد عودة الاتصال.',
  offline_cash_open: 'لا يمكن فتح الصندوق دون اتصال بالإنترنت.',
  offline_cash_close: 'لا يمكن إغلاق الصندوق دون اتصال بالإنترنت.',
  offline_rate: 'سعر الصرف لا يطابق آخر سعر متزامن لهذا الصندوق.',
  session_closed: 'الصندوق مغلق أو غير موجود.',
  refund_without_sale: 'الاسترداد يجب أن يرتبط بعملية بيع بالعملة نفسها.',
  refund_exceeds_sale: 'مبلغ الاسترداد أكبر من المتبقي من عملية البيع.',
} as const;

export type ReasonCode = keyof typeof MESSAGES;

/** Raised by a rule to refuse a command; the handler stores it as the command's result. */
export class Refusal extends Error {
  constructor(readonly code: ReasonCode) {
    super(code);
    this.name = 'Refusal';
  }
}
