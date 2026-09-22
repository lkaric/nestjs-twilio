// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://lkaric.github.io',
  base: '/nestjs-twilio',
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
        baseUrl: 'https://github.com/lkaric/nestjs-twilio/edit/main/docs/',
      },
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
      ],
    }),
  ],
});
