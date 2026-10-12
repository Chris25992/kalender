import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type Appointment = { id: string; title: string; date: string; time: string; description: string }
const KEY = 'kalender.appointments.v1'
const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const parseDate = (s: string) => { const [y,m,d] = s.split('-').map(Number); return new Date(y,m-1,d) }
const validDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && dateKey(parseDate(s)) === s
const dayLabel = (s: string) => parseDate(s).toLocaleDateString('de-DE', { weekday:'long',day:'numeric',month:'long' })
function load(): { items: Appointment[]; error: string } {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { items:[],error:'' }
    const data: unknown = JSON.parse(raw)
    if (!Array.isArray(data) || !data.every((x): x is Appointment => x && typeof x === 'object' && typeof x.id === 'string' && typeof x.title === 'string' && !!x.title.trim() && typeof x.date === 'string' && validDate(x.date) && typeof x.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(x.time) && typeof x.description === 'string') || new Set(data.map(x => x.id)).size !== data.length) throw Error()
    return { items:data,error:'' }
  } catch { return { items:[],error:'Gespeicherte Termine konnten nicht geladen werden. Vorhandene Daten bleiben bis zur nächsten erfolgreichen Änderung erhalten.' } }
}
export default function App() {
  const [initial] = useState(load)
  const [items,setItems] = useState(initial.items)
  const [error,setError] = useState(initial.error)
  const [now,setNow] = useState(() => new Date())
  const today = dateKey(now)
  const [month,setMonth] = useState(() => new Date(now.getFullYear(),now.getMonth(),1))
  const [selected,setSelected] = useState(today)
  const [draft,setDraft] = useState<Appointment|null>(null)
  const [deleting,setDeleting] = useState<Appointment|null>(null)
  const [notice,setNotice] = useState('')
  const modal = useRef<HTMLDialogElement>(null)
  const confirmation = useRef<HTMLDialogElement>(null)
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()),30000); return () => window.clearInterval(timer) },[])
  useEffect(() => { if(draft) modal.current?.showModal(); else modal.current?.close() },[draft])
  useEffect(() => { if(deleting) confirmation.current?.showModal(); else confirmation.current?.close() },[deleting])
  function persist(next: Appointment[],message: string) {
    try { localStorage.setItem(KEY,JSON.stringify(next)); setItems(next); setError(''); setNotice(message); return true }
    catch { setError('Die Änderung konnte nicht gespeichert werden. Bitte prüfe, ob dein Browser lokalen Speicher erlaubt und ausreichend Platz vorhanden ist.'); return false }
  }
  const add = () => setDraft({id:'',title:'',date:selected,time:'09:00',description:''})
  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if(!draft || !draft.title.trim() || !validDate(draft.date)) return
    const item = {...draft,id:draft.id || crypto.randomUUID(),title:draft.title.trim(),description:draft.description.trim()}
    if(persist(draft.id ? items.map(x => x.id === draft.id ? item : x) : [...items,item],draft.id ? 'Termin aktualisiert.' : 'Termin hinzugefügt.')) {
      setSelected(item.date); const d = parseDate(item.date); setMonth(new Date(d.getFullYear(),d.getMonth(),1)); setDraft(null)
    }
  }
  function move(n: number) { const d = new Date(month.getFullYear(),month.getMonth()+n,1); setMonth(d); setSelected(dateKey(d)) }
  function goToday() { const d = new Date(); setNow(d); setMonth(new Date(d.getFullYear(),d.getMonth(),1)); setSelected(dateKey(d)) }
  const sorted = [...items].sort((a,b) => (a.date+' '+a.time).localeCompare(b.date+' '+b.time))
  const daily = sorted.filter(x => x.date === selected)
  const monthly = items.filter(x => x.date.startsWith(dateKey(month).slice(0,7)))
  const offset = (month.getDay()+6)%7
  const count = new Date(month.getFullYear(),month.getMonth()+1,0).getDate()
  const cells = Array.from({length:Math.ceil((offset+count)/7)*7},(_,i) => new Date(month.getFullYear(),month.getMonth(),i-offset+1))
  return <div className="app-shell">
    <header className="app-header"><a className="brand" href="./"><span className="brand-icon" aria-hidden="true">▦</span> tagwerk <span className="brand-tag">DEIN KALENDER</span></a><span className="local-badge"><i/> Lokal gespeichert</span></header>
    <main><div className="intro"><div><p className="eyebrow">MEHR RAUM FÜR DEINEN TAG</p><h1>Deine Zeit. Dein Überblick.</h1><p>Alles, was ansteht – an einem Ort.</p></div><button className="primary" onClick={add}>＋ Termin hinzufügen</button></div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="workspace"><section className="calendar panel" aria-label="Monatskalender">
        <div className="calendar-toolbar"><div><h2 aria-live="polite">{month.toLocaleDateString('de-DE',{month:'long',year:'numeric'})}</h2><p>{monthly.length} {monthly.length === 1 ? 'Termin' : 'Termine'} in diesem Monat</p></div><div className="navigation"><button className="today-button" onClick={goToday}>Heute</button><button className="arrow" aria-label="Vorheriger Monat" onClick={() => move(-1)}>‹</button><button className="arrow" aria-label="Nächster Monat" onClick={() => move(1)}>›</button></div></div>
        <div className="weekdays">{['Mo','Di','Mi','Do','Fr','Sa','So'].map(d => <span key={d}>{d}</span>)}</div>
        <div className="calendar-grid">{cells.map(d => {
          const key = dateKey(d); const events = sorted.filter(x => x.date === key)
          return <button key={key} className={['day',d.getMonth() !== month.getMonth() ? 'outside' : '',key === today ? 'is-today' : '',key === selected ? 'selected' : ''].join(' ')} aria-pressed={key === selected} aria-current={key === today ? 'date' : undefined} aria-label={dayLabel(key)+' '+d.getFullYear()+', '+events.length+' Termine'} onClick={() => setSelected(key)}>
            <span className="day-number">{d.getDate()}</span><span className="day-events">{events.slice(0,2).map(x => <span className="event-chip" key={x.id}><span className="event-time">{x.time} </span>{x.title}</span>)}{events.length > 2 && <span className="more">+{events.length-2} weitere</span>}</span>
            {events.length > 0 && <span className="mobile-dots" aria-hidden="true">{events.slice(0,3).map(x => <i key={x.id}/>)}</span>}
          </button>
        })}</div><div className="calendar-footer"><span><i/> Heute</span><span>Wähle einen Tag, um deine Termine zu sehen.</span></div>
      </section><aside className="agenda panel"><div className="agenda-heading"><p className="eyebrow">DEIN TAGESPLAN</p><h2>{dayLabel(selected)}</h2><span>{daily.length} {daily.length === 1 ? 'Termin' : 'Termine'}</span></div>
        <div className="agenda-list">{daily.length ? daily.map(x => <article className="appointment" key={x.id}><span className="time-label">{x.time}</span><h3>{x.title}</h3>{x.description && <p className="description">{x.description}</p>}<div className="appointment-actions"><button aria-label={x.title+' bearbeiten'} onClick={() => setDraft({...x})}>Bearbeiten</button><button className="delete-link" aria-label={x.title+' löschen'} onClick={() => setDeleting(x)}>Löschen</button></div></article>) : <div className="empty"><span className="empty-icon" aria-hidden="true">☀</span><h3>Platz für deine Pläne</h3><p>Für diesen Tag stehen noch keine Termine an.</p></div>}</div>
        <button className="add-day" onClick={add}>＋ Termin für diesen Tag</button><p className="agenda-note">Ein guter Plan lässt Platz für spontane Momente.</p>
      </aside></div><footer className="page-footer"><span>Dein Alltag, etwas übersichtlicher.</span><span>Deine Termine bleiben in diesem Browser.</span></footer><p className="sr-only" role="status">{notice}</p>
    </main>
    <dialog ref={modal} onCancel={() => setDraft(null)} onClick={e => { if(e.target === e.currentTarget) setDraft(null) }} aria-labelledby="form-title">{draft && <form onSubmit={save}>
      <div className="dialog-header"><div><p className="eyebrow">DEINE PLANUNG</p><h2 id="form-title">{draft.id ? 'Termin bearbeiten' : 'Neuer Termin'}</h2></div><button type="button" className="arrow" aria-label="Schließen" onClick={() => setDraft(null)}>×</button></div>
      <label>Titel<input autoFocus required pattern=".*\S.*" maxLength={120} value={draft.title} placeholder="Was steht an?" onChange={e => setDraft({...draft,title:e.target.value})}/></label>
      <div className="form-row"><label>Datum<input type="date" required min="0100-01-01" max="9999-12-31" value={draft.date} onChange={e => setDraft({...draft,date:e.target.value})}/></label><label>Uhrzeit<input type="time" required value={draft.time} onChange={e => setDraft({...draft,time:e.target.value})}/></label></div>
      <label>Beschreibung <span className="optional">optional</span><textarea rows={4} maxLength={2000} value={draft.description} placeholder="Notizen, Ort oder weitere Details …" onChange={e => setDraft({...draft,description:e.target.value})}/></label>
      {error && <p className="error" role="alert">{error}</p>}<div className="form-actions"><button type="button" className="secondary" onClick={() => setDraft(null)}>Abbrechen</button><button className="primary" type="submit">Termin speichern</button></div>
    </form>}</dialog>
    <dialog ref={confirmation} onCancel={() => setDeleting(null)} aria-labelledby="delete-title"><h2 id="delete-title">Termin löschen?</h2><p className="delete-question">„{deleting?.title}“ wird aus deinem Kalender entfernt.</p>{error && <p className="error" role="alert">{error}</p>}<div className="form-actions"><button className="secondary" onClick={() => setDeleting(null)}>Abbrechen</button><button className="danger" onClick={() => { if(deleting && persist(items.filter(x => x.id !== deleting.id),'Termin gelöscht.')) setDeleting(null) }}>Löschen</button></div></dialog>
  </div>
}
