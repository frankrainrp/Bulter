export function DesktopTaskCheck({ task, saving, onToggle, onDrawn }) {
  const done = task.status === 'done';
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-disabled={saving}
      data-task-toggle={task.id}
      aria-label={`Mark ${task.taskName} as ${done ? 'to do' : 'done'}`}
      onClick={() => {
        if (!saving) onToggle(task);
      }}
      className="desktop-task-toggle"
    >
      <span className="desktop-task-check">
        {done && (
          <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true">
            <path
              className="desktop-task-mark"
              d="M2.5 9.3 6.9 13.2 15.4 4.5"
              pathLength="1"
              strokeDasharray="1"
              onAnimationEnd={(event) => {
                if (event.animationName === 'task-check-draw') onDrawn(task.id);
              }}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
    </button>
  );
}
