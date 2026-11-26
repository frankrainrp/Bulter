import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button, SourceButton, colors, s } from '../ui.jsx';
import { BitoText } from '../bito/Typography.jsx';
import { DetroitTitle } from '../bito/Title.jsx';
import { DetroitFormButton } from '../bito/DetroitFormButton.jsx';
import { dashboardCatalog, moduleDefinition } from './layout.js';
import { applyDashboardAction, getDashboardLayout, subscribeDashboard } from './dashboardStore.js';
import { bindingLabels, DashboardContent } from './DashboardContent.jsx';

import './dashboard.css';

function CardForm({ card, busy, save, cancel }) {
  const [original] = useState(card);
  const [type, setType] = useState(card?.type ?? 'stat');
  const [title, setTitle] = useState(card?.title ?? 'Statistic');
  const [config, setConfig] = useState(card?.config ?? {});
  const [span, setSpan] = useState(card?.span ?? 1);
  const def = moduleDefinition(type);
  const firstField = useRef(null);
  useEffect(() => {
    firstField.current?.querySelector('select,input')?.focus();
  }, []);
  function selectType(t) {
    setType(t);
    setTitle(moduleDefinition(t).label);
    setConfig({});
  }
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const changes = original
      ? Object.fromEntries(Object.entries(config).filter(([key, value]) => value !== original.config[key]))
      : config;
    const action = original
      ? {
          op: 'update',
          id: original.id,
          ...(title !== original.title && { title }),
          ...(span !== original.span && { span }),
          ...(Object.keys(changes).length > 0 && { config: changes }),
        }
      : { op: 'add', type, title, span, config };
    if (card && Object.keys(action).length === 2) {
      cancel();
      return;
    }
    if (await save(action)) cancel();
  }
  return (
    <form className="dashboard-form" onSubmit={submit}>
      <fieldset ref={firstField} disabled={busy}>
        <legend>{card ? 'Edit card' : 'Add card'}</legend>
        {!card && (
          <label>
            Component
            <select value={type} onChange={(e) => selectType(e.target.value)}>
              {dashboardCatalog.map((d) => (
                <option key={d.type} value={d.type}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Title
          <input required maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        {'metrics' in def && (
          <label>
            Metric
            <select
              value={config.metric ?? def.metrics[0]}
              onChange={(e) => setConfig({ metric: e.target.value })}
            >
              {def.metrics.map((m) => (
                <option key={m} value={m}>
                  {bindingLabels[m]}
                </option>
              ))}
            </select>
          </label>
        )}
        {'filters' in def && (
          <>
            <label>
              Tasks
              <select
                value={config.filter ?? 'active'}
                onChange={(e) => setConfig({ ...config, filter: e.target.value })}
              >
                {def.filters.map((f) => (
                  <option key={f} value={f}>
                    {bindingLabels[f]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Number of tasks
              <input
                type="number"
                required
                min={1}
                max={30}
                value={Number.isNaN(config.limit) ? '' : (config.limit ?? 6)}
                onChange={(e) => setConfig({ ...config, limit: e.currentTarget.valueAsNumber })}
              />
            </label>
          </>
        )}
        {type === 'countdown' && (
          <label>
            Target date <small>Leave blank for the next deadline.</small>
            <input
              type="date"
              value={config.targetDate ?? ''}
              onChange={(e) => setConfig({ targetDate: e.target.value })}
            />
          </label>
        )}
        <label>
          Card width
          <select value={span} onChange={(e) => setSpan(Number(e.target.value))}>
            <option value={1}>One column</option>
            <option value={2}>Two columns</option>
          </select>
        </label>
        <div className="dashboard-actions">
          <DetroitFormButton type="submit" primary disabled={busy}>
            {card ? 'Save changes' : 'Add to dashboard'}
          </DetroitFormButton>
          <DetroitFormButton onClick={cancel} disabled={busy}>
            Cancel
          </DetroitFormButton>
        </div>
      </fieldset>
    </form>
  );
}

export function DesktopDashboard({ workspace, today }) {
  const [layout, setLayout] = useState();
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState();
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [status, setStatus] = useState('');
  const grid = useRef(null);
  const previous = useRef(new Map());
  const opener = useRef(null);
  const working = useRef(false);
  useEffect(() => {
    let active = true;
    let latest = 0;
    function refresh() {
      const request = ++latest;
      getDashboardLayout()
        .then((next) => {
          if (active && request === latest) {
            setLayout(next);
            setError('');
          }
        })
        .catch((cause) => {
          if (active && request === latest)
            setError(cause instanceof Error ? cause.message : 'Could not open the dashboard.');
        });
    }
    const unsubscribe = subscribeDashboard(refresh);
    refresh();
    return () => {
      active = false;
      unsubscribe();
    };
  }, [reload]);
  useLayoutEffect(() => {
    const next = new Map();
    for (const el of grid.current?.querySelectorAll('article[data-id]') ?? []) {
      const id = el.dataset.id,
        rect = el.getBoundingClientRect(),
        old = previous.current.get(id);
      if (
        old &&
        (old.left !== rect.left || old.top !== rect.top) &&
        !matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        el.animate?.(
          [
            { transform: 'translate(' + (old.left - rect.left) + 'px,' + (old.top - rect.top) + 'px)' },
            { transform: 'none' },
          ],
          { duration: 170, easing: 'ease-out' }
        );
      }
      next.set(id, rect);
    }
    previous.current = next;
  }, [layout, editing, form]);
  async function save(action) {
    if (working.current) return false;
    working.current = true;
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await applyDashboardAction(action);
      setStatus('Dashboard saved.');
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the dashboard. Please try again.');
      return false;
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  function openForm(id) {
    opener.current = document.activeElement;
    setForm(id);
  }
  function closeForm() {
    setForm(undefined);
    requestAnimationFrame(() => opener.current?.focus());
  }
  const selection = layout?.modules.find((m) => m.id === form);
  return (
    <main className="butler-dashboard" aria-label="Dashboard workspace">
      <header className="dashboard-heading">
        <DetroitTitle title="Dashboard" />
        <div className="dashboard-top-actions">
          {editing && (
            <Button label="Add card" icon="add" onPress={() => openForm('new')} disabled={busy || !layout} />
          )}
          <SourceButton
            accessibilityRole="button"
            accessibilityLabel={editing ? 'Done' : 'Customize'}
            onPress={() => {
              setForm(undefined);
              setEditing(!editing);
            }}
            disabled={busy || !layout}
            style={s.button}
          >
            {(dark) => (
              <BitoText style={[s.buttonText, { color: dark ? '#FFFFFF' : colors.deep }]}>
                <BitoText aria-hidden>{editing ? '[x] ' : '[::] '}</BitoText>
                {editing ? 'Done' : 'Customize'}
              </BitoText>
            )}
          </SourceButton>
        </div>
      </header>
      {error && (
        <div role="alert" className="dashboard-error">
          {error}{' '}
          {!layout && <DetroitFormButton onClick={() => setReload((n) => n + 1)}>Try again</DetroitFormButton>}
        </div>
      )}
      <div className="dashboard-sr" role="status" aria-live="polite">
        {status}
      </div>
      {editing && (form === 'new' || selection) && (
        <CardForm key={form} card={selection} busy={busy} save={save} cancel={closeForm} />
      )}
      {!layout && !error && <p>Opening dashboard…</p>}
      {layout && !layout.modules.length && (
        <p className="dashboard-empty">
          {editing
            ? 'Add a card to build your dashboard.'
            : 'Your dashboard is empty. Choose Customize to add a card.'}
        </p>
      )}
      <div className="dashboard-grid" ref={grid}>
        {layout?.modules.map((card, index) => (
          <article key={card.id} data-id={card.id} data-span={card.span} aria-label={card.title}>
            <h2>{card.title}</h2>
            <DashboardContent card={card} workspace={workspace} today={today} />
            {editing && (
              <div className="dashboard-actions dashboard-card-actions">
                <DetroitFormButton
                  onClick={() => openForm(card.id)}
                  disabled={busy}
                  aria-label={'Edit ' + card.title}
                >
                  Edit
                </DetroitFormButton>
                <DetroitFormButton
                  onClick={() => void save({ op: 'move', id: card.id, index: index - 1 })}
                  disabled={busy || index === 0}
                  aria-label={'Move ' + card.title + ' earlier'}
                >
                  Earlier
                </DetroitFormButton>
                <DetroitFormButton
                  onClick={() => void save({ op: 'move', id: card.id, index: index + 1 })}
                  disabled={busy || index === layout.modules.length - 1}
                  aria-label={'Move ' + card.title + ' later'}
                >
                  Later
                </DetroitFormButton>
                <DetroitFormButton
                  onClick={() => void save({ op: 'remove', id: card.id })}
                  disabled={busy}
                  aria-label={'Remove ' + card.title}
                >
                  Remove
                </DetroitFormButton>
              </div>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}
