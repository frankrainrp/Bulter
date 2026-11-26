const enabledTab = '[role="tab"]:not([aria-disabled="true"])';

function cancelSpace(event) {
  event.currentTarget.removeAttribute('data-space-pressed');
}

export const desktopTabKeyboard = {
  onKeyDownCapture(event) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.nativeEvent.isComposing) return;
    const tab = event.target;
    if (!tab.matches(enabledTab)) return;
    if (event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) {
        tab.setAttribute('data-space-pressed', '');
        tab.addEventListener('blur', cancelSpace, { once: true });
      }
      return;
    }

    const peers = [...event.currentTarget.querySelectorAll(enabledTab)];
    const index = peers.indexOf(tab);
    const destinations = {
      ArrowLeft: (index + peers.length - 1) % peers.length,
      ArrowRight: (index + 1) % peers.length,
      Home: 0,
      End: peers.length - 1,
    };
    if (!Object.hasOwn(destinations, event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const next = peers[destinations[event.key]];
    if (event.repeat || next === tab) return;
    next.focus({ preventScroll: true });
    next.click();
  },
  onKeyUpCapture(event) {
    if (event.key !== ' ') return;
    const tab = event.target;
    if (!tab.hasAttribute('data-space-pressed')) return;
    event.preventDefault();
    event.stopPropagation();
    tab.removeAttribute('data-space-pressed');
    tab.removeEventListener('blur', cancelSpace);
    if (tab.matches(enabledTab)) tab.click();
  },
};
