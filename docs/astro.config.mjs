// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightTypeDoc, { typeDocSidebarGroup } from 'starlight-typedoc';
import starlightLlmsTxt from 'starlight-llms-txt';
import sentryStarlightTheme from '@sentry/starlight-theme';

export default defineConfig({
  // Served from a custom subdomain, so the site lives at the root.
  // There is deliberately no `base` here: setting one would prefix every asset
  // and link with a path segment the custom domain does not serve.
  // The CNAME file in docs/public/ is copied verbatim into the build output,
  // which is what GitHub Pages reads to bind the domain.
  site: 'https://nestjs-twilio.lazar.sh',
  integrations: [
    starlight({
      title: 'nestjs-twilio',
      description: 'Injectable Twilio client for NestJS',
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/lkaric/nestjs-twilio',
        },
      ],
      editLink: {
        // This repository's default branch is `master`, not `main`.
        baseUrl: 'https://github.com/lkaric/nestjs-twilio/edit/master/docs/',
      },
      // Expressive Code renders every fenced block on this site. The Sentry
      // theme forces its own `sentry-monochrome` theme here, which is greyscale
      // by design and strips syntax colour entirely. The plugin spreads user
      // config over its defaults, so naming a theme restores highlighting while
      // keeping the rest of the theme's code styling.
      expressiveCode: {
        themes: ['github-dark'],
        emitExternalStylesheet: true,
      },
      plugins: [
        // Shared Sentry Starlight theme. It ships the CSS and replaces
        // Starlight's theme switcher with an empty component because the
        // theme is deliberately dark only.
        sentryStarlightTheme(),

        // Generates the API reference from the library's own JSDoc, so the
        // reference cannot drift from the source the way a hand-written one
        // would. Entry point is the public barrel: anything not exported from
        // there is not public API and is deliberately absent from these pages.
        starlightTypeDoc({
          entryPoints: ['../lib/index.ts'],
          tsconfig: '../tsconfig.json',
          output: 'api',
          sidebar: {
            label: 'API Reference',
            collapsed: true,
          },
          typeDoc: {
            // The barrel is a set of re-exports; without this every symbol is
            // filed under "index" instead of its own module.
            useCodeBlocks: true,
            expandObjects: true,
            parametersFormat: 'table',
            propertiesFormat: 'table',
            enumMembersFormat: 'table',
            typeDeclarationFormat: 'table',
            hidePageHeader: true,
            hideBreadcrumbs: true,
          },
        }),

        // Emits /llms.txt (an index) and /llms-full.txt (the whole corpus as
        // one document) at build time, derived from the same pages a human
        // reads. Generating rather than hand-writing them is the point: a
        // hand-maintained corpus silently rots as the docs change.
        starlightLlmsTxt({
          projectName: 'nestjs-twilio',
          description:
            'Injectable Twilio client for NestJS, with webhook signature validation, ' +
            'TwiML response serialization, Twilio-to-HTTP error mapping and ' +
            'multi-account support.',
          details: [
            '- `twilio` is a peer dependency and must be installed alongside this package.',
            '- Requires Node.js >=20.19 and @nestjs/common and @nestjs/core ^11 || ^12.',
            '- Every public symbol is exported from the package root; deep imports into',
            '  `nestjs-twilio/dist/**` are not supported.',
            '- Twilio SDK client options are flat on the module options object. They were',
            '  nested under `options` in v4.',
          ].join('\n'),
          optionalLinks: [
            {
              label: 'npm package',
              url: 'https://www.npmjs.com/package/nestjs-twilio',
              description: 'Published releases and version history.',
            },
            {
              label: 'GitHub repository',
              url: 'https://github.com/lkaric/nestjs-twilio',
              description: 'Source, issues and discussions.',
            },
          ],
          // Order the corpus the way someone learning the library would read
          // it, rather than alphabetically.
          promote: ['getting-started', 'examples', 'configuration', 'features/**', 'guides/**'],
          demote: ['reference/**', 'api/**', 'migration'],
        }),
      ],
      // Organised along Diataxis lines: a tutorial to learn from, how-to
      // guides to work from, and reference to look things up in. The guides
      // are titled as tasks rather than as features, because a reader arrives
      // wanting to do something, not wanting to read about a feature.
      sidebar: [
        {
          label: 'Start Here',
          items: [
            { label: 'Quick Start', slug: 'getting-started' },
            { label: 'Example App', slug: 'examples' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'Register the module', slug: 'configuration' },
            { label: 'Validate webhook signatures', slug: 'features/webhook-validation' },
            { label: 'Return TwiML responses', slug: 'features/twiml-responses' },
            { label: 'Handle Twilio errors', slug: 'features/error-handling' },
            { label: 'Use multiple accounts', slug: 'features/multi-account' },
            { label: 'Add health checks', slug: 'features/health-checks' },
            { label: 'Mint access tokens', slug: 'features/access-tokens' },
            { label: 'Test your integration', slug: 'guides/testing' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'Configuration options', slug: 'reference/configuration' },
            // Injected by starlight-typedoc. Nested here so the generated API
            // reference sits with the other reference material rather than
            // floating at the top level.
            typeDocSidebarGroup,
          ],
        },
        {
          label: 'Upgrading',
          items: [{ label: 'v4 → v5 Migration', slug: 'migration' }],
        },
      ],
    }),
  ],
});
