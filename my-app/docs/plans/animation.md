# Character animation extension

Current character presentation uses the supplied static pose assets through `ButlerCharacter.tsx`. Loading, thinking, response and idle states select existing artwork.

A future Rive or Live2D integration requires a rigged source asset, an explicit runtime dependency, reduced-motion behavior, lifecycle cleanup and mobile performance acceptance. Keep the static-image path available during loading or renderer failure. This extension is separate from the shipped Windows web-server package.
