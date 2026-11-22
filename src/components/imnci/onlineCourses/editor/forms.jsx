// src/components/imnci/onlineCourses/editor/forms.jsx
//
// The form for each kind of lesson element, opened from the lesson editor.
// Every field has a name, and every list is one box per item.
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload } from 'lucide-react';
import { NATIONAL_PROTOCOLS } from '../../nationalProtocol';
import { NATIONAL_FORMS } from '../../recordingForms';
import { useImnci } from '../../shared';
import { toSeconds, toClock } from '../cardText';
import { BookImage } from '../blocks';
import { Field, Choice, Tick, RowList, TextList, AnswersEditor, RecordEditor } from './rows';
import { kindOf, newCase } from './elements';
import { useCourseScreen } from '../screen';

// A time in a video, typed as 1:05. Kept as typed while the author types, and
// saved in seconds; an empty box removes it.
export function ClockField({ label, hint, seconds, placeholder, onChange }) {
    const [text, setText] = useState(seconds != null ? toClock(seconds) : '');
    return (
        <Field label={label} hint={hint} value={text} placeholder={placeholder}
            onChange={(v) => { setText(v); onChange(String(v).trim() ? toSeconds(v) : undefined); }} />
    );
}

const toggle = (list = [], id) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

function Checks({ label, hint, options, value = [], onChange }) {
    return (
        <div>
            <div className="text-sm font-semibold text-slate-700 mb-1">{label}</div>
            {hint && <div className="text-xs text-slate-500 -mt-0.5 mb-1.5">{hint}</div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {options.map(([id, name]) => (
                    <label key={id} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm ${value.includes(id) ? 'border-sky-400 bg-sky-50' : 'border-slate-200 bg-white'}`}>
                        <input type="checkbox" checked={value.includes(id)} onChange={() => onChange(toggle(value, id))} className="w-4 h-4 accent-sky-600" />
                        {name}
                    </label>
                ))}
            </div>
        </div>
    );
}

function Group({ title, children }) {
    return (
        <fieldset className="rounded-xl border border-slate-200 p-3 space-y-3">
            {title && <legend className="px-1 text-xs font-bold uppercase tracking-wide text-slate-500">{title}</legend>}
            {children}
        </fieldset>
    );
}

const PART_OPTIONS = (t) => [['child', t('clinical_ui.protocol.parts.child', 'Sick child (2 months – 5 years)')], ['infant', t('clinical_ui.protocol.parts.infant', 'Young infant (up to 2 months)')]];
const bookletTables = (part) => Object.entries(NATIONAL_PROTOCOLS[part === 'infant' ? 'infant' : 'child']?.categories || {}).map(([id, c]) => [id, c.title || id]);

// The child at the top of a filled form.
function ChildFields({ child = {}, onChange, t }) {
    const fields = [['name', t('imnci_ui.courses.practice.name', 'Name')], ['age', t('imnci_ui.courses.practice.age', 'Age')],
        ['weight', `${t('imnci_ui.courses.practice.weight', 'Weight')} (kg)`], ['length', `${t('imnci_ui.courses.practice.length', 'Length or height')} (cm)`],
        ['temp', `${t('imnci_ui.courses.practice.temperature', 'Temperature')} (°C)`], ['muac', 'MUAC (cm)']];
    return (
        <Group title={t('imnci_ui.courses.editor2.the_child', 'The child')}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {fields.map(([k, label]) => <Field key={k} label={label} value={child[k]} onChange={(v) => onChange({ ...child, [k]: v })} />)}
            </div>
            <Field label={t('imnci_ui.courses.editor2.problem', 'The child’s problems')} value={child.problem} onChange={(v) => onChange({ ...child, problem: v })} />
        </Group>
    );
}

// A question inside a case, a stage or a drill.
function QuestionPart({ q, onChange, t, label }) {
    return (
        <Group title={label || t('imnci_ui.courses.editor2.question', 'Question')}>
            <Field label={t('imnci_ui.courses.editor2.question_text', 'The question')} value={q.question} onChange={(v) => onChange({ question: v })} />
            <AnswersEditor q={q} onChange={onChange} />
            <Field label={t('imnci_ui.courses.editor2.why', 'Why (shown after answering)')} value={q.explanation} area rows={2} onChange={(v) => onChange({ explanation: v })} />
        </Group>
    );
}

// A picture for a step: a course file, or one uploaded from the device.
function PictureField({ value, onChange, upload, t }) {
    const [busy, setBusy] = useState(false);
    const input = React.useRef(null);
    return (
        <div className="flex gap-2 items-end">
            <Field className="flex-1" value={value} onChange={(v) => onChange(v || undefined)}
                placeholder={t('imnci_ui.courses.editor2.picture_path', 'Picture (optional), e.g. imnci-photos/photo-12.jpg')} />
            {upload && (
                <>
                    <input ref={input} type="file" accept="image/*" hidden onChange={async (e) => {
                        const f = e.target.files?.[0]; e.target.value = '';
                        if (!f) return;
                        setBusy(true);
                        const path = await upload(f);
                        setBusy(false);
                        if (path) onChange(path);
                    }} />
                    <button type="button" disabled={busy} onClick={() => input.current?.click()}
                        className="h-[38px] px-3 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-sky-700 inline-flex items-center gap-1.5 disabled:opacity-50">
                        <Upload size={15} /> {busy ? t('imnci_ui.courses.editor2.uploading', 'Uploading…') : t('imnci_ui.courses.editor2.upload', 'Upload')}
                    </button>
                </>
            )}
        </div>
    );
}

/**
 * The form for one element. `onChange(patch)` merges into the element;
 * `uploadPicture(file)` stores a picture and hands back its course-file path.
 */
export function ElementForm({ block: b, onChange: set, uploadPicture }) {
    const { t } = useTranslation();
    const { exercises } = useImnci() || {};
    const kind = kindOf(b);
    const title = <Field label={t('imnci_ui.courses.editor2.title', 'Title')} value={b.title} onChange={(v) => set({ title: v })} />;
    const intro = (placeholder) => <Field label={t('imnci_ui.courses.editor2.what_to_do', 'What the learner does')} value={b.text} area rows={2} placeholder={placeholder} onChange={(v) => set({ text: v })} />;
    const why = <Field label={t('imnci_ui.courses.editor2.why', 'Why (shown after answering)')} value={b.explanation} area rows={2} onChange={(v) => set({ explanation: v })} />;

    switch (kind) {
        case 'sudan':
        case 'note':
        case 'facilitator':
            return (
                <div className="space-y-3">
                    {kind === 'facilitator' && (
                        <p className="rounded-lg bg-violet-50 border border-violet-200 px-3 py-2 text-sm text-violet-900">
                            {t('imnci_ui.courses.editor2.facilitator_hint', 'Learners never see this note. Facilitators find it in Protocol management > Facilitator guides.')}
                        </p>
                    )}
                    <Field label={t('imnci_ui.courses.editor2.heading', 'Heading')} value={b.label} onChange={(v) => set({ label: v })} />
                    <Field label={t('imnci_ui.courses.editor2.note', 'Note')} value={b.text} area rows={5}
                        placeholder={kind === 'sudan' ? t('imnci_ui.courses.editor.sudan_placeholder', 'What the Sudan national protocol says, then what the WHO module says.') : ''}
                        onChange={(v) => set({ text: v })} />
                </div>
            );

        case 'video':
            return (
                <div className="space-y-3">
                    {title}
                    <Field label={t('imnci_ui.courses.editor2.video_link', 'Video link')} value={b.url}
                        hint={t('imnci_ui.courses.editor2.video_link_hint', 'A YouTube link or a link to an MP4. Leave it empty while the video is still being recorded.')}
                        placeholder="https://www.youtube.com/watch?v=…" onChange={(v) => set({ url: v })} />
                    <div className="grid grid-cols-2 gap-2">
                        <ClockField label={t('imnci_ui.courses.editor2.clip_start', 'Play from (optional)')} seconds={b.start}
                            hint={t('imnci_ui.courses.editor2.clip_hint', 'To show only a part of the video, e.g. 0:46 to 1:31.')} placeholder="0:46"
                            onChange={(v) => set({ start: v })} />
                        <ClockField label={t('imnci_ui.courses.editor2.clip_end', 'Stop at (optional)')} seconds={b.end} placeholder="1:31"
                            onChange={(v) => set({ end: v })} />
                    </div>
                    <Field label={t('imnci_ui.courses.editor.caption', 'Caption')} value={b.caption} onChange={(v) => set({ caption: v })} />
                    <Field label={t('imnci_ui.courses.editor2.script', 'Narration script number (in the video scripts file)')} value={b.script} onChange={(v) => set({ script: v })} />
                    <RowList label={t('imnci_ui.courses.editor.chapters', 'Chapters')} items={(b.chapters || []).map((c) => ({ ...c, at: toClock(c.at) }))}
                        itemName={t('imnci_ui.courses.editor2.chapter', 'Chapter')} addLabel={t('imnci_ui.courses.editor2.add_chapter', 'Add a chapter')}
                        newItem={{ at: '0:00', label: '' }}
                        onChange={(list) => set({ chapters: list.map((c) => ({ ...c, at: toSeconds(c.at) })) })}
                        render={(c, s) => (
                            <div className="grid grid-cols-[6rem_1fr] gap-2">
                                <Field value={c.at} onChange={(v) => s({ at: v })} placeholder="1:05" />
                                <Field value={c.label} onChange={(v) => s({ label: v })} placeholder={t('imnci_ui.courses.editor2.chapter_name', 'Chapter name')} />
                            </div>
                        )} />
                    <RowList label={t('imnci_ui.courses.editor2.stops', 'Pause-and-answer questions (MP4 videos only)')}
                        items={(b.stops || []).map((x) => ({ ...x, at: toClock(x.at) }))}
                        itemName={t('imnci_ui.courses.editor2.stop', 'Pause')} addLabel={t('imnci_ui.courses.editor2.add_stop', 'Add a pause with a question')}
                        newItem={() => ({ at: '0:00', text: '', options: ['', ''], answer: 0, explanation: '' })}
                        onChange={(list) => set({ stops: list.map((x) => ({ ...x, at: toSeconds(x.at) })) })}
                        render={(x, s) => (
                            <>
                                <div className="grid grid-cols-[6rem_1fr] gap-2">
                                    <Field label={t('imnci_ui.courses.editor2.at', 'At')} value={x.at} onChange={(v) => s({ at: v })} placeholder="1:05" />
                                    <Field label={t('imnci_ui.courses.editor2.question_text', 'The question')} value={x.text} onChange={(v) => s({ text: v })} />
                                </div>
                                <AnswersEditor q={x} onChange={s} allowMulti={false} withFeedback={false} />
                                <Field label={t('imnci_ui.courses.editor2.why', 'Why (shown after answering)')} value={x.explanation} onChange={(v) => s({ explanation: v })} />
                            </>
                        )} />
                </div>
            );

        case 'question':
            return (
                <div className="space-y-3">
                    <Field label={t('imnci_ui.courses.editor2.question_text', 'The question')} value={b.text} area rows={2} onChange={(v) => set({ text: v })} />
                    <AnswersEditor q={b} onChange={set} />
                    {why}
                </div>
            );

        case 'reveal':
            return (
                <div className="space-y-3">
                    <Field label={t('imnci_ui.courses.editor2.think', 'What the learner thinks about first')} value={b.text} area rows={2} onChange={(v) => set({ text: v })} />
                    <Field label={t('imnci_ui.courses.editor2.reveal_answer', 'The answer, shown when they tap')} value={b.answer} area rows={3} onChange={(v) => set({ answer: v })} />
                </div>
            );

        case 'flip':
            return (
                <div className="space-y-3">
                    {title}
                    <RowList label={t('imnci_ui.courses.editor2.cards', 'Cards')} hint={t('imnci_ui.courses.editor2.cards_hint', 'The learner sees the front and taps to turn the card over.')}
                        items={b.cards} itemName={t('imnci_ui.courses.editor2.card', 'Card')} addLabel={t('imnci_ui.courses.editor2.add_card', 'Add a card')}
                        newItem={{ front: '', back: '' }} min={1} onChange={(v) => set({ cards: v })}
                        render={(c, s) => (
                            <>
                                <Field value={c.front} onChange={(v) => s({ front: v })} placeholder={t('imnci_ui.courses.editor2.front', 'Front')} />
                                <Field value={c.back} area rows={2} onChange={(v) => s({ back: v })} placeholder={t('imnci_ui.courses.editor2.back', 'Back')} />
                            </>
                        )} />
                </div>
            );

        case 'steps':
            return (
                <div className="space-y-3">
                    {title}
                    <RowList label={t('imnci_ui.courses.editor2.steps', 'Steps')} items={b.steps} itemName={t('imnci_ui.courses.editor2.step', 'Step')}
                        addLabel={t('imnci_ui.courses.editor2.add_step', 'Add a step')} newItem={{ title: '', text: '' }} min={1}
                        onChange={(v) => set({ steps: v })}
                        render={(st, s) => (
                            <>
                                <Field value={st.title} onChange={(v) => s({ title: v })} placeholder={t('imnci_ui.courses.editor2.step_name', 'Step name')} />
                                <Field value={st.text} area rows={2} onChange={(v) => s({ text: v })} placeholder={t('imnci_ui.courses.editor2.step_text', 'What to do')} />
                                <PictureField value={st.image} onChange={(v) => s({ image: v })} upload={uploadPicture} t={t} />
                            </>
                        )} />
                </div>
            );

        case 'sort': {
            const groups = b.groups || [];
            const groupOptions = groups.map((g, i) => [String(i), g || `${t('imnci_ui.courses.editor2.group', 'Group')} ${i + 1}`]);
            return (
                <div className="space-y-3">
                    {intro(t('imnci_ui.courses.editor2.sort_task', 'e.g. Put each sign in its row of the chart'))}
                    <RowList label={t('imnci_ui.courses.editor2.groups', 'Groups')} items={groups} itemName={t('imnci_ui.courses.editor2.group', 'Group')}
                        addLabel={t('imnci_ui.courses.editor2.add_group', 'Add a group')} newItem="" min={2}
                        onChange={(next) => set({ groups: next })}
                        onRemove={(j) => set({
                            groups: groups.filter((_, k) => k !== j),
                            items: (b.items || []).map((it) => ({ ...it, group: Number(it.group) === j ? 0 : Number(it.group) > j ? Number(it.group) - 1 : Number(it.group) })),
                        })}
                        render={(g, s) => <Field value={g} onChange={s} placeholder={t('imnci_ui.courses.editor2.group_name', 'Group name, e.g. Pink')} />} />
                    <RowList label={t('imnci_ui.courses.editor2.items', 'Items to sort')} items={b.items} itemName={t('imnci_ui.courses.editor2.item', 'Item')}
                        addLabel={t('imnci_ui.courses.editor2.add_item', 'Add an item')} newItem={{ text: '', group: 0 }} min={1}
                        onChange={(v) => set({ items: v })}
                        render={(it, s) => (
                            <>
                                <Field value={it.text} onChange={(v) => s({ text: v })} placeholder={t('imnci_ui.courses.editor2.item_text', 'The item')} />
                                <Choice label={t('imnci_ui.courses.editor2.belongs', 'Belongs in')} value={String(it.group ?? 0)} options={groupOptions} onChange={(v) => s({ group: Number(v) })} />
                                <Field value={it.why} onChange={(v) => s({ why: v || undefined })} placeholder={t('imnci_ui.courses.editor2.item_why', 'Why (optional)')} />
                            </>
                        )} />
                    {why}
                </div>
            );
        }

        case 'story':
            return (
                <div className="space-y-3">
                    {title}
                    <RowList label={t('imnci_ui.courses.editor2.stages', 'Stages')} items={b.stages} itemName={t('imnci_ui.courses.editor2.stage', 'Stage')}
                        addLabel={t('imnci_ui.courses.editor2.add_stage', 'Add a stage')} min={1}
                        newItem={() => ({ text: '', question: '', options: [], answer: 0, explanation: '' })}
                        onChange={(v) => set({ stages: v })}
                        render={(st, s) => (
                            <>
                                <Field label={t('imnci_ui.courses.editor2.happens', 'What happens')} value={st.text} area rows={2} onChange={(v) => s({ text: v })} />
                                <RowList label={t('imnci_ui.courses.editor2.dialogue', 'Conversation (optional)')}
                                    hint={t('imnci_ui.courses.editor2.dialogue_hint', 'Lines from "You" or "Health worker" show on the health worker side.')}
                                    items={st.dialogue || []} itemName={t('imnci_ui.courses.editor2.line', 'Line')} addLabel={t('imnci_ui.courses.editor2.add_line', 'Add a line')}
                                    newItem={{ who: '', text: '' }} onChange={(v) => s({ dialogue: v.length ? v : undefined })}
                                    render={(d, sd) => (
                                        <div className="grid grid-cols-[7rem_1fr] gap-2">
                                            <Field value={d.who} onChange={(v) => sd({ who: v })} placeholder={t('imnci_ui.courses.editor2.who', 'Who')} />
                                            <Field value={d.text} onChange={(v) => sd({ text: v })} placeholder={t('imnci_ui.courses.editor2.says', 'What they say')} />
                                        </div>
                                    )} />
                                <Field label={t('imnci_ui.courses.editor2.stage_question', 'A question at this point (optional)')} value={st.question} onChange={(v) => s({ question: v })} />
                                {(st.question || (st.options || []).length > 0) && <AnswersEditor q={st} onChange={s} />}
                                <Field label={t('imnci_ui.courses.editor2.why', 'Why (shown after answering)')} value={st.explanation} onChange={(v) => s({ explanation: v })} />
                            </>
                        )} />
                </div>
            );

        case 'calc': {
            const answers = Array.isArray(b.answers) && b.answers.length ? b.answers : [b.answer ?? 0];
            return (
                <div className="space-y-3">
                    {title}
                    <Field label={t('imnci_ui.courses.editor2.calc_case', 'The child')} value={b.text} area rows={2} placeholder={t('imnci_ui.courses.editor.calc_case', 'The child: age, weight and what is needed')} onChange={(v) => set({ text: v })} />
                    <Field label={t('imnci_ui.courses.editor2.calc_question', 'What to work out')} value={b.question} placeholder={t('imnci_ui.courses.editor.calc_question', 'What to work out, for example How many ml in the first hour?')} onChange={(v) => set({ question: v })} />
                    <RowList label={t('imnci_ui.courses.editor2.right_numbers', 'Right answer')} hint={t('imnci_ui.courses.editor2.right_numbers_hint', 'Add more than one when several numbers are accepted.')}
                        items={answers.map(String)} itemName={t('imnci_ui.courses.editor2.number', 'Number')} addLabel={t('imnci_ui.courses.editor2.add_number', 'Add another accepted number')}
                        newItem="" min={1}
                        onChange={(list) => { const nums = list.map((x) => (x === '' ? NaN : Number(x))); const ok = nums.filter((n) => !Number.isNaN(n)); set({ answer: ok[0] ?? 0, answers: list.length > 1 ? nums.map((n) => (Number.isNaN(n) ? 0 : n)) : undefined }); }}
                        render={(v, s) => <Field type="text" value={v} onChange={s} placeholder="0" />} />
                    <div className="grid grid-cols-2 gap-2">
                        <Field type="number" label={t('imnci_ui.courses.editor2.tolerance', 'Accept ±')} value={b.tolerance ?? 0} onChange={(v) => set({ tolerance: v ?? 0 })} />
                        <Field label={t('imnci_ui.courses.editor.calc_unit', 'Unit')} value={b.unit} onChange={(v) => set({ unit: v })} />
                    </div>
                    <Field label={t('imnci_ui.courses.editor.calc_hint', 'Hint after a wrong number')} value={b.hint} onChange={(v) => set({ hint: v })} />
                    {why}
                </div>
            );
        }

        case 'growthchart':
            return (
                <div className="space-y-3">
                    {title}
                    <Field label={t('imnci_ui.courses.editor2.the_case', 'The case (optional)')} value={b.text} area rows={2}
                        hint={t('imnci_ui.courses.editor2.growth_free', 'Leave the weight empty for free practice, where learners type their own numbers.')} onChange={(v) => set({ text: v })} />
                    <div className="grid grid-cols-2 gap-2">
                        <Choice className="col-span-2" label={t('imnci_ui.courses.editor.growth_chart', 'Chart')} value={b.chart || ''} onChange={(v) => set({ chart: v || undefined })}
                            options={[['', t('imnci_ui.courses.editor.growth_by_age', 'By age (length under 2 years, height from 2)')], ['wfl', t('imnci_ui.courses.editor.growth_wfl', 'Weight-for-length (0 to 2 years)')],
                                ['wfh', t('imnci_ui.courses.editor.growth_wfh', 'Weight-for-height (2 to 5 years)')], ['wfa', t('imnci_ui.courses.editor.growth_wfa', 'Weight-for-age (0 to 6 months)')]]} />
                        <Choice label={t('imci.growth_chart.sex', 'Sex')} value={b.sex || 'female'} onChange={(v) => set({ sex: v })}
                            options={[['female', t('imci.growth_chart.girl', 'Girl')], ['male', t('imci.growth_chart.boy', 'Boy')]]} />
                        {b.chart === 'wfa'
                            ? <Field type="number" label={t('imci.growth_chart.age_in_weeks', 'Age (weeks)')} value={b.ageWeeks} onChange={(v) => set({ ageWeeks: v })} />
                            : <Field type="number" label={t('imci.growth_chart.age_in_months', 'Age (months)')} value={b.ageMonths} onChange={(v) => set({ ageMonths: v })} />}
                        <Field type="number" label={t('imci.growth_chart.weight_kg', 'Weight (kg)')} value={b.weightKg} onChange={(v) => set({ weightKg: v })} />
                        {b.chart === 'wfa'
                            ? <Choice label={t('imnci_ui.courses.editor.growth_low', 'Is the weight low for age?')} value={b.lowWeightForAge ? 'yes' : 'no'} onChange={(v) => set({ lowWeightForAge: v === 'yes' })}
                                options={[['yes', t('imnci_ui.courses.editor.growth_low_yes', 'Yes, below the -2 line')], ['no', t('imnci_ui.courses.editor.growth_low_no', 'No')]]} />
                            : <Field type="number" label={t('imci.growth_chart.length_cm', 'Length or height (cm)')} value={b.lengthCm} onChange={(v) => set({ lengthCm: v })} />}
                    </div>
                    {why}
                </div>
            );

        case 'courselink':
            if (b.popup) return <AnnexPicker b={b} set={set} t={t} />;
            return (
                <div className="space-y-3">
                    <Field label={t('imnci_ui.courses.editor.link_course', 'Course (its title)')} value={b.course} onChange={(v) => set({ course: v })} />
                    <div className="grid grid-cols-2 gap-2">
                        <Field type="number" label={t('imnci_ui.courses.editor.link_module', 'Module number')} value={b.module} onChange={(v) => set({ module: v })} />
                        <Field label={t('imnci_ui.courses.editor2.link_lesson', 'Lesson title (optional)')} value={b.lesson} onChange={(v) => set({ lesson: v })} />
                    </div>
                    <Field label={t('imnci_ui.courses.editor.link_label', 'Label on the link (optional)')} value={b.label} onChange={(v) => set({ label: v })} />
                    <Field label={t('imnci_ui.courses.editor.link_text', 'What to do there (optional)')} value={b.text} onChange={(v) => set({ text: v })} />
                </div>
            );

        case 'scenario':
            return (
                <div className="space-y-3">
                    {title}
                    {intro('')}
                    <Choice label={t('imnci_ui.courses.editor.booklet_part', 'Chart booklet')} value={b.part || 'child'} options={PART_OPTIONS(t)} onChange={(v) => set({ part: v, categories: [] })} />
                    <Checks label={t('imnci_ui.courses.editor2.scenario_tables', 'Chart booklet tables the learner can open')} options={bookletTables(b.part)}
                        value={b.categories} onChange={(v) => set({ categories: v })} />
                    <RowList label={t('imnci_ui.courses.editor2.cases', 'Cases')} items={b.cases} itemName={t('imnci_ui.courses.editor2.case', 'Case')}
                        addLabel={t('imnci_ui.courses.editor2.add_case', 'Add a case')} newItem={newCase} min={1}
                        onChange={(v) => set({ cases: v })}
                        render={(c, s) => (
                            <>
                                <ChildFields child={c.child} onChange={(child) => s({ child })} t={t} />
                                <Field label={t('imnci_ui.courses.editor2.case_text', 'The case, a few lines')} value={c.text} area rows={3} onChange={(v) => s({ text: v })} />
                                <RecordEditor record={c.record} onChange={(v) => s({ record: v })} />
                                <QuestionPart q={c} onChange={s} t={t} />
                            </>
                        )} />
                </div>
            );

        case 'spot':
            return (
                <div className="space-y-3">
                    {title}
                    {intro('')}
                    <Choice label={t('imnci_ui.courses.editor.form_part', 'Recording form')} value={b.part || 'child'} options={PART_OPTIONS(t)} onChange={(v) => set({ part: v })} />
                    <ChildFields child={b.child} onChange={(child) => set({ child })} t={t} />
                    <RecordEditor record={b.record} withError onChange={(v) => set({ record: v })} />
                    {why}
                </div>
            );

        case 'drill':
            return (
                <div className="space-y-3">
                    {title}
                    {intro(t('imnci_ui.courses.editor.drill_task', 'The task, e.g. count the breaths for one minute'))}
                    <Field label={t('imnci_ui.courses.editor2.video_link', 'Video link')} value={b.url} onChange={(v) => set({ url: v })} />
                    <Field label={t('imnci_ui.courses.editor2.given', 'Until the video is added, tell the learner')} value={b.given} onChange={(v) => set({ given: v })} />
                    <Group title={t('imnci_ui.courses.editor2.count', 'The count')}>
                        <div className="grid grid-cols-2 gap-2">
                            <Field type="number" label={t('imnci_ui.courses.editor.drill_answer', 'Right count')} value={b.count?.answer} onChange={(v) => set({ count: { ...(b.count || {}), answer: v ?? 0 } })} />
                            <Field type="number" label={t('imnci_ui.courses.editor2.tolerance', 'Accept ±')} value={b.count?.tolerance ?? 2} onChange={(v) => set({ count: { ...(b.count || {}), tolerance: v ?? 0 } })} />
                        </div>
                        <Field label={t('imnci_ui.courses.editor.calc_unit', 'Unit')} value={b.count?.unit} onChange={(v) => set({ count: { ...(b.count || {}), unit: v } })} />
                    </Group>
                    <QuestionPart q={b} onChange={set} t={t} />
                </div>
            );

        case 'classcards':
            return (
                <div className="space-y-3">
                    {title}
                    {intro('')}
                    <RowList label={t('imnci_ui.courses.editor2.cards', 'Cards')} items={b.cards} itemName={t('imnci_ui.courses.editor2.card', 'Card')}
                        addLabel={t('imnci_ui.courses.editor2.add_card', 'Add a card')} newItem={{ colour: 'green', label: '', action: '', signs: '', treat: '' }} min={1}
                        onChange={(v) => set({ cards: v })}
                        render={(c, s) => (
                            <>
                                <Choice label={t('imnci_ui.courses.editor2.colour', 'Colour')} value={c.colour || 'green'} onChange={(v) => s({ colour: v })}
                                    options={[['pink', t('imnci_ui.courses.editor2.pink', 'Pink')], ['yellow', t('imnci_ui.courses.editor2.yellow', 'Yellow')], ['green', t('imnci_ui.courses.editor2.green', 'Green')]]} />
                                <Field label={t('imnci_ui.courses.editor2.classification', 'Classification')} value={c.label} onChange={(v) => s({ label: v })} />
                                <Field label={t('imnci_ui.courses.editor2.where_treated', 'Where treated')} value={c.action} onChange={(v) => s({ action: v })} />
                                <Field label={t('imnci_ui.courses.editor2.signs', 'Signs')} value={c.signs} area rows={2} onChange={(v) => s({ signs: v })} />
                                <Field label={t('imnci_ui.courses.editor2.treatment', 'Treatment')} value={c.treat} area rows={2} onChange={(v) => s({ treat: v })} />
                            </>
                        )} />
                </div>
            );

        case 'reflect':
            return (
                <div className="space-y-3">
                    {title}
                    {intro('')}
                    <TextList label={t('imnci_ui.courses.editor.prompts', 'Questions to think over')} items={b.prompts} itemName={t('imnci_ui.courses.editor2.prompt', 'Question')}
                        addLabel={t('imnci_ui.courses.editor2.add_prompt', 'Add a question')} onChange={(v) => set({ prompts: v })} />
                    <Tick label={t('imnci_ui.courses.editor.ask_rating', 'Ask for a 1 to 5 star rating of the module')} checked={b.rating} onChange={(v) => set({ rating: v })} />
                </div>
            );

        case 'exercise':
            return (
                <div className="space-y-3">
                    <Choice label={t('imnci_ui.courses.editor.which_case', 'Which case')} value={b.exerciseId || ''} onChange={(v) => set({ exerciseId: v })}
                        options={[['', exercises ? t('imnci_ui.courses.editor.choose_a_case', '— choose a case —') : t('imnci_ui.courses.editor.loading_cases', 'Loading the cases…')],
                            ...(exercises || []).map((ex) => [ex.id, `${ex.title}${ex.draft ? t('imnci_ui.courses.editor.draft_suffix', ' (draft)') : ''}`])]} />
                    <p className="text-xs text-slate-500">{t('imnci_ui.courses.editor.cases_written', 'Cases are written in the case builder, from Manage mode.')}</p>
                    <Field label={t('imnci_ui.courses.editor.why_here', 'Why it is here (optional)')} value={b.note} onChange={(v) => set({ note: v })} />
                </div>
            );

        case 'booklet':
            return (
                <div className="space-y-3">
                    <Choice label={t('imnci_ui.courses.editor.booklet_part', 'Chart booklet')} value={b.part || 'child'} options={PART_OPTIONS(t)} onChange={(v) => set({ part: v, categories: [] })} />
                    <Checks label={t('imnci_ui.courses.editor2.tables', 'Tables to show')}
                        hint={t('imnci_ui.courses.editor2.tables_hint', 'Read from Protocol management, so a change there shows here too.')}
                        options={bookletTables(b.part)} value={b.categories} onChange={(v) => set({ categories: v })} />
                    <Field label={t('imnci_ui.courses.editor.caption', 'Caption')} value={b.caption} onChange={(v) => set({ caption: v })} />
                </div>
            );

        case 'form':
            return (
                <div className="space-y-3">
                    <Choice label={t('imnci_ui.courses.editor.form_part', 'Recording form')} value={b.part || 'child'} options={PART_OPTIONS(t)} onChange={(v) => set({ part: v, sections: [] })} />
                    <Checks label={t('imnci_ui.courses.editor2.form_rows', 'Rows to show')} hint={t('imnci_ui.courses.editor2.form_rows_hint', 'None ticked shows the whole form.')}
                        options={(NATIONAL_FORMS[b.part === 'infant' ? 'form_infant' : 'form_child']?.sections || []).map((s) => [s.id, s.en?.title || s.id])}
                        value={b.sections} onChange={(v) => set({ sections: v })} />
                    <Field label={t('imnci_ui.courses.editor.caption', 'Caption')} value={b.caption} onChange={(v) => set({ caption: v })} />
                </div>
            );

        case 'page':
            return (
                <div className="space-y-2 text-sm text-slate-600">
                    {t('imnci_ui.courses.editor.page_captured', 'Page {{page}} of the book, captured when it was converted.', { page: b.page })}
                    <BookImage block={b} />
                </div>
            );

        default:
            return (
                <p className="text-sm text-slate-600">
                    {t('imnci_ui.courses.editor2.from_book', 'This came from the converted book. It can be moved or deleted here.')}
                </p>
            );
    }
}

// An annex button: pick the annex page (a standard operating procedure, a skill
// checklist ...) from the annexes kept in Protocol & Course Management.
function AnnexPicker({ b, set, t }) {
    const screen = useCourseScreen();
    const live = (x) => x && x.isDeleted !== true;
    const annexes = (screen?.allCourses || []).filter((c) => live(c) && c.audience === 'annex');
    const items = (screen?.allItems || []).filter(live);
    const annex = annexes.find((c) => c.title === b.course) || null;
    const modules = annex ? items.filter((i) => i.kind === 'module' && i.courseId === annex.id).sort((x, y) => (x.order || 0) - (y.order || 0)) : [];
    const mod = modules.find((m) => Number(m.order) === Number(b.module)) || null;
    const pages = mod ? items.filter((i) => i.kind === 'section' && i.moduleId === mod.id).sort((x, y) => (x.order || 0) - (y.order || 0)) : [];
    const sel = 'w-full rounded-lg border border-slate-300 text-sm';
    return (
        <div className="space-y-3" data-testid="annex-picker">
            <label className="block text-sm">
                <span className="block font-medium text-slate-700 mb-1">{t('imnci_ui.courses.editor.annex_set', 'Annex')}</span>
                <select className={sel} value={b.course || ''} onChange={(e) => set({ course: e.target.value, module: 1, lesson: '' })}>
                    <option value="">{t('imnci_ui.courses.editor.annex_choose', '— Choose —')}</option>
                    {annexes.map((c) => <option key={c.id} value={c.title}>{c.title}</option>)}
                </select>
            </label>
            {annex && (
                <label className="block text-sm">
                    <span className="block font-medium text-slate-700 mb-1">{t('imnci_ui.courses.editor.annex_part', 'Part')}</span>
                    <select className={sel} value={b.module || 1} onChange={(e) => set({ module: Number(e.target.value), lesson: '' })}>
                        {modules.map((m) => <option key={m.id} value={m.order}>{m.title}</option>)}
                    </select>
                </label>
            )}
            {mod && (
                <label className="block text-sm">
                    <span className="block font-medium text-slate-700 mb-1">{t('imnci_ui.courses.editor.annex_page', 'Page')}</span>
                    <select className={sel} value={b.lesson || ''} onChange={(e) => set({ lesson: e.target.value })}>
                        <option value="">{t('imnci_ui.courses.editor.annex_choose', '— Choose —')}</option>
                        {pages.map((p) => <option key={p.id} value={p.title}>{p.title}</option>)}
                    </select>
                </label>
            )}
            <Field label={t('imnci_ui.courses.editor.link_label', 'Label on the link (optional)')} value={b.label} onChange={(v) => set({ label: v })} />
            <Field label={t('imnci_ui.courses.editor.link_text', 'What to do there (optional)')} value={b.text} onChange={(v) => set({ text: v })} />
        </div>
    );
}
