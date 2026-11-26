import { useEffect, useState } from 'react';
import { Button, Empty, s } from '../ui.jsx';
import { ActivityIndicator, View } from 'react-native-web';

let ready;

export function DesktopNotes(props) {
  const [vault, setVault] = useState(ready);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (vault) return;
    let active = true;
    import('./DesktopNotes.jsx')
      .then((module) => {
        ready = module;
        if (active) setVault(module);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [vault, attempt]);
  if (vault) return <vault.DesktopNotes {...props} />;
  return (
    <View style={s.content}>
      {failed ? (
        <Empty
          icon="book-outline"
          title="Couldn’t load Notes"
          hint={
            attempt === 0
              ? 'Check your connection to the workspace and try again.'
              : 'If the workspace was updated, reload to get the latest version. Reloading closes the current chat session.'
          }
          action={
            <View style={[s.row, s.wrap]}>
              <Button
                label="Try again"
                onPress={() => {
                  setFailed(false);
                  setAttempt((value) => value + 1);
                }}
              />
              {attempt > 0 && (
                <Button label="Reload workspace" secondary onPress={() => window.location.reload()} />
              )}
            </View>
          }
        />
      ) : (
        <ActivityIndicator accessibilityLabel="Loading Notes" />
      )}
    </View>
  );
}
