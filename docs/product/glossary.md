# Glossary (English ↔ Arabic)

Status: Draft · Last updated: 2026-11-08 · Owner: product owner
Sources: owner conversation 2026-11-07/08, [RN-03 §6], [RN-07], [RN-08], [RN-09], [RN-12], [RN-13], [RN-15]

Purpose: one shared vocabulary for code, docs and the Arabic UI. Code and docs use the English term (identifiers in English); the UI uses the Arabic term. Preferred Syrian wording is marked; items marked "(validate)" must be checked with clinics in Aleppo and Azaz before UI copy is frozen.

## Platform and organisation
| English (code/docs) | Arabic (UI) | Notes |
|---|---|---|
| Platform | المنصة | |
| Super admin | مدير المنصة | Platform operator, not a clinic role |
| Tenant | حساب العيادة | "Tenant" is internal; UI never shows مستأجر |
| Organization | العيادة / المركز الطبي | |
| Branch | الفرع | |
| Room | الغرفة / العيادة رقم | Voice calls say "العيادة ٢" by default |
| Dental chair | كرسي الأسنان | |
| Edition (solo / clinic / group) | الباقة: طبيب منفرد / عيادة / مجمّع | Commercial naming pending (OD-07) |
| Entitlement | ميزة مفعّلة في الباقة | |
| Feature flag | مفتاح ميزة | Internal |
| Setting | إعداد | |
| Custom field | حقل مخصّص | |
| Specialty pack | حزمة الاختصاص | |
| Template | قالب | |
| Audit log | سجل التدقيق | |
| Support access | دخول الدعم الفني | |

## People and roles
| English | Arabic | Notes |
|---|---|---|
| Practitioner / doctor | الطبيب | |
| Dentist | طبيب الأسنان | |
| Orthopedic surgeon | طبيب العظام / جرّاح العظام | Syrian usage: "طبيب عظمية" common colloquially (validate) |
| Receptionist | السكرتيرة / موظف الاستقبال | "السكرتيرة" is the everyday Syrian term |
| Assistant / nurse | المساعد / الممرّض | |
| Accountant | المحاسب | |
| Clinic owner | صاحب العيادة | |
| Patient | المريض / المراجع | "مراجع" used for visitors |
| Dependent (family member) | فرد من العائلة | |
| Guardian | وليّ الأمر | |
| Verified doctor badge | طبيب موثّق | |

## Scheduling and queue
| English | Arabic | Notes |
|---|---|---|
| Appointment | موعد | |
| Booking | حجز | |
| Queue | الدور | "نظام الدور" — Syrian/Levantine core concept |
| Queue number / ticket | رقم الدور / بطاقة الدور | |
| Walk-in | مراجع بدون موعد | |
| Check-in / arrived | وصل | |
| Waiting | ينتظر | |
| In consultation | داخل | |
| Done | انتهى | |
| No-show | لم يحضر | |
| Cancelled | ملغى | |
| Follow-up visit | مراجعة | |
| Consultation (examination) | معاينة | Syria: "معاينة"; Egypt/Jordan: "كشف/كشفية" |
| Consultation fee | أجرة المعاينة | (validate) |
| Delay notice | إشعار تأخير | |
| Waiting-room display | شاشة الانتظار | |
| Voice calling | النداء الصوتي | |
| Call next | التالي | |
| Recall (call again) | إعادة النداء | |
| Working hours / shift | الدوام / الفترة | Morning/evening: فترة صباحية / مسائية |

## Clinical (general)
| English | Arabic | Notes |
|---|---|---|
| Visit / encounter | زيارة | |
| Chief complaint | الشكوى الرئيسية | |
| History | القصة المرضية | |
| Examination | الفحص السريري | |
| Diagnosis | التشخيص | |
| Plan | الخطة العلاجية | |
| Vital signs | العلامات الحيوية | |
| Allergy | حساسية | |
| Chronic disease | مرض مزمن | |
| Prescription | وصفة طبية | Syria: "وصفة"; Egypt: "روشتة" |
| Medical report | تقرير طبي | |
| Sick leave | إجازة مرضية | |
| Referral letter | رسالة إحالة | |
| Consent form | نموذج موافقة | |
| Attachment | مرفق | |
| Signed note / addendum | ملاحظة موقّعة / ملحق | |

## Imaging
| English | Arabic | Notes |
|---|---|---|
| X-ray | صورة شعاعية | Syrian usage; Gulf often "أشعة" |
| Panoramic X-ray | صورة بانورامية | |
| CT | طبقي محوري | Syrian usage |
| CBCT | تصوير مقطعي مخروطي (CBCT) | Keep the Latin acronym |
| MRI | رنين مغناطيسي | |
| Ultrasound | إيكو | |
| DICOM viewer | عارض الصور الطبية | |

## Dental
| English | Arabic | Notes |
|---|---|---|
| Odontogram / dental chart | مخطط الأسنان | |
| Tooth surface | سطح السن | |
| Caries | تسوّس / نخر | "نخر" in formal Syrian dental use (validate) |
| Filling | حشوة | Gulf: "حشو" |
| Root canal treatment | معالجة لبية / سحب عصب | "سحب عصب" colloquial |
| Crown | تاج / تلبيسة | "تلبيسة" colloquial Levantine |
| Bridge | جسر | |
| Implant | زرعة | |
| Extraction | قلع | Egypt: "خلع" |
| Missing tooth | سن مفقود | Distinct from extracted (قلع) — UI must keep them apart |
| Denture | طقم أسنان | |
| Scaling | تقليح / تنظيف | |
| Perio chart | مخطط اللثة | |
| Probing depth | عمق الجيب | |
| Bleeding on probing | نزف عند السبر | |
| Orthodontics | تقويم الأسنان | |
| Aligners | مصفّفات شفافة | (validate) |
| Treatment plan | خطة علاج | |
| Dental lab case | حالة مخبر | Syria: "مخبر"; Gulf: "معمل" |
| Shade | اللون | |

## Orthopedics
| English | Arabic | Notes |
|---|---|---|
| Fracture | كسر | |
| Open / closed fracture | كسر مفتوح / مغلق | |
| Cast | جبس / جبيرة | Levantine: "جبس" for plaster cast (validate) |
| Splint / brace | جبيرة / مشدّ | |
| Range of motion | مدى الحركة | |
| Muscle power | القوة العضلية | |
| Special test | اختبار خاص | |
| Injection | حقنة / حقن | |
| Joint aspiration | بزل المفصل | |
| Union | التئام | |
| Weight bearing | التحميل | |
| Surgery | عملية جراحية | |
| Implant (ortho) | مثبّت / مفصل صناعي | |
| Physiotherapy | علاج فيزيائي | Syria: "فيزيائي"; Gulf: "طبيعي" |
| Body chart | مخطط الجسم | |
| Side: right / left / both | يمين / يسار / الجهتان | Mandatory on every orthopedic entry |
| Outcome questionnaire (PROM) | استبيان نتائج المريض | |

## Money
| English | Arabic | Notes |
|---|---|---|
| New Syrian pound (SYP) | الليرة السورية الجديدة | Always print "جديدة" on receipts |
| Turkish lira (TRY) | الليرة التركية | Colloquially "تركي" |
| US dollar (USD) | الدولار | |
| Exchange rate | سعر الصرف | |
| Receive rate / give rate | سعر الاستلام / سعر الصرف للباقي | |
| Invoice | فاتورة | |
| Receipt | إيصال / وصل | Syria: "وصل" common |
| Change (money) | الباقي / الفكّة | |
| Rounding | تقريب | |
| Deposit | عربون | |
| Installment | قسط / تقسيط | |
| Balance | الرصيد | |
| Patient credit | رصيد دائن للمريض | |
| Refund | استرداد | |
| Discount | حسم / خصم | Syria: "حسم" common |
| Cash session | جلسة صندوق | |
| Daily close | إغلاق الصندوق اليومي | |
| Expense | مصروف | |
| Doctor share | نسبة الطبيب | |

## UI-string guidance
- Arabic-first, right-to-left; Modern Standard Arabic with Syrian everyday terms where they are clearer to receptionists (e.g. الدور، السكرتيرة، وصل، حسم).
- Avoid Egyptian/Gulf variants in UI copy (روشتة، كشفية، خلع، معمل) unless clinics ask for them.
- Latin fragments (drug names, units, IDs, phone numbers) are bidi-isolated.
- Digits: Western (0–9) vs Arabic-Indic (٠–٩) is a per-tenant setting; default pending OD-20.
- Turkish UI for Azaz is a later language pack (OD-16); voice announcements may add Turkish earlier (OD-11).
