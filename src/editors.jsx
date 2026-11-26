import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native-web';
import { BitoText as Text } from './bito/Typography.jsx';
import { dateKey, priorities, statuses, taskError } from './model.js';
import { Button, Choices, Field, PageTitle, s } from './ui.jsx';
import { taskFieldNames, withSavedFields } from './desktop/taskEdits.js';

function EditorLayout({ route, saving, saveError, onClose, onDelete, onSubmit, error, resolution, children }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const resolving = !!resolution;
  useEffect(() => {
    if (resolving) setConfirmDelete(false);
  }, [resolving]);

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <PageTitle
          title={`${route.existing ? 'Edit' : 'New'} ${route.kind}`}
          action={<Button label="Cancel" secondary disabled={saving} onPress={onClose} />}
        />
        <View style={styles.form}>{children}</View>
        <View style={styles.actions}>
          {error && (
            <Text accessibilityRole="alert" style={s.error}>
              {error}
            </Text>
          )}
          {saveError && (
            <Text accessibilityRole="alert" style={s.error}>
              Couldn’t save changes. Please try again.
            </Text>
          )}
          {resolution ??
            (confirmDelete ? (
              <>
                <Text style={s.label}>Delete this {route.kind}?</Text>
                <View style={[s.row, s.wrap]}>
                  <Button label={`Delete ${route.kind}`} danger disabled={saving} onPress={onDelete} />
                  <Button label="Keep it" secondary disabled={saving} onPress={() => setConfirmDelete(false)} />
                </View>
              </>
            ) : (
              <View style={[s.row, s.wrap]}>
                <Button label={`Save ${route.kind}`} icon="checkmark" disabled={saving} onPress={onSubmit} />
                {route.existing && (
                  <Button label="Delete…" danger disabled={saving} onPress={() => setConfirmDelete(true)} />
                )}
              </View>
            ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const priorityOptions = Object.keys(priorities).map((value) => ({ value, label: priorities[value] }));
const statusOptions = Object.keys(statuses).map((value) => ({ value, label: statuses[value] }));

export function TaskEditor({ route, onSave, onRevise, onCopy, ...actions }) {
  const [task, setTask] = useState(route.item);
  const [tags, setTags] = useState(route.item.tags.join(', '));
  const [error, setError] = useState();
  const [base, setBase] = useState(route.item);
  const [conflict, setConflict] = useState();

  function readDraft() {
    return {
      ...task,
      taskName: task.taskName.trim(),
      description: task.description.trim(),
      dueDate: task.dueDate.trim(),
      dueTime: task.dueTime.trim(),
      tags: [
        ...new Set(
          tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean)
        ),
      ],
    };
  }

  function showDraft(value) {
    setTask(value);
    setTags(value.tags.join(', '));
  }

  async function revise(request) {
    const outcome = await onRevise?.(request);
    if (!outcome) return;
    if (outcome.kind === 'changed') {
      setBase(outcome.latest);
      showDraft(outcome.merged);
    }
    setConflict(outcome);
  }

  function update(key, value) {
    setTask((current) => ({ ...current, [key]: value }));
    setError(undefined);
  }

  function submit(asCopy = false) {
    const next = readDraft();
    const issue = taskError(next);
    setError(issue);
    if (issue) return;
    if (asCopy) onCopy(next);
    else if (onRevise) void revise({ kind: 'edit', base, draft: next });
    else onSave(next);
  }

  const resolution = conflict && (
    <>
      <Text accessibilityRole="alert" style={s.error}>
        {conflict.kind === 'deleted'
          ? 'This task was deleted in another tab. You can save your draft as a new task.'
          : conflict.kind === 'deleteChanged'
            ? 'This task changed in another tab. Review the changes before deleting it.'
            : 'The same fields changed in another tab. Choose which values to save.'}
      </Text>
      {conflict.kind !== 'deleted' &&
        conflict.fields.map((field) => {
          const value =
            field === 'status'
              ? statuses[conflict.latest.status]
              : field === 'priority'
                ? priorities[conflict.latest.priority]
                : field === 'tags'
                  ? conflict.latest.tags.join(', ')
                  : conflict.latest[field];
          return (
            <Text key={field} style={s.label}>
              Saved {taskFieldNames[field].toLowerCase()} · {value || 'Empty'}
            </Text>
          );
        })}
      <View style={[s.row, s.wrap]}>
        {conflict.kind === 'deleted' && (
          <Button label="Save as new task" disabled={actions.saving} onPress={() => submit(true)} />
        )}
        {conflict.kind === 'deleteChanged' && (
          <>
            <Button
              label="Keep editing"
              secondary
              disabled={actions.saving}
              onPress={() => setConflict(undefined)}
            />
            <Button
              label="Delete updated task"
              danger
              disabled={actions.saving}
              onPress={() => void revise({ kind: 'delete', base: conflict.latest })}
            />
          </>
        )}
        {conflict.kind === 'changed' && (
          <>
            <Button
              label="Use saved values"
              secondary
              disabled={actions.saving}
              onPress={() => {
                showDraft(withSavedFields(readDraft(), conflict.latest, conflict.fields));
                setConflict(undefined);
              }}
            />
            <Button label="Save my values" disabled={actions.saving} onPress={() => submit()} />
          </>
        )}
      </View>
    </>
  );
  return (
    <EditorLayout
      route={route}
      error={error}
      resolution={resolution}
      onSubmit={() => submit()}
      {...actions}
      onDelete={onRevise ? () => void revise({ kind: 'delete', base }) : actions.onDelete}
    >
      <Field
        label="Task title"
        placeholder="e.g. Review database transactions"
        value={task.taskName}
        onChangeText={(value) => update('taskName', value)}
        maxLength={100}
        editable={!actions.saving}
      />
      <Field
        label="Description"
        placeholder="Add a study step or reminder"
        value={task.description}
        onChangeText={(value) => update('description', value)}
        multiline
        maxLength={3000}
        editable={!actions.saving}
      />
      <View style={[s.row, styles.dateFields]}>
        <View style={s.grow}>
          <Field
            label="Due date"
            placeholder="YYYY-MM-DD"
            value={task.dueDate}
            maxLength={10}
            onChangeText={(value) => update('dueDate', value)}
            editable={!actions.saving}
          />
        </View>
        <View style={s.grow}>
          <Field
            label="Due time"
            placeholder="HH:MM"
            value={task.dueTime}
            maxLength={5}
            onChangeText={(value) => update('dueTime', value)}
            editable={!actions.saving}
          />
        </View>
      </View>
      <View style={[s.row, s.wrap]}>
        <Button
          label="Today"
          secondary
          onPress={() => update('dueDate', dateKey(new Date()))}
          disabled={actions.saving}
        />
        <Button
          label="Clear schedule"
          secondary
          disabled={actions.saving}
          onPress={() => {
            setTask((current) => ({ ...current, dueDate: '', dueTime: '' }));
            setError(undefined);
          }}
        />
      </View>
      <Choices
        label="Priority"
        options={priorityOptions}
        current={task.priority}
        onChange={(value) => update('priority', value)}
      />
      {route.existing && (
        <Choices
          label="Status"
          options={statusOptions}
          current={task.status}
          onChange={(value) => update('status', value)}
        />
      )}
      <Field
        label="Tags"
        placeholder="e.g. SQL, Revision"
        value={tags}
        onChangeText={setTags}
        maxLength={180}
        editable={!actions.saving}
      />
    </EditorLayout>
  );
}

export function TextEditor({ route, onSave, ...actions }) {
  const [title, setTitle] = useState(route.item.title);
  const [body, setBody] = useState(route.item.content);
  const [error, setError] = useState();

  function submit() {
    const name = title.trim();
    if (!name) {
      setError('Enter a note title.');
      return;
    }
    onSave({ ...route.item, title: name, content: body.trim(), updatedAt: Date.now() });
  }

  return (
    <EditorLayout route={route} error={error} onSubmit={submit} {...actions}>
      <Field
        label="Note title"
        value={title}
        placeholder="e.g. Database revision"
        maxLength={100}
        editable={!actions.saving}
        onChangeText={(value) => {
          setTitle(value);
          setError(undefined);
        }}
      />
      <Field
        label="Note content"
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={12000}
        editable={!actions.saving}
        placeholder="Write your study notes here"
      />
    </EditorLayout>
  );
}

const styles = StyleSheet.create({
  form: { gap: 15 },
  dateFields: { alignItems: 'flex-start' },
  actions: { gap: 9, marginTop: 22 },
});
