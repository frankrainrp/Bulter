import { useState } from 'react';
import { Pressable, View } from 'react-native-web';
import { BitoText as Text } from '../bito/Typography.jsx';
import { Button, Choices, Field, s } from '../ui.jsx';

import { canGenerateImage, supportsImageGeneration } from './generateImage.js';

export function ProviderModelPicker({ assistant, busy, onSelect, unclassified = false }) {
  const [mode, setMode] = useState(assistant.model?.mode ?? 'chat');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(12);
  const profile = assistant.model;
  if (!profile) return null;
  const images = !unclassified && supportsImageGeneration(profile.provider);
  const available = assistant.catalog.filter((item) =>
    mode === 'image'
      ? item.kind === 'image' && canGenerateImage(profile.provider, item.id, item.kind)
      : item.kind === 'chat' || item.kind === 'unknown'
  );
  const term = query.trim().toLowerCase();
  const filtered = available.filter((item) => (item.id + ' ' + item.label).toLowerCase().includes(term));
  return (
    <View style={s.field}>
      {images && (
        <Choices
          label="Use model for"
          current={mode}
          options={[
            { value: 'chat', label: 'Chat' },
            { value: 'image', label: 'Create image' },
          ]}
          onChange={(value) => {
            setMode(value);
            setQuery('');
            setLimit(12);
          }}
        />
      )}
      {(available.length > 8 || query !== '') && (
        <Field
          label="Find model"
          value={query}
          editable={!busy}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Name or model ID"
          onChangeText={(value) => {
            setQuery(value);
            setLimit(12);
          }}
        />
      )}
      <Text accessibilityLiveRegion="polite" style={s.label}>
        {assistant.catalogStatus === 'loading'
          ? 'Loading provider models…'
          : mode === 'image'
            ? 'Image models'
            : 'Chat models'}
      </Text>
      {filtered.slice(0, limit).map((item) => {
        const selected = profile.model === item.id && profile.mode === mode;
        return (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={item.id}
            accessibilityState={{ selected, disabled: busy }}
            disabled={busy}
            onPress={() => onSelect(item.id, mode)}
            style={({ pressed }) => [s.choice, selected && s.choiceSelected, pressed && s.dim]}
          >
            <Text style={[s.choiceText, selected && s.choiceTextSelected]}>{item.label || item.id}</Text>
            {item.label && item.label !== item.id && <Text style={s.subtitle}>{item.id}</Text>}
          </Pressable>
        );
      })}
      {filtered.length > limit && (
        <Button label="Show more models" secondary onPress={() => setLimit(limit + 24)} />
      )}
      {!filtered.length && assistant.catalogStatus === 'ready' && (
        <Text style={s.subtitle}>
          {term
            ? 'No matching models.'
            : mode === 'image'
              ? 'This key lists no supported image-generation models.'
              : 'This key lists no chat models.'}
        </Text>
      )}
      {!!assistant.catalogIssue && (
        <Text accessibilityRole="alert" style={s.error}>
          {assistant.catalogIssue}
        </Text>
      )}
      {!unclassified && (
        <View style={s.row}>
          <Button
            label="Refresh models"
            secondary
            onPress={() => void assistant.refreshCatalog()}
            disabled={busy || assistant.catalogStatus === 'loading'}
          />
        </View>
      )}
    </View>
  );
}
