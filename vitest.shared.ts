import UnplugSwc from 'unplugin-swc';

// Nest resolves constructor dependencies from the `design:paramtypes` metadata
// that TypeScript emits under `emitDecoratorMetadata`. esbuild, Vite's default
// transformer, cannot emit it, so DI silently breaks under test. Run the
// sources through SWC instead, which can.
//
// This lives in its own module so neither Vitest config has to mix a named
// export with its default export.
export const swcPlugin = UnplugSwc.vite({
  jsc: {
    parser: {
      syntax: 'typescript',
      decorators: true,
    },
    transform: {
      legacyDecorator: true,
      decoratorMetadata: true,
    },
    target: 'es2022',
  },
});
