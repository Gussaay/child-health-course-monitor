// src/components/imnci/onlineCourses/editor/elements.js
//
// The kinds of element a lesson is built from, as the lesson editor offers
// them: their names, the group they sit in on the "Add" menu, and what a new
// one starts as. The saved block types are the same ones learners' lessons are
// rendered from, so nothing already written changes.
import {
    Pilcrow, Flag, Users, Image as ImageIcon, Film, BookOpen, ClipboardList, ListOrdered, HelpCircle, Layers, Lightbulb,
    Shuffle, Calculator, BookOpenCheck, Stethoscope, Search, Timer, Palette, LineChart, NotebookPen, Link2, FileImage, Table,
} from 'lucide-react';
import { newQuestion, newExerciseLink, isFacilitatorBlock, isActivity } from '../../book';

export const newCase = () => ({ child: { name: '', age: '' }, text: '', record: [], question: 'What is the classification?', options: ['', ''], answer: 0, explanation: '' });

// [type, English name, icon, group, one-line description]
export const ELEMENTS = [
    ['text', 'Text', Pilcrow, 'write', 'Paragraphs, headings, lists, pictures in the text'],
    ['sudan', 'Sudan protocol note', Flag, 'write', 'Where Sudan differs from WHO'],
    ['note', 'Key point', Lightbulb, 'write', 'A labelled box that stands out'],
    ['facilitator', 'Facilitator note', Users, 'write', 'Shown in Protocol management, never to learners'],
    ['courselink', 'Link to a module', Link2, 'write', 'Opens another module or lesson'],
    ['video', 'Video', Film, 'show', 'YouTube or MP4, with chapters and questions'],
    ['steps', 'Step by step', ListOrdered, 'show', 'Numbered steps, each with a picture'],
    ['booklet', 'Chart booklet table', BookOpen, 'show', 'Live from Protocol management'],
    ['form', 'Recording form', ClipboardList, 'show', 'Rows of the national form'],
    ['question', 'Question', HelpCircle, 'check', 'One or several right answers'],
    ['reveal', 'Think first', Lightbulb, 'check', 'Think, then tap to see the answer'],
    ['flip', 'Flip cards', Layers, 'check', 'Front and back, tap to turn'],
    ['sort', 'Sort it', Shuffle, 'check', 'Put each item in its group'],
    ['calc', 'Work it out', Calculator, 'check', 'A dose or amount to calculate'],
    ['classcards', 'Colour cards', Palette, 'check', 'Pink, yellow and green classifications'],
    ['story', 'Case in stages', BookOpenCheck, 'practise', 'A child’s case told step by step'],
    ['scenario', 'Practice cases', Stethoscope, 'practise', 'Read the form and classify'],
    ['exercise', 'Case from the exercise manager', Stethoscope, 'practise', 'Pick a case already written there'],
    ['spot', 'Find the error', Search, 'practise', 'Spot the wrong entry on a form'],
    ['drill', 'Skill drill', Timer, 'practise', 'Count breaths, look at a sign'],
    ['growthchart', 'Plot on the chart', LineChart, 'practise', 'Weight and length on the z-score chart'],
    ['reflect', 'Reflect', NotebookPen, 'practise', 'Questions to think over'],
];

// Elements that come from a converted book. They are kept and can be moved or
// removed, but not added from the menu.
const BOOK_ONLY = { page: ['Book page', FileImage], image: ['Picture from the book', ImageIcon], table: ['Table from the book', Table] };

export const GROUPS = [
    ['write', 'Write'],
    ['show', 'Show'],
    ['check', 'Check understanding'],
    ['practise', 'Practise with cases'],
];

/** What the editor calls a block: its menu kind, which tells Sudan and facilitator notes apart from other notes. */
export function kindOf(b) {
    if (!b) return 'text';
    if (b.type === 'rich') return 'text';
    if (b.type === 'note') {
        if (isFacilitatorBlock(b)) return 'facilitator';
        if (/sudan/i.test(b.label || '')) return 'sudan';
        return 'note';
    }
    return b.type;
}

export function elementInfo(b) {
    const kind = kindOf(b);
    const row = ELEMENTS.find((e) => e[0] === kind);
    if (row) return { kind, name: row[1], Icon: row[2], group: row[3], activity: isActivity(b) };
    const book = BOOK_ONLY[b?.type];
    if (book) return { kind, name: book[0], Icon: book[1], group: 'show', activity: false };
    return { kind, name: b?.type || 'Element', Icon: Pilcrow, group: 'write', activity: isActivity(b) };
}

/** A new element of the given menu kind. */
export function newElement(kind) {
    switch (kind) {
        case 'text': return { type: 'rich', text: '' };
        case 'question': return newQuestion();
        case 'exercise': return newExerciseLink();
        case 'booklet': return { type: 'booklet', part: 'child', categories: [], caption: '' };
        case 'form': return { type: 'form', part: 'child', sections: [], caption: '' };
        case 'sudan': return { type: 'note', label: 'Sudan national protocol', text: '' };
        case 'note': return { type: 'note', label: 'Key point', text: '' };
        case 'facilitator': return { type: 'note', label: 'From your facilitator', text: '', facilitator: true };
        case 'calc': return { type: 'calc', title: '', text: '', question: '', answer: 0, tolerance: 0, unit: 'ml', hint: '', explanation: '' };
        case 'reveal': return { type: 'reveal', text: '', answer: '' };
        case 'flip': return { type: 'flip', title: '', cards: [{ front: '', back: '' }, { front: '', back: '' }] };
        case 'sort': return { type: 'sort', text: '', groups: ['', ''], items: [{ text: '', group: 0 }], explanation: '' };
        case 'steps': return { type: 'steps', title: '', steps: [{ title: '', text: '' }] };
        case 'story': return { type: 'story', title: '', stages: [{ text: '', question: '', options: [], answer: 0, explanation: '' }] };
        case 'growthchart': return { type: 'growthchart', title: '', text: '', sex: 'female', ageMonths: 12, weightKg: 8, lengthCm: 72, explanation: '' };
        case 'courselink': return { type: 'courselink', course: 'IMNCI distance learning modules', module: 1, lesson: '', label: '', text: '' };
        case 'scenario': return { type: 'scenario', title: '', text: '', part: 'child', categories: [], cases: [newCase()] };
        case 'spot': return { type: 'spot', title: 'Find the error', text: '', part: 'child', child: {}, record: [], explanation: '' };
        case 'drill': return { type: 'drill', title: '', text: '', url: '', given: '', count: { answer: 0, tolerance: 2, unit: 'breaths per minute' }, question: '', options: [], answer: 0, explanation: '' };
        case 'classcards': return { type: 'classcards', title: '', text: '', cards: [{ colour: 'pink', label: '', action: '', signs: '', treat: '' }] };
        case 'reflect': return { type: 'reflect', title: '', text: '', prompts: [''], rating: false };
        default: return { type: 'video', url: '', title: '', caption: '' };
    }
}

// Block types written as text. Runs of them are edited as one text element.
const TEXT_TYPES = ['paragraph', 'rich', 'heading', 'list'];
export const isTextBlock = (b) => TEXT_TYPES.includes(b?.type) || (b?.type === 'note' && !b.label && !isFacilitatorBlock(b));
