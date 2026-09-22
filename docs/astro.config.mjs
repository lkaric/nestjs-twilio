// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightTypeDoc, { typeDocSidebarGroup } from 'starlight-typedoc';

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
