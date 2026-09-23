import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronRight, CircleHelp, Copy, ExternalLink, Plus, RotateCcw, Share2, X } from 'lucide-react'
import seed from '../handoff/seed.json'
import './styles.css'

type Task = { id: string; week: number; title: string; ws: string; owner: string; due?: string; note?: string; details?: string[]; done: boolean }
type Blocker = { id: string; title: string; needs: string; meta: string; resolved?: boolean }
type Decision = { id: string; title: string; meta: string; description?: string; resolved?: boolean; resolution?: string }
type Workstream = { name: string; owner: string; d: 'green' | 'yellow' | 'red' | 'grey' }
type BudgetItem = { id: string; name: string; amt: number; status: 'planned' | 'committed' | 'paid' }

type State = { tasks: Task[]; workstreams: Workstream[]; blockers: Blocker[]; decisions: Decision[]; budget: BudgetItem[]; activity: string[]; notes: Record<string, string> }

const people = ['All', 'Ryan', 'Brian', 'Mark', 'Lizzie', 'Jeff', 'Sarah', 'Jenni', 'Pineapple', 'Tarek', 'Oleg']
const phases = [
  { label: 'W1-2 · BRAND + WIREFRAMES', copy: 'Branding exercise, Pineapple kickoff, practitioner input', tone: 'gold' },
  { label: 'W3-4 · POLISH + CODE', copy: 'UI/UX first pass, Jenni finalization, connectors', tone: 'green' },
  { label: 'W5-6 · READY TO RAISE', copy: 'Functional build, deck, docs, friendly pitches', tone: 'green' },
  { label: 'W7 · HANDS ON + RAISE', copy: 'Core community, first pitch, raise opens', tone: 'gold' },
]
const milestones = ['Sep 28 · UI/UX first pass review', 'Oct 16 · UI/UX finalized', 'Oct 23 · initial build', 'Oct 28 · first pitch', 'Nov 6 · v1 launch']
const reviewSections = [
  { title: 'Priorities + decisions', prompts: ['What are the three most important outcomes this week?', 'What changed since last week?', 'What decisions must Ryan + Brian make?', 'What is blocking the critical path?', 'What are we deliberately not doing?'] },
  { title: 'Product + users', prompts: ['What did we learn from the first twenty users?', 'What evidence are we capturing?'] },
  { title: 'Brand + narrative', prompts: ['What is becoming clearer about the KOVA story?', 'What needs to be tested next?'] },
  { title: 'UI/UX', prompts: ['Deliverable this week?', 'Risk?'] },
  { title: 'Second Brain', prompts: ['What is the next useful capability?', 'What should stay out of scope?'] },
  { title: 'Community', prompts: ['Who needs a date?', 'What will make participation valuable?'] },
  { title: 'Fundraise', prompts: ['What makes the raise credible?', 'Who should hear the story first?'] },
  { title: 'Privacy + security', prompts: ['What question will stakeholders ask?', 'What needs an owner?'] },
  { title: 'Team', prompts: ['Who needs context?', 'Where is there ambiguity?'] },
  { title: 'Budget', prompts: ['Committed / paid / remaining (of $40K)?', 'New decision required?'] },
  { title: 'Top 3 blockers + next 7 days', prompts: ['Name the top 3 blockers.', 'Commit to the next 7 days - three outcomes.'] },
]

function makeInitialState(): State {
  const tasks: Task[] = seed.plan.flatMap((week) => week.items.map((item, index) => ({ id: `w${week.n}-${index}`, week: week.n, title: item.t, ws: item.ws, owner: item.o, due: item.due, note: seed.taskInfo[`w${week.n}-${index}` as keyof typeof seed.taskInfo]?.d, details: seed.taskInfo[`w${week.n}-${index}` as keyof typeof seed.taskInfo]?.x, done: !!seed.doneSeed[`w${week.n}-${index}` as keyof typeof seed.doneSeed] })))
  return {
    tasks,
    workstreams: seed.workstreams as Workstream[],
    blockers: seed.blockers as Blocker[],
    decisions: seed.decisions as Decision[],
    budget: seed.budget as BudgetItem[],
    activity: ['System seeded from handoff plan', 'Sprint opened for the core team'],
    notes: {},
  }
}

function usePersistedState() {
  const [state, setState] = useState<State>(() => {
    try { return JSON.parse(localStorage.getItem('kova-mission-control') || '') || makeInitialState() } catch { return makeInitialState() }
  })
  useEffect(() => localStorage.setItem('kova-mission-control', JSON.stringify(state)), [state])
  return [state, setState] as const
}

const daysUntil = (date: string) => Math.max(0, Math.ceil((new Date(date).getTime() - Date.now()) / 86400000))
const money = (amount: number) => `$${amount.toLocaleString()}`

function App() {
  const [state, setState] = usePersistedState()
  const [view, setView] = useState<'week' | 'plan' | 'today'>(() => (localStorage.getItem('kova-view') as 'week' | 'plan' | 'today') || 'week')
  const [week, setWeek] = useState(2)
  const [owner, setOwner] = useState('All')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [newTask, setNewTask] = useState('')
  const [workstreamOpen, setWorkstreamOpen] = useState<string | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewIndex, setReviewIndex] = useState(0)
  const [walkthrough, setWalkthrough] = useState(false)
  const [walkIndex, setWalkIndex] = useState(0)
  const [shareOpen, setShareOpen] = useState(false)
  const [decisionDraft, setDecisionDraft] = useState('')
  const [blockerDraft, setBlockerDraft] = useState('')
  const [actor, setActor] = useState(() => localStorage.getItem('kova-actor') || '')

  const currentWeek = seed.plan.find((item) => item.n === week)!
  const visibleTasks = useMemo(() => state.tasks.filter((task) => (owner === 'All' || task.owner.includes(owner))), [state.tasks, owner])
  const weekTasks = visibleTasks.filter((task) => task.week === week)
  const doneCount = weekTasks.filter((task) => task.done).length
  const totalCount = state.tasks.length
  const completedCount = state.tasks.filter((task) => task.done).length
  const committed = state.budget.filter((item) => item.status === 'committed').reduce((sum, item) => sum + item.amt, 0)
  const paid = state.budget.filter((item) => item.status === 'paid').reduce((sum, item) => sum + item.amt, 0)
  const remaining = 40000 - committed - paid
  const log = (message: string) => setState((current) => ({ ...current, activity: [`${actor || 'Team'} ${message}`, ...current.activity].slice(0, 50) }))
  const switchView = (next: 'week' | 'plan' | 'today') => { setView(next); localStorage.setItem('kova-view', next) }

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setWalkthrough(false); setReviewOpen(false); setShareOpen(false) }
      if (walkthrough && event.key === 'ArrowRight') setWalkIndex((index) => Math.min(index + 1, seed.plan.length + 1))
      if (walkthrough && event.key === 'ArrowLeft') setWalkIndex((index) => Math.max(index - 1, 0))
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [walkthrough])

  const toggleTask = (id: string) => { setState((current) => ({ ...current, tasks: current.tasks.map((task) => task.id === id ? { ...task, done: !task.done } : task) })); log(`toggled task ${id}`) }
  const addTask = (weekNumber: number) => {
    if (!newTask.trim()) return
    const task: Task = { id: `custom-${Date.now()}`, week: weekNumber, title: newTask.trim(), ws: 'PRODUCT', owner: actor || 'Ryan', done: false, details: [] }
    setState((current) => ({ ...current, tasks: [...current.tasks, task] })); setNewTask(''); log(`added a task to W${weekNumber}`)
  }
  const saveEdit = (id: string) => { setState((current) => ({ ...current, tasks: current.tasks.map((task) => task.id === id ? { ...task, title: editTitle || task.title } : task) })); setEditing(null); log(`edited task ${id}`) }
  const cycleStatus = (name: string) => {
    const statuses: Workstream['d'][] = ['green', 'yellow', 'red', 'grey']
    setState((current) => ({ ...current, workstreams: current.workstreams.map((item) => item.name === name ? { ...item, d: statuses[(statuses.indexOf(item.d) + 1) % statuses.length] } : item) }))
    log(`updated ${name} status`)
  }
  const addBlocker = () => { if (!blockerDraft.trim()) return; setState((current) => ({ ...current, blockers: [...current.blockers, { id: `b-${Date.now()}`, title: blockerDraft.trim(), needs: 'Needs an owner and next action.', meta: 'NEW · team' }] })); setBlockerDraft(''); log('added a blocker') }
  const addDecision = () => { if (!decisionDraft.trim()) return; setState((current) => ({ ...current, decisions: [...current.decisions, { id: `d-${Date.now()}`, title: decisionDraft.trim(), meta: 'NEW · open', description: 'Resolution needed.' }] })); setDecisionDraft(''); log('added a decision') }
  const resolveDecision = (id: string) => { setState((current) => ({ ...current, decisions: current.decisions.map((item) => item.id === id ? { ...item, resolved: true, resolution: 'Resolved in Mission Control.' } : item) })); log(`resolved decision ${id}`) }
  const copy = async (text: string, label: string) => { await navigator.clipboard?.writeText(text); log(`copied ${label}`) }
  const digest = `# KOVA · Week ${week} (${currentWeek.range})\n\n${currentWeek.theme}\n\n## Done\n${weekTasks.filter((task) => task.done).map((task) => `- [x] ${task.title}`).join('\n') || '_none_'}\n\n## Open\n${weekTasks.filter((task) => !task.done).map((task) => `- [ ] ${task.title} (${task.owner})`).join('\n')}`
  const fullPlan = `# KOVA 45-Day Sprint\n\n${seed.plan.map((item) => `## W${item.n} · ${item.range}\n${state.tasks.filter((task) => task.week === item.n).map((task) => `- [${task.done ? 'x' : ' '}] ${task.title} · ${task.owner}`).join('\n')}`).join('\n\n')}`

  if (!actor) return <div className="identity-screen"><div className="identity-card"><div className="eyebrow">KOVA · MISSION CONTROL</div><h1>Who are you?</h1><p>Choose your name so the team can see who is moving the plan forward.</p><div className="identity-grid">{people.filter((person) => person !== 'All').map((person) => <button key={person} className="identity-choice" onClick={() => { setActor(person); localStorage.setItem('kova-actor', person) }}>{person}</button>)}</div><div className="identity-custom"><input placeholder="Your name" id="custom-actor" /><button onClick={() => { const name = (document.getElementById('custom-actor') as HTMLInputElement).value.trim(); if (name) { setActor(name); localStorage.setItem('kova-actor', name) } }}>enter</button></div></div></div>

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand-block"><div className="brand-line"><strong>KOVA</strong><span className="brand-dot" /><span className="eyebrow">45-DAY SPRINT · MISSION CONTROL</span></div><div className="subtitle">September 14 <span>→</span> October 28 · wireframe locked September 25 · UI/UX production-ready October 16</div></div>
      <div className="top-actions"><Metric value={String(daysUntil('2026-10-28'))} label="days to Oct 28 · first pitch" accent /><Metric value={String(daysUntil('2026-10-16'))} label="days to UI/UX ready" /><Metric value={`D${Math.max(1, Math.ceil((Date.now() - new Date('2026-09-14').getTime()) / 86400000))}`} label="sprint day" /><div className="status-live"><i /> ON TRACK</div><button className="button button-gold" onClick={() => setReviewOpen(true)}>Weekly review</button><button className="button" onClick={() => { setWalkthrough(true); setWalkIndex(0) }}>▶ Walkthrough</button><button className="button" onClick={() => setShareOpen(true)}><Share2 size={14} /> Share</button></div>
    </header>
    <div className="rule"><span className="eyebrow gold-text">THE RULE</span><span>Every workstream must answer: <b>“How does this help us create, understand, or communicate the evidence from our first twenty users?”</b> If it doesn’t, push it behind the fundraise.</span></div>
    <div className="controls"><div className="view-tabs"><button className={view === 'week' ? 'active' : ''} onClick={() => switchView('week')}>This week</button><button className={view === 'plan' ? 'active' : ''} onClick={() => switchView('plan')}>Full plan</button><button className={view === 'today' ? 'active' : ''} onClick={() => switchView('today')}>Today</button></div><div className="week-tabs">{seed.plan.map((item) => <button key={item.n} className={week === item.n && view === 'week' ? 'selected' : ''} onClick={() => { setWeek(item.n); switchView('week') }}>W{item.n}</button>)}</div><div className="owner-filter"><span className="eyebrow">OWNER</span>{people.slice(0, 7).map((person) => <button key={person} className={owner === person ? 'selected' : ''} onClick={() => setOwner(person)}>{person}</button>)}</div></div>
    {view === 'today' && <TodayView tasks={visibleTasks} onToggle={toggleTask} onOpenWeek={setWeek} />}
    {view === 'plan' && <PlanView seedPlan={seed.plan} tasks={visibleTasks} onToggle={toggleTask} onOpenWeek={(number) => { setWeek(number); switchView('week') }} onAdd={addTask} newTask={newTask} setNewTask={setNewTask} />}
    {view === 'week' && <main className="main-grid"><section className="panel priorities"><PanelHeading title={`Week ${currentWeek.n} priorities`} meta={currentWeek.range} /><p className="theme">{currentWeek.theme}</p><div className="progress-row"><div className="progress"><span style={{ width: `${weekTasks.length ? doneCount / weekTasks.length * 100 : 0}%` }} /></div><span>{doneCount} / {weekTasks.length}</span></div><div className="task-list">{weekTasks.map((task) => <TaskRow key={task.id} task={task} expanded={expanded === task.id} editing={editing === task.id} onToggle={toggleTask} onExpand={() => setExpanded(expanded === task.id ? null : task.id)} onEdit={() => { setEditing(task.id); setEditTitle(task.title) }} onSave={() => saveEdit(task.id)} editTitle={editTitle} setEditTitle={setEditTitle} />)}</div><div className="add-row"><input value={newTask} onChange={(event) => setNewTask(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addTask(week)} placeholder="Add a task to this week" /><button onClick={() => addTask(week)}><Plus size={15} /> add</button></div></section><aside className="side-stack"><section className="panel signal-panel"><PanelHeading title="Signal" meta="live team health" /><div className="signal-score"><div><strong>{Math.round(completedCount / totalCount * 100)}%</strong><span>plan complete</span></div><div className="signal-copy"><b>Ship the evidence.</b><span>{state.blockers.filter((item) => !item.resolved).length} blockers · {state.decisions.filter((item) => !item.resolved).length} decisions open</span></div></div></section><section className="panel"><PanelHeading title="Blockers" meta={`${state.blockers.filter((item) => !item.resolved).length} open`} />{state.blockers.filter((item) => !item.resolved).map((item) => <div className="list-item" key={item.id}><span className="marker red" /><div><b>{item.title}</b><small>{item.meta}</small></div><button className="icon-button" onClick={() => setState((current) => ({ ...current, blockers: current.blockers.map((blocker) => blocker.id === item.id ? { ...blocker, resolved: true } : blocker) }))}><Check size={14} /></button></div>)}<div className="inline-add"><input value={blockerDraft} onChange={(event) => setBlockerDraft(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addBlocker()} placeholder="Add blocker" /><button onClick={addBlocker}><Plus size={14} /></button></div></section><section className="panel"><PanelHeading title="Decisions needed" meta={`${state.decisions.filter((item) => !item.resolved).length} open`} />{state.decisions.filter((item) => !item.resolved).map((item) => <div className="list-item" key={item.id}><span className="marker gold" /><div><b>{item.title}</b><small>{item.meta}</small></div><button className="icon-button" onClick={() => resolveDecision(item.id)}><Check size={14} /></button></div>)}<div className="inline-add"><input value={decisionDraft} onChange={(event) => setDecisionDraft(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addDecision()} placeholder="Add decision" /><button onClick={addDecision}><Plus size={14} /></button></div></section></aside></main>}
    <section className="panel timeline"><PanelHeading title="Sprint timeline" meta="Sep 14 → Nov 6" /><div className="phase-grid">{phases.map((phase) => <div className={`phase ${phase.tone}`} key={phase.label}><span>{phase.label}</span><p>{phase.copy}</p></div>)}</div><div className="milestones">{milestones.map((milestone, index) => <div className="milestone" key={milestone}><i className={index === 0 || index === 3 ? 'gold-dot' : 'green-dot'} /><span>{milestone}</span></div>)}</div></section>
    <section className="panel workstreams"><PanelHeading title="Workstreams" meta="click a dot to set status · yellow twice in a row = intervene · red = discuss now" /><div className="workstream-grid">{state.workstreams.map((item) => <button className="workstream-card" key={item.name} onClick={() => setWorkstreamOpen(workstreamOpen === item.name ? null : item.name)}><span className={`status-dot ${item.d}`} onClick={(event) => { event.stopPropagation(); cycleStatus(item.name) }} /><b>{item.name}</b><small>{item.owner}</small></button>)}</div>{workstreamOpen && <div className="workstream-detail"><div><b>{workstreamOpen}</b><span>{state.tasks.filter((task) => task.ws === workstreamOpen).length} tasks across the plan</span></div><button onClick={() => { setOwner('All'); setView('plan'); setWorkstreamOpen(null) }}>see tasks <ArrowRight size={14} /></button></div>}</section>
    <div className="lower-grid"><section className="panel"><PanelHeading title="Budget" meta={`${money(Math.max(0, remaining))} remaining`} /><div className="budget-totals"><div><strong>{money(committed)}</strong><span>committed</span></div><div><strong>{money(paid)}</strong><span>paid</span></div><div className="gold-box"><strong>{money(Math.max(0, remaining))}</strong><span>remaining of $40K</span></div></div>{state.budget.map((item) => <div className="budget-row" key={item.id}><span>{item.name}</span><b>{money(item.amt)}</b><em className={item.status}>{item.status}</em></div>)}</section><section className="panel"><PanelHeading title="Investor pipeline" meta="empty · ready to populate" /><div className="empty-state"><div className="empty-icon"><ExternalLink size={18} /></div><b>No investor records yet</b><span>Prioritize the list in W4, then add warm paths here.</span><button className="button">+ add investor</button></div></section></div>
    <section className="panel activity"><PanelHeading title="Activity" meta="last 50 actions" /><div className="activity-list">{state.activity.slice(0, 6).map((item, index) => <div key={`${item}-${index}`}><i /><span>{item}</span><small>{index === 0 ? 'just now' : `${index * 2}h ago`}</small></div>)}</div></section>
    <footer>Build the smallest authentic version · watch carefully · learn quickly · capture the evidence · then raise</footer>
    {shareOpen && <Modal title="Share & export" onClose={() => setShareOpen(false)}><div className="share-block"><h3>Export for Notion</h3><p>Copy a living Markdown plan with owners, due dates and checkboxes.</p><div className="modal-actions"><button className="button button-gold" onClick={() => copy(fullPlan, 'full plan')}><Copy size={14} /> Copy full plan</button><button className="button" onClick={() => copy(digest, 'weekly digest')}><Copy size={14} /> Copy weekly digest</button></div></div><div className="share-block"><h3>Activity feed</h3><p>Shared state is persisted locally for this runnable prototype. Connect the mutation handlers to your hosted database when deploying.</p></div></Modal>}
    {reviewOpen && <Modal title={`Weekly review · ${reviewIndex + 1} / ${reviewSections.length}`} onClose={() => setReviewOpen(false)}><div className="eyebrow gold-text">{reviewSections[reviewIndex].title}</div><div className="prompt-list">{reviewSections[reviewIndex].prompts.map((prompt) => <div key={prompt}><i />{prompt}</div>)}</div><textarea value={state.notes[`w${week}-${reviewIndex}`] || ''} onChange={(event) => setState((current) => ({ ...current, notes: { ...current.notes, [`w${week}-${reviewIndex}`]: event.target.value } }))} placeholder="Notes for this section · saved automatically" rows={6} /><div className="modal-nav"><button className="button" disabled={reviewIndex === 0} onClick={() => setReviewIndex((index) => index - 1)}><ArrowLeft size={14} /> back</button><button className="button button-gold" onClick={() => reviewIndex === reviewSections.length - 1 ? setReviewOpen(false) : setReviewIndex((index) => index + 1)}>{reviewIndex === reviewSections.length - 1 ? 'finish' : 'next'} <ArrowRight size={14} /></button></div></Modal>}
    {walkthrough && <div className="walkthrough"><div className="walk-inner"><div className="walk-top"><span className="eyebrow gold-text">WALKTHROUGH · {walkIndex + 1} / {seed.plan.length + 2}</span><button onClick={() => setWalkthrough(false)}>esc to exit <X size={14} /></button></div><h2>{walkIndex < seed.plan.length ? `Week ${seed.plan[walkIndex].n} · ${seed.plan[walkIndex].range}` : walkIndex === seed.plan.length ? 'The gates' : 'How we run it'}</h2><p>{walkIndex < seed.plan.length ? seed.plan[walkIndex].theme : walkIndex === seed.plan.length ? 'UI/UX first pass review Sep 28–29 · UI/UX finalized Oct 16 · initial build Oct 23 · first pitch Oct 28 · v1 launch Nov 6.' : 'Check off tasks as they land. Blockers and open decisions stay visible until cleared or logged. Workstream dots keep the team honest.'}</p><div className="walk-bottom"><div className="walk-dots">{Array.from({ length: seed.plan.length + 2 }).map((_, index) => <i className={index === walkIndex ? 'active' : ''} key={index} />)}</div><div className="modal-actions"><button className="button" onClick={() => setWalkIndex((index) => Math.max(0, index - 1))}><ArrowLeft size={14} /></button><button className="button button-gold" onClick={() => walkIndex >= seed.plan.length + 1 ? setWalkthrough(false) : setWalkIndex((index) => index + 1)}>{walkIndex >= seed.plan.length + 1 ? 'done' : 'next'} <ArrowRight size={14} /></button></div></div></div></div>}
  </div>
}

function Metric({ value, label, accent = false }: { value: string; label: string; accent?: boolean }) { return <div className={`metric ${accent ? 'accent' : ''}`}><strong>{value}</strong><span>{label}</span></div> }
function PanelHeading({ title, meta }: { title: string; meta: string }) { return <div className="panel-heading"><h2>{title}</h2><span>{meta}</span></div> }
function TaskRow({ task, expanded, editing, onToggle, onExpand, onEdit, onSave, editTitle, setEditTitle }: { task: Task; expanded: boolean; editing: boolean; onToggle: (id: string) => void; onExpand: () => void; onEdit: () => void; onSave: () => void; editTitle: string; setEditTitle: (value: string) => void }) { return <article className={`task-row ${task.done ? 'done' : ''}`}>{editing ? <div className="edit-task"><input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && onSave()} /><div><button className="button" onClick={onEdit}>cancel</button><button className="button button-gold" onClick={onSave}>save</button></div></div> : <><button className={`checkbox ${task.done ? 'checked' : ''}`} onClick={() => onToggle(task.id)}>{task.done && <Check size={14} />}</button><div className="task-content" onClick={onExpand}><div className="task-title">{task.title}</div><div className="task-meta"><span>{task.ws}</span><span>{task.owner}</span>{task.due && <span>due {task.due}</span>}</div>{expanded && <div className="task-detail">{task.note && <p>{task.note}</p>}{task.details?.map((detail) => <div key={detail}>· {detail}</div>)}<button className="text-button" onClick={(event) => { event.stopPropagation(); onEdit() }}>edit task</button></div>}</div><button className="chevron" onClick={onExpand}>{expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button></>}</article> }
function TodayView({ tasks, onToggle, onOpenWeek }: { tasks: Task[]; onToggle: (id: string) => void; onOpenWeek: (week: number) => void }) { const groups = [{ title: 'OVERDUE', color: 'red', items: tasks.filter((task) => task.due && task.due.includes('Sep 2')) }, { title: 'UP NEXT', color: 'gold', items: tasks.filter((task) => task.due && !task.done).slice(0, 10) }, { title: 'UNDATED', color: 'grey', items: tasks.filter((task) => !task.due).slice(0, 10) }]; return <div className="today-grid">{groups.map((group) => <section className="panel today-card" key={group.title}><div className={`eyebrow ${group.color}-text`}>{group.title}<span>{group.items.length}</span></div>{group.items.length ? group.items.map((task) => <div className="compact-task" key={task.id}><button className={`checkbox small ${task.done ? 'checked' : ''}`} onClick={() => onToggle(task.id)}>{task.done && <Check size={11} />}</button><div onClick={() => onOpenWeek(task.week)}><b>{task.title}</b><small>W{task.week} · {task.owner}</small></div></div>) : <p className="muted">Nothing here right now.</p>}</section>)}</div> }
function PlanView({ seedPlan, tasks, onToggle, onOpenWeek, onAdd, newTask, setNewTask }: { seedPlan: typeof seed.plan; tasks: Task[]; onToggle: (id: string) => void; onOpenWeek: (week: number) => void; onAdd: (week: number) => void; newTask: string; setNewTask: (value: string) => void }) { return <div className="plan-grid">{seedPlan.map((week) => <section className="panel plan-card" key={week.n}><button className="plan-heading" onClick={() => onOpenWeek(week.n)}><span>W{week.n} · {week.range}</span><small>{tasks.filter((task) => task.week === week.n && task.done).length}/{tasks.filter((task) => task.week === week.n).length}</small><p>{week.theme}</p></button><div className="plan-tasks">{tasks.filter((task) => task.week === week.n).slice(0, 9).map((task) => <div className={`compact-task ${task.done ? 'done' : ''}`} key={task.id}><button className={`checkbox small ${task.done ? 'checked' : ''}`} onClick={() => onToggle(task.id)}>{task.done && <Check size={11} />}</button><div><b>{task.title}</b><small>{task.owner}{task.due ? ` · ${task.due}` : ''}</small></div></div>)}<button className="add-plan-task" onClick={() => { onOpenWeek(week.n); setNewTask('') }}>+ task</button></div></section>)}</div> }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="modal-backdrop" onClick={onClose}><div className="modal" onClick={(event) => event.stopPropagation()}><div className="modal-title"><h2>{title}</h2><button onClick={onClose}><X size={18} /></button></div>{children}</div></div> }

export default App
