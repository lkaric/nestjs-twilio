// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightTypeDoc, { typeDocSidebarGroup } from 'starlight-typedoc';
import starlightLlmsTxt from 'starlight-llms-txt';

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
      plugins: [
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
          promote: ['getting-started', 'configuration', 'features/**'],
          demote: ['api/**', 'migration'],
        }),
      ],
      sidebar: [
        {
          label: 'Start Here',
          items: [
            { label: 'Getting Started', slug: 'getting-started' },
            { label: 'Configuration', slug: 'configuration' },
          ],
        },
        {
          label: 'Features',
          items: [
            { label: 'Webhook Validation', slug: 'features/webhook-validation' },
            { label: 'TwiML Responses', slug: 'features/twiml-responses' },
            { label: 'Error Handling', slug: 'features/error-handling' },
            { label: 'Multi-Account Clients', slug: 'features/multi-account' },
            { label: 'Health Checks', slug: 'features/health-checks' },
            { label: 'Access Tokens', slug: 'features/access-tokens' },
          ],
        },
        {
          label: 'Upgrading',
          items: [{ label: 'v4 → v5 Migration', slug: 'migration' }],
        },
        // Injected by starlight-typedoc; position here controls where the
        // generated reference appears in the sidebar.
        typeDocSidebarGroup,
      ],
    }),
  ],
});
