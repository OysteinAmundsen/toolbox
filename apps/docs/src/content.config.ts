import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { z } from 'astro/zod';
import { defineCollection } from 'astro:content';
import { PLUGIN_KIND_NAMES } from './data/plugin-kinds';

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        /** Plugin pages only — rendered as chips beside the title. */
        pluginKinds: z.array(z.enum(PLUGIN_KIND_NAMES)).nonempty().optional(),
      }),
    }),
  }),
};
