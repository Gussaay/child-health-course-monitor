# IMNCI Online Training — Interactive Exercises

Everything lives in one folder. Copy it to `src/components/Online-exercise/`.

```
src/components/Online-exercise/
  index.js                   barrel — import everything from here
  imnciExercises.js          content library (Exercise 2 digitised + Exercise 3 template)
  exerciseGrading.js         pure scoring engine, no React / no Firebase
  ExercisePlayer.jsx         the shared player (all 4 formats)
  ExerciseViews.jsx          CourseExercisesView · PublicExerciseView · ExerciseResultsTable
  ParticipantExercises.jsx   ParticipantExercisesModal · ParticipantExerciseSummary
  exerciseService.js         Firestore read/write for attempts
```

Relative imports inside the folder assume it sits directly under `src/components/`
(it reaches for `../CommonComponents`, `../../data.js`, `../../firebase`). Same depth as
your `exercises`-free layout, so nothing else moves.

`ExercisePlayer` is the one engine. The course tab, the participant modal, and the public
link all mount it — one place to fix a bug or restyle.

---

## 1. Add the sub-course type

`src/components/constants.js`:

```js
export const IMNCI_SUBCOURSE_TYPES = [
    // ...existing entries...
    'IMNCI Online Training',
];
```

Must match `ONLINE_SUB_COURSE` exported from the folder.

---

## 2. Course page — `Course.jsx`

**Import** (with the other component imports, ~line 30):

```js
import { CourseExercisesView } from './Online-exercise';
```

**Tab button** — inside `CourseManagementView`, beside `Test Scores` (~line 1912):

```jsx
<Button disabled={isProcessing} variant="tab"
        isActive={activeCoursesTab === 'exercises'}
        onClick={() => setActiveCoursesTab('exercises')}>
    Exercises
</Button>
```

**Panel** — beside the `enter-test-scores` panel (~line 2072):

```jsx
{activeCoursesTab === 'exercises' && selectedCourse && (
    <CourseExercisesView
        course={selectedCourse}
        participants={participants}
        selectedParticipantId={selectedParticipantId}
    />
)}
```

`'exercises'` is course-scoped — do **not** add it to `globalTabs`.

The tab has two sub-tabs: **Exercise Results** (whole-course grid, best score per
participant per exercise, CSV export) and **Open an Exercise** (pick a participant and run
it with them).

---

## 3. Participants page — `Participants.jsx`

**Import** (top of file):

```js
import { ParticipantExercisesModal } from './Online-exercise';
```

**State** — inside `ParticipantsView`, next to the other modal state (~line 1780):

```js
const [exerciseModalParticipant, setExerciseModalParticipant] = useState(null);
```

**Table row button** — in the actions cell, after the `Report` button (~line 2705):

```jsx
{course.course_type === 'IMNCI' && (
    <Button variant="secondary" className="px-2.5 py-1 text-[11px]"
            onClick={() => setExerciseModalParticipant(p)} disabled={isProcessing}>
        Exercises
    </Button>
)}
```

**Card view button** — in the mobile card button grid, after `Report` (~line 2787):

```jsx
{course.course_type === 'IMNCI' && (
    <Button variant="secondary" className="w-full justify-center"
            onClick={() => setExerciseModalParticipant(p)} disabled={isProcessing}>
        Exercises
    </Button>
)}
```

**Modal** — near your other modals at the bottom of `ParticipantsView`'s return:

```jsx
<ParticipantExercisesModal
    isOpen={!!exerciseModalParticipant}
    onClose={() => setExerciseModalParticipant(null)}
    course={course}
    participant={exerciseModalParticipant}
/>
```

Drop the `course.course_type === 'IMNCI'` guard if you want the button on every course
type — the exercise list simply comes back empty when no exercises match the sub-course.

**Optional — participant report.** `ParticipantExerciseSummary` is a compact read-only
history panel. Put it wherever pre/post test scores already appear:

```jsx
import { ParticipantExerciseSummary } from './Online-exercise';
// ...
<ParticipantExerciseSummary course={course} participant={p} />
```

---

## 4. Public participant link

**Route** in `App.jsx`, matching your existing `/public/register/course/:id` pattern:

```jsx
import { PublicExerciseView } from './components/Online-exercise';
// ...
<Route path="/public/exercises/course/:courseId" element={<PublicExerciseRoute />} />
```

using the same `useParams` wrapper as `PublicParticipantRegistrationView`.

**Share button** — in the `Share Public Links` modal in `Course.jsx` (~line 1050):

```jsx
<div className="bg-gray-50 p-3 rounded border">
    <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-semibold">Online Exercises</span>
        <Button variant="secondary" size="sm" className="flex items-center gap-1" onClick={() => {
            const link = `${getBaseUrl()}/public/exercises/course/${shareModalCourse.id}`;
            setQrShareData({ url: link, title: `Exercises: ${shareModalCourse.course_type}` });
        }}><QrCode size={14} /> Share</Button>
    </div>
</div>
```

Participants open the link, pick their name from the course roster, and start. They must
already be registered — reusing the roster means every attempt is keyed to a real
`participantId` your reports can join on.

---

## 5. Firestore

Collection `exerciseAttempts`, doc id `courseId__participantId__exerciseId__attemptNo`.
Deterministic on purpose: an offline write replaying after reconnect overwrites itself
rather than creating a duplicate attempt.

**Rules** — the public link is unauthenticated, so scope writes tightly:

```
match /exerciseAttempts/{attemptId} {
  allow read: if request.auth != null;
  allow create, update: if
       request.resource.data.courseId is string
    && request.resource.data.participantId is string
    && request.resource.data.exerciseId is string
    && request.resource.data.percent is number
    && request.resource.data.percent >= 0
    && request.resource.data.percent <= 100
    && attemptId == request.resource.data.courseId + '__' +
                    request.resource.data.participantId + '__' +
                    request.resource.data.exerciseId + '__' +
                    string(request.resource.data.attemptNo);
  allow delete: if request.auth != null;
}
```

**Index** — Firestore prompts for the composite `courseId ASC, participantId ASC` index the
first time the participant view loads. Create it.

`responses` / `results` are stored as JSON strings (`responsesJson`, `resultsJson`) because
Firestore rejects nested arrays; `exerciseService.js` parses them back on read.

Optional — mirror the best score onto the participant record so existing reports pick it up:

```js
await saveParticipantAndSubmitFacilityUpdate({ ...participant, online_exercise_score: summary.percent });
```

---

## 6. Authoring more exercises

All content is in `imnciExercises.js`. Append to `EXERCISES`; the picker sorts by `order`
and hides `draft: true` from participants (facilitator views pass `includeDrafts`).

| `type` | Learner does | Scoring |
|---|---|---|
| `brief` | Reads the case | not scored |
| `form` | Fills recording-form fields | 1 pt per field; numbers take `tolerance`, text takes an `accept: []` spelling list |
| `checklist` | Marks each sign Present / Not present | 1 pt per sign |
| `classify` | Picks the classification(s) | all-or-nothing, 1 pt |
| `mcq` | Multiple choice; multi-select when `correct` has >1 index | all-or-nothing, 1 pt |
| `match` | Drags or taps signs onto classifications | 1 pt per pair |
| `media` | `mcq` with an image or video above | all-or-nothing, 1 pt |

`match` has tap-to-place alongside HTML5 drag — drag events don't fire reliably in the
Capacitor WebView.

`feedbackMode: 'end'` withholds feedback until the summary, for a graded assessment
rather than a teaching exercise.

Steps take optional `labelAr` / `titleAr` / `bodyAr`; the player has an EN/عربي toggle and
flips to RTL. Case 1 and the option banks are translated — Case 2 still needs it.

---

## 7. Two contradictions in your slides

**Samira, blood in stool.** Slide 3 says Present, slide 6 says Not present, slide 7
classifies Dysentery. Coded as **present**.

**Amani, sunken eyes.** Slide 9 says Present, slide 13 says Not present, slide 14
classifies Some dehydration — which needs two signs, and drinking eagerly is the only
other one. Coded as **present**.

Both are the kind of thing participants notice. Worth fixing on the slides too.

---

## Verification done

- All seven files parse clean through esbuild with the JSX loader.
- Grading engine run against Exercise 2: perfect answers score 51/51 = 100% across 16
  scored steps; every step's `correct` key validates against its own options.

Not yet built against your app — confirm `Button`'s `variant="tab"` / `size="sm"` and
`Modal`'s `size="lg"` props match your `CommonComponents`, since I inferred those from
usage in `Course.jsx`.
