import { useEffect, useRef } from 'react';
import { mountDetroitPageBackground } from './vendor/background.js';
import './vendor/background.css';

export function PageBackground() {
  const host = useRef(null);
  useEffect(() => {
    if (host.current?.parentElement) mountDetroitPageBackground(host.current.parentElement);
  }, []);

  return <div ref={host} className="dui-background" data-testid="page-background" aria-hidden="true" />;
}
