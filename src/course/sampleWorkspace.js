function localNoon(now, offset) {
  const day = new Date(now.getTime());
  day.setHours(12, 0, 0, 0);
  day.setDate(day.getDate() + offset);
  return day;
}

function dateKey(day) {
  return [
    String(day.getFullYear()).padStart(4, '0'),
    String(day.getMonth() + 1).padStart(2, '0'),
    String(day.getDate()).padStart(2, '0'),
  ].join('-');
}

export function createSampleWorkspace(now = new Date()) {
  const due = offset => dateKey(localNoon(now, offset));

  return {
    version: 1,
    tasks: [
      {
        id: 'sample-task-workflow', taskName: 'Sketch the study session workflow',
        description: 'Map how a study group picks a topic, prepares questions and records what to revisit.',
        dueDate: due(-3), dueTime: '15:00', status: 'done', priority: 'med',
        tags: ['Study group', 'Planning'], goalId: '',
      },
      {
        id: 'sample-task-cards', taskName: 'Finish the revision cards',
        description: 'Turn the remaining three practice questions into cards with an answer on the reverse.',
        dueDate: due(-1), dueTime: '17:00', status: 'todo', priority: 'high',
        tags: ['Revision'], goalId: '',
      },
      {
        id: 'sample-task-rehearsal', taskName: 'Rehearse the prototype walkthrough',
        description: 'Start with an empty plan. Add a session, edit its topic and check the updated list.',
        dueDate: due(0), dueTime: '10:30', status: 'in_progress', priority: 'high',
        tags: ['Prototype', 'Study group'], goalId: '',
      },
      {
        id: 'sample-task-questions', taskName: 'Choose questions for the next session',
        description: 'Pick one question about state and one about passing data between components.',
        dueDate: due(0), dueTime: '16:00', status: 'todo', priority: 'med',
        tags: ['Revision', 'Study group'], goalId: '',
      },
      {
        id: 'sample-task-checks', taskName: 'Test the session form',
        description: 'Try an empty topic, a valid entry and a repeated entry. Record the feedback for each case.',
        dueDate: due(3), dueTime: '14:00', status: 'todo', priority: 'med',
        tags: ['Prototype', 'Testing'], goalId: '',
      },
      {
        id: 'sample-task-next-week', taskName: 'Review the study plan for next week',
        description: 'Use the practice results to decide which topics to carry forward and which can be closed.',
        dueDate: due(7), dueTime: '11:00', status: 'todo', priority: 'low',
        tags: ['Study group', 'Planning'], goalId: '',
      },
    ],
    notes: [
      {
        id: 'sample-note-session', title: 'Study session plan',
        content: '## Session outline\n\n1. Start with a practice question about component state.\n2. Work through a second example in pairs.\n3. Record the topics that need another attempt.\n\nUse [[Revision prompts]] for the opening questions.',
        updatedAt: localNoon(now, -3).getTime(),
      },
      {
        id: 'sample-note-prompts', title: 'Revision prompts',
        content: '## Practice questions\n\n- Which component should own the selected topic when two views share it?\n- How would the list change when a session is marked complete?\n\nTry answering before checking the example in [[Study session plan]].',
        updatedAt: localNoon(now, -2).getTime(),
      },
      {
        id: 'sample-note-tests', title: 'Prototype checks',
        content: '## Walkthrough\n\n- Submit an empty topic and check the feedback.\n- Add a topic and find it in the session list.\n- Change its date and confirm it appears on the new day.\n\nUse the opening activity from [[Study session plan]] as the test entry.',
        updatedAt: localNoon(now, -1).getTime(),
      },
    ],
    goals: [],
  };
}
