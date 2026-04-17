import { defineField, defineType } from 'sanity'

export const verseOfDayType = defineType({
  name: 'verseOfDay',
  title: 'Verse of the Day',
  type: 'document',
  fields: [
    defineField({
      name: 'language',
      type: 'string',
      readOnly: true,
      hidden: true,
    }),
    defineField({
      name: 'date',
      title: 'Date (YYYY-MM-DD)',
      type: 'string',
      description: 'The calendar date this verse is published for.',
      validation: (rule) =>
        rule.required().regex(/^\d{4}-\d{2}-\d{2}$/, { name: 'ISO date' }),
    }),
    defineField({
      name: 'weekNumber',
      title: 'Virtue Week (1-52)',
      type: 'number',
    }),
    defineField({
      name: 'day',
      title: 'Day (0=Sun...6=Sat)',
      type: 'number',
    }),
    defineField({
      name: 'dayTheme',
      title: 'Day Theme',
      type: 'string',
    }),
    defineField({
      name: 'virtueTitle',
      title: 'Virtue Title',
      type: 'string',
      description: 'Display name of the virtue for this week.',
    }),
    defineField({
      name: 'virtue',
      title: 'Virtue (optional ref)',
      type: 'reference',
      to: [{ type: 'virtue' }],
      weak: true,
      description: 'Optional link to a Sanity virtue doc, if one exists.',
    }),
    defineField({
      name: 'reference',
      title: 'Scripture Reference (OSIS)',
      type: 'string',
    }),
    defineField({
      name: 'bookName',
      title: 'Book Name',
      type: 'string',
    }),
    defineField({
      name: 'humanReference',
      title: 'Human Reference',
      type: 'string',
    }),
    defineField({
      name: 'bsbText',
      title: 'Verse Text',
      type: 'text',
      description: 'BSB text for English; translated text for other languages.',
      rows: 3,
    }),
    defineField({
      name: 'rationale',
      title: 'Editorial Rationale',
      type: 'text',
      rows: 2,
    }),
    defineField({
      name: 'commentaryExcerpt',
      title: 'Commentary Excerpt',
      type: 'text',
      description: 'Short reflection from commentary (may vary by language).',
      rows: 3,
    }),
    defineField({
      name: 'assignment',
      title: 'Source Assignment',
      type: 'reference',
      to: [{ type: 'verseAssignment' }],
      weak: true,
    }),
    defineField({
      name: 'publishedAt',
      title: 'Published At',
      type: 'datetime',
    }),
  ],
  preview: {
    select: {
      date: 'date',
      ref: 'humanReference',
      virtueTitle: 'virtueTitle',
      language: 'language',
    },
    prepare({ date, ref, virtueTitle, language }) {
      return {
        title: `${date} [${language || 'en'}] - ${ref ?? '(no ref)'}`,
        subtitle: virtueTitle ? `Virtue: ${virtueTitle}` : undefined,
      }
    },
  },
  orderings: [
    {
      title: 'Date (newest first)',
      name: 'dateDesc',
      by: [{ field: 'date', direction: 'desc' }],
    },
  ],
})
