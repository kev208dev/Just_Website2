import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
import { z } from 'astro/zod';

const projects = defineCollection({
  loader: file('src/content/projects.json'),
  schema: z.object({
    order: z.number(),
    title: z.string(),
    titleEn: z.string(),
    category: z.string(),
    year: z.number().optional(),
    yearSource: z.string().optional(),
    summary: z.string(),
    problem: z.string().optional(),
    process: z.string().optional(),
    outcomes: z.array(z.string()).default([]),
    features: z.array(z.string()).default([]),
    stack: z.array(z.string()).default([]),
    members: z.array(z.string()).default([]),
    image: z.string(),
    thumb: z.string(),
    imageAspect: z.number(),
    alt: z.string(),
    links: z.object({
      live: z.string().url().optional(),
      github: z.string().url().optional(),
    }),
  }),
});

const members = defineCollection({
  loader: file('src/content/members.json'),
  schema: z.object({
    name: z.string(),
    group: z.string(),
    dept: z.string().optional(),
    role: z.string().optional(),
    nickname: z.string().optional(),
    easterEgg: z.enum(['spider-drop', 'flashbang']).optional(),
    review: z.string().optional(),
  }),
});

const awards = defineCollection({
  loader: file('src/content/awards.json'),
  schema: z.object({
    year: z.number(),
    event: z.string(),
    award: z.string(),
    grade: z.string(),
    tier: z.number().int().min(1).max(5),
    institution: z.string(),
    generations: z.array(z.string()),
    members: z.array(z.string()),
    featured: z.boolean().default(false),
  }),
});

const archive = defineCollection({
  loader: file('src/content/archive.json'),
  schema: z.object({
    title: z.string(),
    grade: z.string(),
    tier: z.number().int().min(1).max(5),
  }),
});

export const collections = { projects, members, awards, archive };
