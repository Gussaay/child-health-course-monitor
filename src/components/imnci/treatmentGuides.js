// ============================================================================
// THE NATIONAL TREATMENT AND COUNSELLING TABLES
//
// Everything on the booklet's TREAT, COUNSEL and FOLLOW-UP pages that is not a
// dose band: vaccination schedule, inhaler use, local treatments, fluid plans,
// counselling and follow-up care, for the sick child and for the young infant.
// Protocol management shows them under each part and lets them be edited like
// the protocol; a saved copy lives in imnciProtocols/guide_child and
// imnciProtocols/guide_infant.
//
// Shape:
//   groups   one per heading (vaccination, local, inhaler, fluids, counsel,
//            followup), each with an en/ar title and a list of blocks
//   block    one box of the booklet: an en/ar title, then lines (a list) or a
//            table (columns + rows), or both. Every text has en and ar sides.
//
// Written here as [english, arabic] pairs so the two languages stay aligned;
// split into en / ar sides on export.
// ============================================================================

// ---- authoring helpers ------------------------------------------------------
const side = (pairs, i) => (pairs || []).map((p) => p[i]);
const block = (id, title, { lines, columns, rows } = {}) => {
    const make = (i) => ({
        title: title[i],
        ...(lines ? { lines: side(lines, i) } : {}),
        ...(columns ? { columns: side(columns, i) } : {}),
        ...(rows ? { rows: rows.map((r) => side(r, i)) } : {}),
    });
    return { id, en: make(0), ar: make(1) };
};
const group = (id, title, blocks) => ({ id, en: { title: title[0] }, ar: { title: title[1] }, blocks });

// ---- shared pieces -------------------------------------------------------------
const RETURN_NOW_CHILD = [
    ['Not able to drink or breastfeed', 'لا يستطيع أن يشرب أو يرضع'],
    ['Becomes sicker', 'ساءت حالته'],
    ['Develops a fever', 'أصيب بالحمى'],
    ['If the child has cough or cold: fast breathing', 'إذا كان لديه كحة أو زكام: تنفس سريع'],
    ['If the child has cough or cold: difficult breathing', 'إذا كان لديه كحة أو زكام: صعوبة في التنفس'],
    ['If the child has diarrhoea: blood in stool', 'إذا كان لديه إسهال: دم في البراز'],
    ['If the child has diarrhoea: drinking poorly', 'إذا كان لديه إسهال: يشرب بصعوبة'],
];

// =============================================================================
// SICK CHILD, 2 MONTHS UP TO 5 YEARS
// =============================================================================
export const NATIONAL_CHILD_GUIDE = {
    formType: 'guide_child',
    version: 'Sudan national IMNCI chart booklet',
    groups: [
        group('vaccination', ['Vaccination and vitamin A', 'التطعيم وفيتامين أ'], [
            block('schedule', ['Vaccination schedule', 'جدول التطعيم'], {
                columns: [['Age', 'العمر'], ['Vaccine', 'التطعيم']],
                rows: [
                    [['Birth', 'عند الولادة'], ['OPV 0, BCG', 'شلل الأطفال 0، البي سي جي']],
                    [['6 weeks', '6 أسابيع'], ['OPV 1, Pentavalent 1, PCV 1, Rota 1, IPV 1', 'شلل الأطفال 1، الخماسي 1، المكورات الرئوية 1، الروتا 1، شلل الأطفال بالحقن 1']],
                    [['10 weeks', '10 أسابيع'], ['OPV 2, Pentavalent 2, PCV 2, Rota 2', 'شلل الأطفال 2، الخماسي 2، المكورات الرئوية 2، الروتا 2']],
                    [['14 weeks', '14 أسبوعاً'], ['OPV 3, Pentavalent 3, PCV 3, Rota 3, IPV 2', 'شلل الأطفال 3، الخماسي 3، المكورات الرئوية 3، الروتا 3، شلل الأطفال بالحقن 2']],
                    [['9 months', '9 أشهر'], ['MR, Men A, Yellow fever', 'الحصبة والحصبة الألمانية، السحائي أ، الحمى الصفراء']],
                    [['18 months', '18 شهراً'], ['MR (booster dose)', 'الحصبة والحصبة الألمانية (جرعة منشطة)']],
                ],
            }),
            block('intervals', ['Important', 'هام'], {
                lines: [
                    ['Keep the interval of 4 weeks for the pentavalent, PCV, OPV and Rota vaccines.', 'حافظ على فترة 4 أسابيع بين جرعات الخماسي والمكورات الرئوية وشلل الأطفال والروتا.'],
                    ['Keep the interval of 8 weeks for IPV vaccines.', 'حافظ على فترة 8 أسابيع بين جرعتي شلل الأطفال بالحقن.'],
                    ['Keep the interval of 9 months for measles vaccine.', 'حافظ على فترة 9 أشهر لتطعيم الحصبة.'],
                ],
            }),
            block('defaulter', ['Defaulter', 'المتخلفون عن التطعيم'], {
                lines: [
                    ['Don\'t give OPV 0 to an infant above 14 days.', 'لا تعطِ جرعة شلل الأطفال 0 لرضيع عمره أكثر من 14 يوماً.'],
                    ['Don\'t give Rota vaccine after the age of 1 year.', 'لا تعطِ تطعيم الروتا بعد عمر سنة.'],
                    ['Give BCG at any age if not received before (if age more than 1 year give BCG only after a negative Mantoux test).', 'أعطِ البي سي جي في أي عمر إذا لم يأخذه من قبل (إذا كان العمر أكثر من سنة أعطه فقط بعد اختبار مانتو سلبي).'],
                ],
            }),
            block('contra', ['Contra-indications', 'موانع التطعيم'], {
                lines: [
                    ['Don\'t give BCG vaccine to an HIV patient.', 'لا تعطِ البي سي جي لمريض فيروس نقص المناعة.'],
                    ['Don\'t give Pentavalent to a patient with convulsions within 72 hours of the last pentavalent dose, or with neurological disease.', 'لا تعطِ الخماسي لمن أصيب بتشنجات خلال 72 ساعة من آخر جرعة خماسي، أو لمن لديه مرض عصبي.'],
                ],
            }),
            block('vitamin_a', ['Vitamin A supplementation and treatment', 'إعطاء فيتامين أ للوقاية والعلاج'], {
                lines: [
                    ['Give the first dose any time after 6 months of age to ALL children, then every 6 months up to 5 years.', 'أعطِ الجرعة الأولى في أي وقت بعد عمر 6 أشهر لكل الأطفال، ثم كل 6 أشهر حتى عمر 5 سنوات.'],
                    ['Treatment: give 3 doses (day 1 in clinic, day 2 and day 14) if the child has MEASLES or PERSISTENT DIARRHOEA.', 'العلاج: أعطِ 3 جرعات (اليوم الأول بالمرفق، واليوم الثاني، واليوم الرابع عشر) إذا كان لدى الطفل حصبة أو إسهال مستمر.'],
                    ['Do not give vitamin A if the child had a dose within the past 6 months or is on RUTF for severe acute malnutrition.', 'لا تعطِ فيتامين أ إذا أخذ الطفل جرعة خلال الستة أشهر الماضية أو كان يتلقى الغذاء العلاجي الجاهز لسوء التغذية الحاد الشديد.'],
                    ['Vitamin A given during mass campaigns should be recorded on the child card; look at it before giving a new dose.', 'يجب تسجيل فيتامين أ الذي أُعطي في الحملات في كرت الطفل؛ راجعه قبل إعطاء جرعة جديدة.'],
                ],
                columns: [['Age', 'العمر'], ['Vitamin A dose', 'جرعة فيتامين أ']],
                rows: [
                    [['6 months up to 12 months', '6 أشهر إلى أقل من 12 شهراً'], ['100 000 IU', '100,000 وحدة دولية']],
                    [['12 months up to 5 years', '12 شهراً إلى أقل من 5 سنوات'], ['200 000 IU', '200,000 وحدة دولية']],
                ],
            }),
        ]),

        group('inhaler', ['Inhalers', 'البخاخات'], [
            block('salbutamol', ['Give inhaled salbutamol through a spacer for wheezing', 'أعطِ السالبيوتامول بالبخاخ عبر جهاز المباعدة للأزيز'], {
                lines: [
                    ['Salbutamol metered dose inhaler (100 mcg/puff): give 3–5 puffs at a time.', 'بخاخ السالبيوتامول (100 ميكروجرام للبخة): أعطِ 3–5 بخات في المرة.'],
                    ['Repeat up to 3 times every 20 minutes before classifying pneumonia.', 'كرر حتى 3 مرات كل 20 دقيقة قبل تصنيف الالتهاب الرئوي.'],
                    ['No child under 5 years should be given an inhaler without a spacer. A spacer works as well as a nebulizer if correctly used.', 'لا يعطى أي طفل أقل من 5 سنوات البخاخ بدون جهاز مباعدة. جهاز المباعدة يعمل مثل جهاز الإرذاذ إذا استُخدم بطريقة صحيحة.'],
                ],
            }),
            block('spacer_use', ['To use an inhaler with a spacer', 'طريقة استخدام البخاخ مع جهاز المباعدة'], {
                lines: [
                    ['Remove the inhaler cap. Shake the inhaler well.', 'انزع غطاء البخاخ ورجّ البخاخ جيداً.'],
                    ['Insert the mouthpiece of the inhaler through the hole in the bottle or plastic cup.', 'أدخل فم البخاخ في الفتحة الموجودة في قاعدة القارورة أو الكوب البلاستيكي.'],
                    ['The child puts the opening of the spacer into the mouth and breathes in and out through the mouth. The caregiver presses down the inhaler and sprays into the bottle while the child keeps breathing normally.', 'يضع الطفل فتحة جهاز المباعدة على فمه ويتنفس منه. يضغط مقدم الرعاية على البخاخ ليرش داخل القارورة بينما يواصل الطفل التنفس بشكل طبيعي.'],
                    ['Wait for three to four breaths and repeat.', 'انتظر ثلاثة إلى أربعة أنفاس ثم كرر.'],
                    ['If a spacer is used for the first time, prime it with 4–5 extra puffs from the inhaler.', 'إذا استُخدم جهاز المباعدة لأول مرة، جهّزه بـ 4–5 بخات إضافية من البخاخ.'],
                ],
            }),
            block('spacer_make', ['Making a spacer', 'صناعة جهاز المباعدة'], {
                lines: [
                    ['Use a 500 ml drink bottle or similar.', 'استخدم قارورة مشروبات سعة 500 مل أو ما يشبهها.'],
                    ['Cut a hole in the bottle base in the same shape as the mouthpiece of the inhaler (a sharp knife can be used).', 'اقطع فتحة في قاعدة القارورة بنفس شكل فم البخاخ (يمكن استخدام سكين حاد).'],
                    ['Cut the bottle between the upper quarter and the lower three quarters and discard the upper quarter.', 'اقطع القارورة بين الربع العلوي والثلاثة أرباع السفلية وتخلص من الربع العلوي.'],
                    ['Cut a small V in the edge of the large open part to fit the child\'s nose, to be used as a mask.', 'اقطع شكل V صغيراً في حافة الجزء المفتوح ليناسب أنف الطفل ويستخدم كقناع.'],
                    ['Flame the edge of the cut bottle with a candle or a lighter to soften it.', 'مرّر حافة القارورة المقطوعة على لهب شمعة أو ولاعة لتنعيمها.'],
                    ['In a small baby, a mask can be made by making a similar hole in a plastic (not polystyrene) cup.', 'للرضيع الصغير يمكن صنع القناع بعمل فتحة مماثلة في كوب بلاستيكي (ليس من الفلين).'],
                    ['Commercial spacers can be used if available.', 'يمكن استخدام أجهزة المباعدة التجارية إن وجدت.'],
                ],
            }),
            block('oral_salbutamol', ['Oral salbutamol for wheezing if an inhaler is not available', 'السالبيوتامول بالفم للأزيز إذا لم يتوفر البخاخ'], {
                lines: [['Oral salbutamol 3 times daily for 5 days.', 'السالبيوتامول بالفم 3 مرات يومياً لمدة 5 أيام.']],
                columns: [['Age or weight', 'العمر أو الوزن'], ['Syrup 2 mg/5 ml', 'شراب 2 ملجم/5 مل'], ['Tablet 4 mg', 'حبة 4 ملجم']],
                rows: [
                    [['2 up to 12 months (< 10 kg)', 'شهرين إلى أقل من 12 شهراً (أقل من 10 كجم)'], ['2.5 ml', '2.5 مل'], ['1/4', 'ربع حبة']],
                    [['1 up to 5 years (10–19 kg)', 'سنة إلى أقل من 5 سنوات (10–19 كجم)'], ['5 ml', '5 مل'], ['1/2', 'نصف حبة']],
                ],
            }),
        ]),

        group('local', ['Local treatment', 'العلاج الموضعي'], [
            block('teach', ['Teach the mother to treat local infections at home', 'علّم الأم علاج الالتهابات الموضعية بالمنزل'], {
                lines: [
                    ['Explain to the mother what the treatment is and why it should be given.', 'اشرح للأم ما هو العلاج ولماذا يجب أن يعطى.'],
                    ['Describe the treatment steps listed in the appropriate box.', 'صف خطوات العلاج الموضحة في المربع المناسب.'],
                    ['Watch the mother as she does the first treatment in the clinic (except the remedy for cough or sore throat).', 'راقب الأم وهي تعطي أول علاج في المرفق (ما عدا علاج الكحة أو التهاب الحلق).'],
                    ['Tell her how often to do the treatment at home.', 'أخبرها بعدد مرات العلاج في المنزل.'],
                    ['If needed, give her the tube of tetracycline ointment or a small bottle of gentian violet.', 'إذا احتاجت، أعطها أنبوبة مرهم التتراسيكلين أو قارورة صغيرة من الجنشن فيوليت.'],
                    ['Check the mother\'s understanding before she leaves the clinic.', 'تأكد من فهم الأم قبل أن تغادر المرفق.'],
                ],
            }),
            block('eye', ['Treat eye infection with tetracycline eye ointment', 'علاج التهاب العين بمرهم التتراسيكلين للعين'], {
                lines: [
                    ['Clean both eyes 4 times daily.', 'نظّف العينين 4 مرات يومياً.'],
                    ['Wash hands.', 'اغسلي يديك.'],
                    ['Ask the child to close the eyes.', 'اطلبي من الطفل أن يغمض عينيه.'],
                    ['Use a clean cloth and water to gently wipe away pus.', 'استخدمي قطعة قماش نظيفة وماء لمسح الصديد برفق.'],
                    ['Ask the child to look up.', 'اطلبي من الطفل أن ينظر لأعلى.'],
                    ['Squirt a small amount of ointment on the inside of the lower lid.', 'ضعي كمية صغيرة من المرهم داخل الجفن السفلي.'],
                    ['Wash hands again.', 'اغسلي يديك مرة أخرى.'],
                    ['Treat until there is no pus discharge. Do not put anything else in the eye.', 'استمري في العلاج حتى يتوقف الصديد. لا تضعي أي شيء آخر في العين.'],
                ],
            }),
            block('mouth', ['Treat mouth ulcers with gentian violet', 'علاج قرح الفم بالجنشن فيوليت'], {
                lines: [
                    ['Treat mouth ulcers twice daily.', 'عالجي قرح الفم مرتين يومياً.'],
                    ['Wash hands.', 'اغسلي يديك.'],
                    ['Wash the child\'s mouth with a clean soft cloth wrapped around the finger and wet with salt water.', 'نظّفي فم الطفل بقطعة قماش نظيفة ناعمة ملفوفة على الإصبع ومبللة بماء وملح.'],
                    ['Paint the mouth with half-strength gentian violet (0.25 %).', 'ادهني الفم بالجنشن فيوليت نصف التركيز (0.25 %).'],
                    ['Wash hands again.', 'اغسلي يديك مرة أخرى.'],
                    ['Continue using gentian violet for 48 hours after the ulcers are cured.', 'استمري في استخدام الجنشن فيوليت لمدة 48 ساعة بعد شفاء القرح.'],
                    ['Give paracetamol for pain relief.', 'أعطِ الباراسيتامول لتخفيف الألم.'],
                ],
            }),
            block('ear', ['Dry the ear by wicking', 'تجفيف الأذن بالفتيلة'], {
                lines: [
                    ['Dry the ear at least 3 times daily.', 'جففي الأذن 3 مرات يومياً على الأقل.'],
                    ['Roll clean absorbent cloth or soft, strong tissue paper into a wick.', 'لفّي قطعة قماش نظيفة ماصة أو مناديل ورقية ناعمة وقوية على شكل فتيلة.'],
                    ['Place the wick in the child\'s ear.', 'أدخلي الفتيلة في أذن الطفل.'],
                    ['Remove the wick when it becomes wet.', 'أخرجي الفتيلة عندما تبتل.'],
                    ['Replace the wick with a clean one and repeat until the ear is dry.', 'استبدلي الفتيلة بأخرى نظيفة وكرري حتى تجف الأذن.'],
                    ['For CHRONIC EAR INFECTION use quinolone ear drops (ciprofloxacin, ofloxacin) after dry wicking, 3 times daily for 14 days.', 'لالتهاب الأذن المزمن استخدمي قطرة أذن من الكينولون (سيبروفلوكساسين، أوفلوكساسين) بعد التجفيف بالفتيلة، 3 مرات يومياً لمدة 14 يوماً.'],
                ],
            }),
            block('throat', ['Soothe the throat, relieve the cough with a safe remedy', 'تلطيف الحلق وتخفيف الكحة بعلاج آمن'], {
                lines: [
                    ['Safe remedies: breast milk for the exclusively breastfed infant; karkadeh, lemon, ginger (honey only above 1 year of age).', 'العلاجات الآمنة: لبن الأم للرضيع الذي يرضع رضاعة طبيعية مطلقة؛ الكركدي، الليمون، الزنجبيل (العسل فقط لمن عمره أكثر من سنة).'],
                    ['Harmful remedies to discourage: all cough medicines, removal of the uvula, oil as nasal drops.', 'العلاجات الضارة التي يجب تجنبها: كل أدوية الكحة، قطع اللهاة، استخدام الزيت كقطرة للأنف.'],
                ],
            }),
        ]),

        group('fluids', ['Fluids and feeding for diarrhoea', 'السوائل والتغذية للإسهال'], [
            block('plan_a', ['Plan A: treat diarrhoea at home', 'الخطة أ: علاج الإسهال بالمنزل'], {
                lines: [
                    ['Counsel the mother on the 4 rules of home treatment: give extra fluid, give zinc, continue feeding, when to return.', 'انصح الأم بقواعد العلاج المنزلي الأربع: أعطِ سوائل إضافية، أعطِ الزنك، واصلي التغذية، متى تعودين.'],
                    ['Breastfeed frequently and for longer at each feed. If exclusively breastfed, give ORS or clean water in addition to breast milk.', 'أرضعي كثيراً ولفترة أطول في كل رضعة. إذا كان يرضع رضاعة طبيعية مطلقة أعطه محلول الإرواء أو ماء نظيفاً بالإضافة إلى لبن الأم.'],
                    ['If not exclusively breastfed, give ORS, food-based fluids (soup, rice water, yoghurt) or clean water.', 'إذا لم يكن يرضع رضاعة مطلقة أعطه محلول الإرواء أو سوائل غذائية (شوربة، ماء الأرز، زبادي) أو ماء نظيفاً.'],
                    ['Give 2 packets of ORS to use at home. Give frequent small sips from a cup; if the child vomits, wait 10 minutes then continue more slowly.', 'أعطِ الأم كيسين من محلول الإرواء للمنزل. أعطِ رشفات صغيرة متكررة بالكوب؛ إذا تقيأ الطفل انتظري 10 دقائق ثم واصلي ببطء.'],
                    ['Zinc: infants dissolve the tablet in a little breast milk, ORS or clean water; older children chew or dissolve it.', 'الزنك: للرضع تذاب الحبة في قليل من لبن الأم أو محلول الإرواء أو ماء نظيف؛ والأطفال الأكبر يمضغونها أو تذاب لهم.'],
                ],
                columns: [['Age', 'العمر'], ['Extra fluid after each loose stool', 'السوائل الإضافية بعد كل إسهال']],
                rows: [
                    [['Up to 2 years', 'حتى سنتين'], ['50 to 100 ml', '50 إلى 100 مل']],
                    [['2 years or more', 'سنتان أو أكثر'], ['100 to 200 ml', '100 إلى 200 مل']],
                ],
            }),
            block('plan_b', ['Plan B: treat some dehydration with ORS (first 4 hours in clinic)', 'الخطة ب: علاج بعض الجفاف بمحلول الإرواء (أول 4 ساعات بالمرفق)'], {
                lines: [
                    ['Use the age only when you do not know the weight. The amount can also be calculated as weight (kg) × 75 ml.', 'استخدم العمر فقط إذا لم يكن الوزن معروفاً. يمكن أيضاً حساب الكمية بضرب الوزن (كجم) × 75 مل.'],
                    ['If the child wants more ORS than shown, give more. For infants under 6 months who are not breastfed, also give 100–200 ml clean water.', 'إذا أراد الطفل محلولاً أكثر فأعطه. للرضع أقل من 6 أشهر غير الراضعين أعطِ أيضاً 100–200 مل ماء نظيفاً.'],
                    ['After 4 hours reassess and classify dehydration, select the plan to continue, and begin feeding in clinic.', 'بعد 4 ساعات أعد التقييم وصنّف الجفاف واختر الخطة المناسبة وابدأ تغذية الطفل في المرفق.'],
                    ['If the mother must leave early: show her how to prepare ORS, how much to finish the 4 hours at home, give enough packets plus 2 for Plan A, and explain the 4 rules.', 'إذا اضطرت الأم للمغادرة مبكراً: علّمها تحضير المحلول والكمية لإكمال الأربع ساعات بالمنزل، وأعطها أكياساً كافية مع كيسين للخطة أ، واشرح القواعد الأربع.'],
                ],
                columns: [['Age (weight)', 'العمر (الوزن)'], ['ORS in 4 hours', 'محلول الإرواء في 4 ساعات']],
                rows: [
                    [['Up to 4 months (< 6 kg)', 'حتى 4 أشهر (أقل من 6 كجم)'], ['200–400 ml', '200–400 مل']],
                    [['4 up to 12 months (6 – < 10 kg)', '4 إلى أقل من 12 شهراً (6 – أقل من 10 كجم)'], ['400–700 ml', '400–700 مل']],
                    [['12 months up to 2 years (10 – < 12 kg)', '12 شهراً إلى أقل من سنتين (10 – أقل من 12 كجم)'], ['700–900 ml', '700–900 مل']],
                    [['2 years up to 5 years (12–19 kg)', 'سنتان إلى أقل من 5 سنوات (12–19 كجم)'], ['900–1400 ml', '900–1400 مل']],
                ],
            }),
            block('plan_c', ['Plan C: treat severe dehydration quickly', 'الخطة ج: علاج الجفاف الشديد بسرعة'], {
                lines: [
                    ['Start IV fluid immediately. If the child can drink, give ORS by mouth while the drip is set up.', 'ابدأ المحاليل الوريدية فوراً. إذا كان الطفل يستطيع الشرب أعطه محلول الإرواء بالفم أثناء تجهيز الدرب.'],
                    ['Give 100 ml/kg Ringer\'s lactate (or normal saline) divided as in the table. Repeat the first part once if the radial pulse is still very weak.', 'أعطِ 100 مل/كجم رينجر لاكتيت (أو محلول ملحي) مقسمة كما بالجدول. كرر الجزء الأول مرة واحدة إذا ظل النبض ضعيفاً جداً.'],
                    ['Reassess every 1–2 hours. Give ORS (about 5 ml/kg/hour) as soon as the child can drink.', 'أعد التقييم كل 1–2 ساعة. أعطِ محلول الإرواء (حوالي 5 مل/كجم/ساعة) حالما يستطيع الطفل الشرب.'],
                    ['If IV is not possible but available within 30 minutes: refer URGENTLY; give the mother ORS for sips on the way.', 'إذا لم يمكن إعطاء الوريد وكان متاحاً خلال 30 دقيقة: حوّله عاجلاً وأعطِ الأم محلول الإرواء ليعطيه رشفات أثناء الطريق.'],
                    ['If trained to use a naso-gastric tube: ORS 20 ml/kg/hour for 6 hours (total 120 ml/kg), reassess every 1–2 hours.', 'إذا كنت مدرباً على أنبوب الأنف المعدي: محلول الإرواء 20 مل/كجم/ساعة لمدة 6 ساعات (المجموع 120 مل/كجم) مع إعادة التقييم كل 1–2 ساعة.'],
                    ['If none of these is possible and the child cannot drink: refer URGENTLY to hospital for IV or NG treatment.', 'إذا لم يتيسر أي من ذلك ولا يستطيع الطفل الشرب: حوّله عاجلاً للمستشفى للعلاج الوريدي أو بالأنبوب.'],
                ],
                columns: [['Age', 'العمر'], ['First give 30 ml/kg in', 'أعطِ أولاً 30 مل/كجم خلال'], ['Then give 70 ml/kg in', 'ثم أعطِ 70 مل/كجم خلال']],
                rows: [
                    [['Infant under 12 months', 'رضيع أقل من 12 شهراً'], ['1 hour', 'ساعة واحدة'], ['5 hours', '5 ساعات']],
                    [['Children 12 months and more', 'طفل 12 شهراً فأكثر'], ['30 minutes', '30 دقيقة'], ['2½ hours', 'ساعتان ونصف']],
                ],
            }),
            block('rutf', ['Ready-to-use therapeutic food (RUTF) for severe acute malnutrition', 'الغذاء العلاجي الجاهز لسوء التغذية الحاد الشديد'], {
                lines: [
                    ['Wash hands. Sit with the child on the lap and gently offer RUTF; do not force the child.', 'اغسلي يديك. أجلسي الطفل في حجرك وقدمي له الغذاء العلاجي برفق دون إجبار.'],
                    ['Give small regular meals, 5–6 per day, and plenty of clean water from a cup.', 'أعطِ وجبات صغيرة منتظمة 5–6 مرات يومياً مع كمية كافية من الماء النظيف بالكوب.'],
                    ['Give RUTF for at least 2 weeks; continue breastfeeding. Make sure the daily RUTF portion is finished before other foods.', 'أعطِ الغذاء العلاجي لمدة أسبوعين على الأقل مع مواصلة الرضاعة. تأكدي من إكمال الحصة اليومية قبل أي طعام آخر.'],
                ],
                columns: [['Child weight (kg)', 'وزن الطفل (كجم)'], ['Sachets per day', 'أكياس في اليوم'], ['Sachets per week', 'أكياس في الأسبوع']],
                rows: [
                    [['4 – 4.9', '4 – 4.9'], ['2', '2'], ['14', '14']],
                    [['5 – 6.9', '5 – 6.9'], ['2½', '2½'], ['18', '18']],
                    [['7.0 – 8.4', '7.0 – 8.4'], ['3', '3'], ['21', '21']],
                    [['8.5 – 9.4', '8.5 – 9.4'], ['3½', '3½'], ['25', '25']],
                    [['9.5 – 10.4', '9.5 – 10.4'], ['4', '4'], ['28', '28']],
                    [['10.5 – 11.9', '10.5 – 11.9'], ['4½', '4½'], ['32', '32']],
                    [['12 or more', '12 فأكثر'], ['5', '5'], ['35', '35']],
                ],
            }),
        ]),

        group('counsel', ['Counselling', 'نصح الأم'], [
            block('appetite', ['Assess the child\'s appetite (severe acute malnutrition, 6 months or more)', 'تقييم شهية الطفل (سوء التغذية الحاد الشديد، 6 أشهر فأكثر)'], {
                lines: [
                    ['Assess appetite at the first visit and at each follow-up, in a quiet corner; the child usually eats the portion in 30 minutes.', 'قيّم الشهية في الزيارة الأولى وكل زيارة متابعة في ركن هادئ؛ عادة يأكل الطفل الحصة خلال 30 دقيقة.'],
                    ['Explain the purpose of the test, what RUTF is and how to give it.', 'اشرح للأم الغرض من الاختبار وما هو الغذاء العلاجي الجاهز وكيف يعطى.'],
                    ['Offer 1/3 of a RUTF sachet. After 30 minutes: able to finish = passes; not able to finish = fails the appetite test.', 'قدّم ثلث كيس من الغذاء العلاجي. بعد 30 دقيقة: إذا أكمله ينجح، وإذا لم يكمله يفشل في اختبار الشهية.'],
                ],
            }),
            block('feeding', ['Assess the child\'s feeding', 'تقييم تغذية الطفل'], {
                lines: [
                    ['Assess feeding if the child is less than 2 years old, or has MODERATE ACUTE MALNUTRITION or ANAEMIA.', 'قيّم التغذية إذا كان عمر الطفل أقل من سنتين أو لديه سوء تغذية حاد متوسط أو فقر دم.'],
                    ['If breastfed: how many times during the day? Do you also breastfeed at night?', 'إذا كان يرضع: كم مرة في اليوم؟ هل ترضعينه أثناء الليل؟'],
                    ['Does the child take other food or fluids? What, how many times a day, and what do you use to feed the child?', 'هل يتناول الطفل أطعمة أو سوائل أخرى؟ ما هي، وكم مرة في اليوم، وبماذا تطعمينه؟'],
                    ['During this illness, has the child\'s feeding changed? If yes, how?', 'هل تغيرت تغذية الطفل أثناء هذا المرض؟ إذا نعم، كيف؟'],
                    ['If MODERATE ACUTE MALNUTRITION: how large are servings? Does the child get his own serving? Who feeds the child and how? What food is available at home?', 'إذا كان لديه سوء تغذية حاد متوسط: ما حجم الوجبة؟ هل له وجبة خاصة؟ من يطعمه وكيف؟ ما الأطعمة المتوفرة بالمنزل؟'],
                ],
            }),
            block('persistent', ['Feeding a child who has PERSISTENT DIARRHOEA', 'تغذية الطفل المصاب بالإسهال المستمر'], {
                lines: [
                    ['If still breastfeeding, give more frequent, longer breastfeeds, day and night.', 'إذا كان يرضع، أرضعيه مرات أكثر ولفترات أطول ليلاً ونهاراً.'],
                    ['If taking other milk: replace with more breastfeeding, OR with fermented milk such as yoghurt, OR replace half the milk with nutrient-rich semisolid food.', 'إذا كان يتناول لبناً آخر: استبدليه بزيادة الرضاعة، أو بمنتجات اللبن المخمر مثل الزبادي، أو استبدلي نصف اللبن بطعام نصف صلب غني بالمغذيات.'],
                    ['For other foods, follow the feeding recommendations for the child\'s age.', 'للأطعمة الأخرى اتبعي توصيات التغذية حسب عمر الطفل.'],
                ],
            }),
            block('fluids_illness', ['Increase fluid during illness', 'زيادة السوائل أثناء المرض'], {
                lines: [
                    ['For any sick child: breastfeed more frequently and for longer; if on breast-milk substitutes increase the amount; give more soup, rice water, yoghurt drinks or clean water.', 'لأي طفل مريض: أرضعيه أكثر ولفترة أطول؛ وإذا كان يتناول بدائل لبن الأم زيدي الكمية؛ وأعطيه شوربة أو ماء أرز أو زبادي أو ماء نظيفاً.'],
                    ['For a child with diarrhoea: extra fluid can be lifesaving; give fluid according to Plan A or Plan B.', 'للطفل المصاب بالإسهال: السوائل الإضافية قد تنقذ حياته؛ أعطيه السوائل حسب الخطة أ أو الخطة ب.'],
                ],
            }),
            block('mother', ['Counsel the mother about her own health', 'نصح الأم عن صحتها'], {
                lines: [
                    ['If the mother is sick, provide care for her or refer her for help.', 'إذا كانت الأم مريضة قدّم لها الرعاية أو حوّلها للمساعدة.'],
                    ['If she has a breast problem (engorgement, sore nipples, breast infection), provide care or refer her.', 'إذا كانت لديها مشكلة في الثدي (احتقان، تشقق الحلمات، التهاب الثدي) قدّم لها الرعاية أو حوّلها.'],
                    ['Advise her to eat well; if breastfeeding, two extra meals daily. Advise on vitamin A.', 'انصحها بأن تتغذى جيداً؛ وإذا كانت ترضع فوجبتان إضافيتان يومياً. انصحها بشأن فيتامين أ.'],
                    ['Check her immunization status and give tetanus toxoid if needed.', 'تأكد من تطعيمها وأعطها جرعة التيتانوس توكسويد إذا احتاجت.'],
                    ['Make sure she has access to family planning and counselling on STD, RTI and AIDS prevention.', 'تأكد من حصولها على تنظيم الأسرة والنصح عن الأمراض المنقولة جنسياً والتهابات الجهاز التناسلي والوقاية من الإيدز.'],
                ],
            }),
        ]),

        group('followup', ['Follow-up', 'المتابعة'], [
            block('when', ['When to return for follow-up', 'متى يعود للمتابعة'], {
                lines: [['Advise the mother to come for follow-up at the earliest time listed for the child\'s problems.', 'انصح الأم بالعودة للمتابعة في أقرب موعد مذكور لمشاكل الطفل.']],
                columns: [['If the child has', 'إذا كان لدى الطفل'], ['Return for follow-up in', 'يعود للمتابعة بعد']],
                rows: [
                    [['PNEUMONIA, DYSENTERY, MALARIA (if fever persists), FEVER: NO MALARIA (if fever persists), MEASLES WITH EYE OR MOUTH COMPLICATIONS, SOME DEHYDRATION or NO DEHYDRATION (if not improving)', 'التهاب رئوي، دسنتاريا، ملاريا (إذا استمرت الحمى)، حمى بدون ملاريا (إذا استمرت الحمى)، حصبة مع مضاعفات بالعين أو الفم، بعض الجفاف أو لا يوجد جفاف (إذا لم يتحسن)'], ['3 days', '3 أيام']],
                    [['PERSISTENT DIARRHOEA, ACUTE EAR INFECTION, CHRONIC EAR INFECTION, COUGH OR COLD (if not improving)', 'إسهال مستمر، التهاب أذن حاد، التهاب أذن مزمن، كحة أو زكام (إذا لم يتحسن)'], ['5 days', '5 أيام']],
                    [['FEEDING PROBLEM', 'مشكلة في التغذية'], ['7 days', '7 أيام']],
                    [['ANAEMIA, UNCOMPLICATED SEVERE ACUTE MALNUTRITION', 'فقر دم، سوء تغذية حاد شديد بدون مضاعفات'], ['14 days', '14 يوماً']],
                    [['MODERATE ACUTE MALNUTRITION', 'سوء تغذية حاد متوسط'], ['30 days', '30 يوماً']],
                ],
            }),
            block('return_now', ['When to return immediately', 'متى يعود فوراً'], {
                lines: [['Advise the mother to return immediately if the child has any of these signs:', 'انصح الأم أن تعود بطفلها فوراً إذا ظهرت عليه أي من هذه العلامات:'], ...RETURN_NOW_CHILD],
            }),
            block('fu_pneumonia', ['PNEUMONIA, after 3 days', 'الالتهاب الرئوي، بعد 3 أيام'], {
                lines: [
                    ['Check for general danger signs and assess for cough or difficult breathing. Ask: is the child breathing slower? Is there less fever? Is the child eating better?', 'افحص علامات الخطورة العامة وقيّم الكحة أو صعوبة التنفس. اسأل: هل أصبح التنفس أبطأ؟ هل قلّت الحمى؟ هل تحسن الأكل؟'],
                    ['Any general danger sign or stridor: give the first dose of intramuscular antibiotics and refer URGENTLY.', 'أي علامة خطورة عامة أو صرير: أعطِ الجرعة الأولى من المضاد الحيوي بالعضل وحوّله عاجلاً.'],
                    ['Chest indrawing, fast breathing, fever and eating the same or worse: refer URGENTLY; do not give a pre-referral antibiotic.', 'انسحاب الصدر والتنفس السريع والحمى والأكل كما هي أو أسوأ: حوّله عاجلاً؛ لا تعطِ مضاداً حيوياً قبل التحويل.'],
                    ['Breathing slower, no chest indrawing, less fever or eating better: complete the 5 days of antibiotic.', 'تنفس أبطأ وعدم وجود انسحاب صدر وحمى أقل أو أكل أفضل: أكمل 5 أيام من المضاد الحيوي.'],
                ],
            }),
            block('fu_dysentery', ['DYSENTERY, after 2 days', 'الدسنتاريا، بعد يومين'], {
                lines: [
                    ['Assess for diarrhoea. Ask: fewer stools? less blood? less fever? less abdominal pain? eating better?', 'قيّم الإسهال. اسأل: هل قلّ عدد مرات البراز؟ هل قلّ الدم؟ هل قلّت الحمى؟ هل قلّ ألم البطن؟ هل تحسن الأكل؟'],
                    ['If dehydrated, treat dehydration.', 'إذا كان مصاباً بالجفاف عالج الجفاف.'],
                    ['Same or worse: change to the second-line oral antibiotic for 5 days and return in 3 days; if not available, refer. Refer if less than 12 months, dehydrated at the first visit, or measles within 3 months.', 'كما هي أو أسوأ: غيّر إلى المضاد الحيوي البديل بالفم لمدة 5 أيام والعودة بعد 3 أيام؛ وإذا لم يتوفر حوّله. حوّله إذا كان عمره أقل من 12 شهراً أو كان مصاباً بالجفاف في الزيارة الأولى أو أصيب بالحصبة خلال 3 أشهر.'],
                    ['Better: continue ciprofloxacin and zinc until finished; make sure the mother understands oral rehydration and the extra meal each day for a week.', 'تحسن: واصل السيبروفلوكساسين والزنك حتى النهاية، وتأكد أن الأم تفهم الإرواء بالفم والوجبة الإضافية يومياً لمدة أسبوع.'],
                ],
            }),
            block('fu_malaria', ['MALARIA, if fever persists after 3 days', 'الملاريا، إذا استمرت الحمى بعد 3 أيام'], {
                lines: [
                    ['Do a full reassessment. Any general danger sign or stiff neck: treat as VERY SEVERE FEBRILE DISEASE.', 'أعد التقييم كاملاً. أي علامة خطورة عامة أو تيبس العنق: عالجه كمرض حمى شديد جداً.'],
                    ['Another cause of fever: treat it. Fever for 7 days: refer for assessment.', 'سبب آخر للحمى: عالجه. حمى لمدة 7 أيام: حوّله للتقييم.'],
                    ['Do not repeat the RDT if it was positive; do microscopy (blood film). If parasites present after a full first-line course, give the second or third line or refer.', 'لا تكرر الفحص السريع إذا كان موجباً؛ أجرِ فحص الشريحة. إذا وُجد الطفيل بعد إكمال علاج الخط الأول أعطِ علاج الخط الثاني أو الثالث أو حوّله.'],
                    ['No other cause and no microscopy available: refer to hospital.', 'لا يوجد سبب آخر ولا يتوفر فحص الشريحة: حوّله للمستشفى.'],
                ],
            }),
            block('fu_fever', ['FEVER: NO MALARIA, if fever persists after 3 days', 'حمى بدون ملاريا، إذا استمرت الحمى بعد 3 أيام'], {
                lines: [
                    ['Do a full reassessment and repeat the malaria test.', 'أعد التقييم كاملاً وكرر فحص الملاريا.'],
                    ['Any general danger sign or stiff neck: treat as VERY SEVERE FEBRILE DISEASE.', 'أي علامة خطورة عامة أو تيبس العنق: عالجه كمرض حمى شديد جداً.'],
                    ['Positive malaria test: give the first-line oral antimalarial; return in 3 days if fever persists.', 'فحص ملاريا موجب: أعطِ علاج الملاريا بالفم من الخط الأول؛ والعودة بعد 3 أيام إذا استمرت الحمى.'],
                    ['Other cause: treat it. No apparent cause and fever for 7 days: refer for assessment.', 'سبب آخر: عالجه. لا يوجد سبب واضح والحمى لمدة 7 أيام: حوّله للتقييم.'],
                ],
            }),
            block('fu_diarrhoea', ['PERSISTENT DIARRHOEA, after 5 days', 'الإسهال المستمر، بعد 5 أيام'], {
                lines: [
                    ['Ask: has the diarrhoea stopped? How many loose stools per day?', 'اسأل: هل توقف الإسهال؟ كم مرة يتبرز براز لين في اليوم؟'],
                    ['Not stopped (3 or more loose stools a day): full reassessment, treat dehydration if present, then refer URGENTLY.', 'لم يتوقف (3 مرات أو أكثر يومياً): أعد التقييم كاملاً وعالج الجفاف إن وجد ثم حوّله عاجلاً.'],
                    ['Stopped (less than 3 a day): usual feeding for age and continue zinc to complete 14 days.', 'توقف (أقل من 3 مرات يومياً): التغذية المعتادة حسب العمر ومواصلة الزنك لإكمال 14 يوماً.'],
                ],
            }),
            block('fu_measles', ['MEASLES WITH EYE OR MOUTH COMPLICATIONS, after 3 days', 'الحصبة مع مضاعفات بالعين أو الفم، بعد 3 أيام'], {
                lines: [
                    ['Look for red eyes and pus draining; look at mouth ulcers or white patches; smell the mouth.', 'انظر لاحمرار العينين ونزول الصديد؛ انظر لقرح الفم أو البقع البيضاء؛ شم رائحة الفم.'],
                    ['Eye: pus still draining and treatment correct, refer; not correct, teach the mother. Pus gone but redness remains, continue. No pus or redness, stop.', 'العين: إذا استمر الصديد والعلاج صحيح حوّله؛ وإذا لم يكن صحيحاً علّم الأم. زال الصديد وبقي الاحمرار واصل العلاج. لا صديد ولا احمرار أوقف العلاج.'],
                    ['Mouth: ulcers worse or very foul smell, refer. Same or better, continue half-strength gentian violet for a total of 5 days.', 'الفم: القرح أسوأ أو رائحة كريهة جداً حوّله. كما هي أو أفضل واصل الجنشن فيوليت نصف التركيز لمدة 5 أيام.'],
                ],
            }),
            block('fu_ear', ['EAR INFECTION, after 5 days', 'التهاب الأذن، بعد 5 أيام'], {
                lines: [
                    ['Reassess the ear problem and measure the temperature.', 'أعد تقييم مشكلة الأذن وقس درجة الحرارة.'],
                    ['Tender swelling behind the ear or high fever (38.5 °C or above): refer URGENTLY.', 'تورم مؤلم خلف الأذن أو حمى عالية (38.5 م أو أكثر): حوّله عاجلاً.'],
                    ['Acute: pain or discharge persists, 5 more days of the same antibiotic, continue wicking, follow up in 5 days. No pain or discharge, praise the mother and finish the antibiotic.', 'الحاد: إذا استمر الألم أو الإفرازات أعطِ 5 أيام أخرى من نفس المضاد الحيوي وواصل التجفيف وعودة بعد 5 أيام. لا ألم ولا إفرازات: امدح الأم وأكمل المضاد الحيوي.'],
                    ['Chronic: check that the mother is wicking correctly and giving quinolone ear drops 3 times daily.', 'المزمن: تأكد أن الأم تجفف الأذن بطريقة صحيحة وتعطي قطرة الكينولون 3 مرات يومياً.'],
                ],
            }),
            block('fu_feeding', ['FEEDING PROBLEM, after 7 days', 'مشكلة التغذية، بعد 7 أيام'], {
                lines: [
                    ['Reassess feeding and ask about the problems found at the first visit.', 'أعد تقييم التغذية واسأل عن المشاكل التي وجدت في الزيارة الأولى.'],
                    ['Counsel about new or continuing problems; if significant changes are advised, ask her to bring the child back.', 'انصح الأم عن أي مشكلة جديدة أو مستمرة؛ وإذا نصحت بتغييرات كبيرة اطلب منها إحضار الطفل مرة أخرى.'],
                    ['MODERATE ACUTE MALNUTRITION: return 30 days after the first visit to measure WFH/L and MUAC.', 'سوء التغذية الحاد المتوسط: العودة بعد 30 يوماً من الزيارة الأولى لقياس الوزن للطول ومحيط منتصف الذراع.'],
                ],
            }),
            block('fu_anaemia', ['ANAEMIA, after 14 days', 'فقر الدم، بعد 14 يوماً'], {
                lines: [
                    ['Give iron. Return in 14 days for more iron; continue every 14 days for 2 months.', 'أعطِ الحديد. العودة بعد 14 يوماً لمزيد من الحديد؛ واصل كل 14 يوماً لمدة شهرين.'],
                    ['Palmar pallor after 2 months: refer for assessment.', 'شحوب راحة اليد بعد شهرين: حوّله للتقييم.'],
                ],
            }),
            block('fu_sam', ['UNCOMPLICATED SEVERE ACUTE MALNUTRITION, after 14 days', 'سوء التغذية الحاد الشديد بدون مضاعفات، بعد 14 يوماً'], {
                lines: [
                    ['Full reassessment; same measurements (WFH/L, MUAC) as the first visit; check oedema of both feet; appetite test if 6 months or older.', 'أعد التقييم كاملاً بنفس القياسات (الوزن للطول، محيط منتصف الذراع)؛ افحص الورم في القدمين؛ واختبار الشهية إذا كان العمر 6 أشهر فأكثر.'],
                    ['Complicated (medical complication or fails appetite test): refer URGENTLY.', 'مع مضاعفات (مضاعفة طبية أو فشل اختبار الشهية): حوّله عاجلاً.'],
                    ['Still uncomplicated SAM: counsel, continue RUTF, return in 14 days.', 'لا يزال سوء تغذية حاد شديد بدون مضاعفات: انصح الأم وواصل الغذاء العلاجي والعودة بعد 14 يوماً.'],
                    ['Now moderate: continue RUTF, start other foods for age, return every 14 days until WFH/L is -2 z or more and/or MUAC 125 mm or more.', 'أصبح متوسطاً: واصل الغذاء العلاجي وابدأ الأطعمة الأخرى حسب العمر والعودة كل 14 يوماً حتى يصبح الوزن للطول -2 أو أكثر و/أو محيط الذراع 125 مم أو أكثر.'],
                    ['No acute malnutrition: praise the mother, STOP RUTF, counsel on feeding for age. Losing weight with no likely change: refer.', 'لا يوجد سوء تغذية حاد: امدح الأم وأوقف الغذاء العلاجي وانصحها بالتغذية حسب العمر. إذا استمر فقدان الوزن دون تحسن متوقع: حوّله.'],
                ],
            }),
            block('fu_mam', ['MODERATE ACUTE MALNUTRITION, after 30 days', 'سوء التغذية الحاد المتوسط، بعد 30 يوماً'], {
                lines: [
                    ['Assess with the same measurement (WFH/L or MUAC) as the first visit, check oedema of both feet and reassess feeding.', 'قيّم بنفس القياس المستخدم في الزيارة الأولى (الوزن للطول أو محيط الذراع)، وافحص الورم في القدمين وأعد تقييم التغذية.'],
                    ['No longer MAM: praise the mother and encourage her to continue.', 'لم يعد سوء تغذية متوسط: امدح الأم وشجعها على الاستمرار.'],
                    ['Still MAM: counsel on any feeding problem and return in one month, until feeding well and WFH/L -2 z or more or MUAC 12.5 cm or more.', 'لا يزال سوء تغذية متوسط: انصحها عن مشاكل التغذية والعودة بعد شهر حتى تتحسن التغذية ويصبح الوزن للطول -2 أو أكثر أو محيط الذراع 12.5 سم أو أكثر.'],
                    ['Feeding will not improve, or weight or MUAC has fallen: refer.', 'إذا لم يتوقع تحسن التغذية أو نقص الوزن أو محيط الذراع: حوّله.'],
                ],
            }),
        ]),
    ],
};

// =============================================================================
// SICK YOUNG INFANT, UP TO 2 MONTHS
// =============================================================================
export const NATIONAL_INFANT_GUIDE = {
    formType: 'guide_infant',
    version: 'Sudan national IMNCI chart booklet',
    groups: [
        group('vaccination', ['Vaccination', 'التطعيم'], [
            block('schedule', ['Immunization schedule', 'جدول التطعيم'], {
                columns: [['Age', 'العمر'], ['Vaccine', 'التطعيم']],
                rows: [
                    [['Birth', 'عند الولادة'], ['BCG, OPV 0', 'البي سي جي، شلل الأطفال 0']],
                    [['6 weeks', '6 أسابيع'], ['Pentavalent 1, OPV 1 + IPV 1, Rota 1, PCV 1', 'الخماسي 1، شلل الأطفال 1 + شلل الأطفال بالحقن 1، الروتا 1، المكورات الرئوية 1']],
                    [['10 weeks', '10 أسابيع'], ['Pentavalent 2, OPV 2, Rota 2, PCV 2', 'الخماسي 2، شلل الأطفال 2، الروتا 2، المكورات الرئوية 2']],
                ],
            }),
            block('rules', ['Immunize every sick young infant as needed', 'طعّم كل رضيع صغير مريض حسب الحاجة'], {
                lines: [
                    ['Give all missed doses on this visit.', 'أعطِ كل الجرعات الفائتة في هذه الزيارة.'],
                    ['Include sick infants unless being referred.', 'يشمل ذلك الرضع المرضى إلا إذا كانوا سيُحوّلون.'],
                    ['Advise the caretaker when to return for the next dose.', 'انصح مقدم الرعاية بموعد العودة للجرعة التالية.'],
                    ['Mother: advise her to receive vitamin A immediately after delivery.', 'الأم: انصحها بأخذ فيتامين أ مباشرة بعد الولادة.'],
                ],
            }),
        ]),

        group('local', ['Local treatment', 'العلاج الموضعي'], [
            block('warm', ['Keep the young infant warm on the way to the hospital', 'تدفئة الرضيع الصغير أثناء الطريق للمستشفى'], {
                lines: [
                    ['Hold the infant in skin-to-skin contact, OR', 'احملي الرضيع بملامسة الجلد للجلد، أو'],
                    ['Keep the infant clothed or covered all the time: extra clothing with hat, gloves and socks, wrapped in a soft dry cloth and covered with a blanket.', 'أبقي الرضيع مكسواً أو مغطى طوال الوقت: ملابس إضافية مع طاقية وقفازات وجوارب، ولفّيه بقطعة قماش ناعمة جافة وغطيه ببطانية.'],
                ],
            }),
            block('teach', ['Teach the mother to treat local infections at home', 'علّم الأم علاج الالتهابات الموضعية بالمنزل'], {
                lines: [
                    ['Explain what the treatment is and why it should be given.', 'اشرح ما هو العلاج ولماذا يعطى.'],
                    ['Watch the mother as she does the first treatment in the clinic.', 'راقب الأم وهي تعطي أول علاج في المرفق.'],
                    ['Tell her how often to do the treatment at home, and to come back if the infection gets worse.', 'أخبرها بعدد مرات العلاج في المنزل وأن تعود إذا ساء الالتهاب.'],
                    ['Check the mother\'s understanding before she leaves the clinic.', 'تأكد من فهم الأم قبل أن تغادر المرفق.'],
                ],
            }),
            block('skin', ['Skin pustules and umbilical infection: full-strength gentian violet', 'البثور الجلدية والتهاب السرة: الجنشن فيوليت كامل التركيز'], {
                lines: [
                    ['Treat twice daily for 5 days.', 'العلاج مرتين يومياً لمدة 5 أيام.'],
                    ['Wash hands.', 'اغسلي يديك.'],
                    ['Gently wash off pus and crusts with soap and water, then dry the area.', 'اغسلي الصديد والقشور برفق بالماء والصابون ثم جففي المكان.'],
                    ['Paint the skin or umbilicus with full-strength gentian violet (0.5 %).', 'ادهني الجلد أو السرة بالجنشن فيوليت كامل التركيز (0.5 %).'],
                    ['Wash hands again.', 'اغسلي يديك مرة أخرى.'],
                ],
            }),
            block('thrush', ['Thrush (ulcers or white patches in the mouth): half-strength gentian violet', 'الفطريات (قرح أو بقع بيضاء في الفم): الجنشن فيوليت نصف التركيز'], {
                lines: [
                    ['Treat four times daily for 7 days.', 'العلاج أربع مرات يومياً لمدة 7 أيام.'],
                    ['Wash hands.', 'اغسلي يديك.'],
                    ['Wash the mouth with a clean soft cloth wrapped around the finger and wet with salt water.', 'نظّفي الفم بقطعة قماش نظيفة ناعمة ملفوفة على الإصبع ومبللة بماء وملح.'],
                    ['Paint the mouth with half-strength gentian violet (0.25 %) using a soft cloth wrapped around the finger.', 'ادهني الفم بالجنشن فيوليت نصف التركيز (0.25 %) بقطعة قماش ناعمة ملفوفة على الإصبع.'],
                    ['Wash hands again.', 'اغسلي يديك مرة أخرى.'],
                ],
            }),
            block('diarrhoea', ['Diarrhoea', 'الإسهال'], {
                lines: [['To treat diarrhoea, see the fluid plans on the sick child part (Plans A, B and C).', 'لعلاج الإسهال انظر خطط السوائل في جزء الطفل المريض (الخطط أ، ب، ج).']],
            }),
        ]),

        group('counsel', ['Counselling', 'نصح الأم'], [
            block('home_care', ['Home care for the young infant', 'الرعاية المنزلية للرضيع الصغير'], {
                lines: [
                    ['Exclusively breastfeed: give only breast milk; breastfeed as often and as long as the infant wants, day and night, in sickness and health.', 'الرضاعة الطبيعية المطلقة: أعطِ لبن الأم فقط؛ أرضعيه كلما أراد ولأطول مدة ليلاً ونهاراً في المرض والصحة.'],
                    ['Make sure the young infant is kept warm all the time; in cool weather cover the head and feet and add extra clothing.', 'تأكدي من تدفئة الرضيع طوال الوقت؛ وفي الجو البارد غطي رأسه وقدميه وأضيفي ملابس.'],
                    ['Know when to return (see Follow-up).', 'اعرفي متى تعودين (انظري المتابعة).'],
                ],
            }),
            block('attachment', ['Teach correct positioning and attachment for breastfeeding', 'علّم الوضع والالتقام الصحيح للرضاعة'], {
                lines: [
                    ['Hold the infant with head and body in line, nose opposite the nipple, close to the mother\'s body, whole body supported.', 'احملي الرضيع بحيث يكون الرأس والجسم على خط واحد، والأنف مقابل الحلمة، وقريباً من جسمك، مع سند الجسم كله.'],
                    ['Touch the infant\'s lips with the nipple, wait until the mouth opens wide, then bring the infant quickly onto the breast, lower lip well below the nipple.', 'المسي شفتي الرضيع بالحلمة وانتظري حتى يفتح فمه واسعاً ثم قربيه بسرعة للثدي بحيث تكون الشفة السفلى أسفل الحلمة جيداً.'],
                    ['Look for signs of good attachment and effective suckling; if not good, try again.', 'انظري لعلامات الالتقام الجيد والمص الفعال؛ وإذا لم يكن جيداً حاولي مرة أخرى.'],
                ],
            }),
            block('express', ['Teach the mother how to express breast milk', 'علّم الأم كيف تعصر لبن الثدي'], {
                lines: [
                    ['Wash hands thoroughly and sit comfortably; hold a wide-necked container under the nipple and areola.', 'اغسلي يديك جيداً واجلسي براحة؛ وضعي إناءً واسع الفتحة تحت الحلمة والهالة.'],
                    ['Place the thumb on top and the first finger under the breast, opposite each other, at least 4 cm from the nipple tip.', 'ضعي الإبهام أعلى الثدي والسبابة أسفله مقابلين لبعضهما على بعد 4 سم على الأقل من طرف الحلمة.'],
                    ['Compress and release a few times; if no milk, move closer to the nipple. Go all the way around the breast without squeezing the nipple or rubbing the skin.', 'اضغطي وأرخي عدة مرات؛ وإذا لم يخرج اللبن قربي الأصابع من الحلمة. تحركي حول الثدي كله دون عصر الحلمة أو فرك الجلد.'],
                    ['Express one breast until the milk just drips, then the other; alternate 5 or 6 times for at least 20 to 30 minutes.', 'اعصري ثدياً حتى يقطر اللبن ثم الآخر؛ وبدّلي 5 أو 6 مرات لمدة 20 إلى 30 دقيقة على الأقل.'],
                ],
            }),
            block('mother', ['Assess the mother\'s own health', 'تقييم صحة الأم'], {
                lines: [
                    ['Nutritional status and anaemia, contraception.', 'الحالة الغذائية وفقر الدم ووسائل منع الحمل.'],
                    ['Advise her to receive vitamin A immediately after delivery.', 'انصحها بأخذ فيتامين أ مباشرة بعد الولادة.'],
                    ['Check hygienic practices.', 'تحقق من ممارسات النظافة.'],
                ],
            }),
        ]),

        group('followup', ['Follow-up', 'المتابعة'], [
            block('when', ['When to return for follow-up', 'متى يعود للمتابعة'], {
                columns: [['If the young infant has', 'إذا كان لدى الرضيع الصغير'], ['Return for follow-up in', 'يعود للمتابعة بعد']],
                rows: [
                    [['JAUNDICE', 'يرقان'], ['1 day', 'يوم واحد']],
                    [['LOCAL BACTERIAL INFECTION (umbilical infection, pustules, eye infection), ANY FEEDING PROBLEM, ORAL THRUSH, SOME DEHYDRATION or NO DEHYDRATION (if not improving)', 'التهاب بكتيري موضعي (التهاب السرة، بثور، التهاب العين)، أي مشكلة في التغذية، فطريات الفم، بعض الجفاف أو لا يوجد جفاف (إذا لم يتحسن)'], ['2 days', 'يومان']],
                    [['LOW WEIGHT FOR AGE (in a breastfed infant)', 'نقص الوزن بالنسبة للعمر (في رضيع يرضع رضاعة طبيعية)'], ['14 days', '14 يوماً']],
                ],
            }),
            block('return_now', ['When to return immediately', 'متى يعود فوراً'], {
                lines: [
                    ['Advise the mother to return immediately if the young infant has any of these:', 'انصح الأم أن تعود فوراً إذا ظهرت على الرضيع أي من هذه العلامات:'],
                    ['Breastfeeding or drinking poorly', 'يرضع أو يشرب بصعوبة'],
                    ['Moves only when stimulated, or not moving at all', 'يتحرك فقط عند التنبيه أو لا يتحرك إطلاقاً'],
                    ['Convulsions', 'تشنجات'],
                    ['Becomes sicker', 'ساءت حالته'],
                    ['Develops a fever', 'أصيب بالحمى'],
                    ['Feels unusually cold', 'أصبح بارداً بشكل غير عادي'],
                    ['Fast breathing', 'تنفس سريع'],
                    ['Difficult breathing', 'صعوبة في التنفس'],
                    ['Blood in stool', 'دم في البراز'],
                    ['Yellow palms and soles', 'اصفرار راحتي اليدين وباطن القدمين'],
                ],
            }),
            block('fu_local', ['LOCAL BACTERIAL INFECTION, after 2 days', 'الالتهاب البكتيري الموضعي، بعد يومين'], {
                lines: [
                    ['Assess every young infant for very severe disease during the follow-up visit.', 'قيّم كل رضيع صغير لمرض شديد جداً أثناء زيارة المتابعة.'],
                    ['Look at the umbilicus: is it red or draining pus? Look at the skin pustules.', 'انظر للسرة: هل هي حمراء أو ينزل منها صديد؟ انظر للبثور الجلدية.'],
                    ['Umbilical pus or redness the same or worse, or pustules the same or worse: refer to hospital.', 'صديد أو احمرار السرة كما هو أو أسوأ، أو البثور كما هي أو أسوأ: حوّله للمستشفى.'],
                    ['Improved: continue the 5 days of antibiotic and continue treating the local infection at home.', 'تحسن: أكمل 5 أيام من المضاد الحيوي وواصل علاج الالتهاب الموضعي بالمنزل.'],
                ],
            }),
            block('fu_diarrhoea', ['DIARRHOEA, after 2 days', 'الإسهال، بعد يومين'], {
                lines: [
                    ['Ask: has the diarrhoea stopped?', 'اسأل: هل توقف الإسهال؟'],
                    ['Not stopped: assess, classify and treat the young infant for diarrhoea.', 'لم يتوقف: قيّم وصنّف وعالج الرضيع للإسهال.'],
                    ['Stopped: tell the mother to continue exclusive breastfeeding.', 'توقف: انصح الأم بمواصلة الرضاعة الطبيعية المطلقة.'],
                ],
            }),
            block('fu_jaundice', ['JAUNDICE, after 1 day', 'اليرقان، بعد يوم واحد'], {
                lines: [
                    ['Look for jaundice: are the palms and soles yellow?', 'انظر لليرقان: هل راحتا اليدين وباطن القدمين صفراء؟'],
                    ['Yellow palms and soles: classify as SEVERE JAUNDICE and refer URGENTLY.', 'اصفرار راحتي اليدين وباطن القدمين: صنّف كيرقان شديد وحوّله عاجلاً.'],
                    ['Not yellow but jaundice not decreased: home care advice and follow up daily until it starts to decrease.', 'لا يوجد اصفرار بالراحتين لكن اليرقان لم يقل: انصح بالرعاية المنزلية وتابع يومياً حتى يبدأ في النقصان.'],
                    ['Decreasing: reassure, continue home care, return at 2 weeks of age. Jaundice beyond two weeks of age: refer for assessment.', 'بدأ في النقصان: طمئن الأم وواصل الرعاية المنزلية والعودة عند عمر أسبوعين. استمرار اليرقان بعد أسبوعين من العمر: حوّله للتقييم.'],
                ],
            }),
            block('fu_feeding', ['FEEDING PROBLEM, after 2 days', 'مشكلة التغذية، بعد يومين'], {
                lines: [
                    ['Reassess feeding and ask about problems found at the first visit.', 'أعد تقييم التغذية واسأل عن المشاكل التي وجدت في الزيارة الأولى.'],
                    ['Counsel about new or continuing problems; if significant changes are advised, ask her to bring the infant back.', 'انصح الأم عن أي مشكلة جديدة أو مستمرة؛ وإذا نصحت بتغييرات كبيرة اطلب منها إحضار الرضيع مرة أخرى.'],
                    ['Low weight for age: return 14 days after this visit; continue until gaining weight well.', 'نقص الوزن للعمر: العودة بعد 14 يوماً من هذه الزيارة؛ والاستمرار حتى يكتسب الوزن جيداً.'],
                    ['Feeding will not improve, or the infant has lost weight: refer.', 'إذا لم يتوقع تحسن التغذية أو فقد الرضيع وزناً: حوّله.'],
                ],
            }),
            block('fu_thrush', ['THRUSH, after 2 days', 'الفطريات، بعد يومين'], {
                lines: [
                    ['Look for ulcers or white patches in the mouth and reassess feeding.', 'انظر للقرح أو البقع البيضاء في الفم وأعد تقييم التغذية.'],
                    ['Worse: check the treatment is given correctly; problems with attachment or suckling, refer.', 'أسوأ: تأكد أن العلاج يعطى بطريقة صحيحة؛ وإذا كانت هناك مشكلة في الالتقام أو المص حوّله.'],
                    ['Same or better and feeding well: continue half-strength gentian violet for a total of 7 days.', 'كما هي أو أفضل ويرضع جيداً: واصل الجنشن فيوليت نصف التركيز لمدة 7 أيام.'],
                ],
            }),
            block('fu_lwa', ['LOW WEIGHT FOR AGE, after 14 days', 'نقص الوزن للعمر، بعد 14 يوماً'], {
                lines: [
                    ['Weigh the infant and reassess feeding.', 'زِن الرضيع وأعد تقييم التغذية.'],
                    ['No longer low weight: praise the mother and encourage her.', 'لم يعد ناقص الوزن: امدح الأم وشجعها.'],
                    ['Still low weight but feeding well: praise; weigh again within 14 days or at immunization, whichever is earlier.', 'لا يزال ناقص الوزن لكنه يرضع جيداً: امدح الأم؛ وأعد الوزن خلال 14 يوماً أو عند التطعيم أيهما أقرب.'],
                    ['Still low weight with a feeding problem: counsel, return in 14 days; continue every few weeks until feeding well and gaining weight.', 'لا يزال ناقص الوزن ولديه مشكلة تغذية: انصح الأم والعودة بعد 14 يوماً؛ وتابع كل بضعة أسابيع حتى يرضع جيداً ويكتسب الوزن.'],
                    ['Feeding will not improve, or the infant has lost weight: refer.', 'إذا لم يتوقع تحسن التغذية أو فقد الرضيع وزناً: حوّله.'],
                ],
            }),
        ]),
    ],
};

export const NATIONAL_GUIDES = { guide_child: NATIONAL_CHILD_GUIDE, guide_infant: NATIONAL_INFANT_GUIDE };
