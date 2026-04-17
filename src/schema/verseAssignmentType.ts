import { defineField, defineType } from 'sanity'

export const verseAssignmentType = defineType({
  name: 'verseAssignment',
  title: 'Verse Assignment',
  type: 'document',
  fields: [
    defineField({
      name: 'language',
      type: 'string',
      readOnly: true,
      hidden: true,
    }),
    defineField({
      name: 'weekNumber',
      title: 'Virtue Week (1-52)',
      type: 'number',
      description: 'Computed from getVirtueWeek(date). This is the primary lookup key.',
      validation: (rule) => rule.required().integer().min(1).max(52),
    }),
    defineField({
      name: 'day',
      title: 'Day (0 = Sun ... 6 = Sat)',
      type: 'number',
      validation: (rule) => rule.required().integer().min(0).max(6),
    }),
    defineField({
      name: 'virtueTitle',
      title: 'Virtue Title',
      type: 'string',
      description: 'Display name of the virtue for this week (e.g. "Prudence").',
    }),
    defineField({
      name: 'virtueLiturgicalContext',
      title: 'Liturgical Context',
      type: 'text',
      description: 'Why this virtue fits this liturgical week.',
      rows: 2,
    }),
    defineField({
      name: 'virtue',
      title: 'Virtue (optional ref)',
      type: 'reference',
      to: [{ type: 'virtue' }],
      weak: true,
      description: 'Optional link to a Sanity virtue document, if one exists.',
    }),
    defineField({
      name: 'dayTheme',
      title: 'Day Theme',
      type: 'string',
      options: {
        list: [
          { title: 'Sunday - Define', value: 'Define' },
          { title: 'Monday - Root', value: 'Root' },
          { title: 'Tuesday - Model', value: 'Model' },
          { title: 'Wednesday - Practice', value: 'Practice' },
          { title: 'Thursday - Obstacle', value: 'Obstacle' },
          { title: 'Friday - Fruit', value: 'Fruit' },
          { title: 'Saturday - Prayer', value: 'Prayer' },
        ],
        layout: 'dropdown',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'reference',
      title: 'Scripture Reference',
      type: 'string',
      description: 'Dotted form: BOOK.CHAPTER.VERSE or BOOK.CHAPTER.VERSE-VERSE (e.g. PHP.4.13, LUK.1.46-47).',
      validation: (rule) =>
        rule.required().regex(/^[1-3]?[A-Z]{2,3}\.\d+\.\d+(-\d+)?$/, {
          name: 'dotted reference',
        }),
    }),
    defineField({
      name: 'bsbText',
      title: 'Verse Text',
      type: 'text',
      description: 'BSB verse text for English; translated verse text for other languages.',
      rows: 3,
    }),
    defineField({
      name: 'rationale',
      title: 'Editorial Rationale',
      type: 'text',
      description: 'Why this verse fits the virtue and day theme.',
      rows: 3,
    }),
    defineField({
      name: 'commentary',
      title: 'Commentary',
      type: 'text',
      description: 'Full commentary for this verse (public domain). May cover a verse group.',
      rows: 6,
    }),
    defineField({
      name: 'commentaryExcerpt',
      title: 'Commentary Excerpt',
      type: 'text',
      description: 'First 2-3 sentences of commentary, suitable for a daily reflection card.',
      rows: 3,
    }),
    defineField({
      name: 'commentarySource',
      title: 'Commentary Source',
      type: 'string',
      description: 'Which commentary was used.',
      options: {
        list: [
          { title: 'Matthew Henry', value: 'matthew-henry' },
          { title: 'Jamieson-Fausset-Brown', value: 'jamieson-fausset-brown' },
          { title: 'John Gill', value: 'john-gill' },
        ],
      },
      readOnly: true,
    }),
    defineField({
      name: 'reviewPageUrl',
      title: 'Review Page Link',
      type: 'url',
      description: 'Deep link to this assignment on the GitHub Pages review page.',
      readOnly: true,
    }),
    defineField({
      name: 'reviewStatus',
      title: 'Review Status',
      type: 'string',
      initialValue: 'draft',
      options: {
        list: [
          { title: 'Draft (AI)', value: 'draft' },
          { title: 'In Review', value: 'review' },
          { title: 'Approved', value: 'approved' },
          { title: 'Needs Rework', value: 'rework' },
        ],
      },
    }),
    defineField({
      name: 'reviewer',
      title: 'Reviewer',
      type: 'string',
    }),
    defineField({
      name: 'reviewedAt',
      title: 'Reviewed At',
      type: 'datetime',
    }),
  ],
  preview: {
    select: {
      week: 'weekNumber',
      day: 'day',
      theme: 'dayTheme',
      ref: 'reference',
      virtueTitle: 'virtueTitle',
    },
    prepare({ week, day, theme, ref, virtueTitle }) {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      return {
        title: `W${week} ${days[day] ?? day} - ${virtueTitle ?? '(week ' + week + ')'}`,
        subtitle: `${theme ?? '-'} · ${ref ?? '-'}`,
      }
    },
  },
  orderings: [
    {
      title: 'Week then day',
      name: 'weekDay',
      by: [
        { field: 'weekNumber', direction: 'asc' },
        { field: 'day', direction: 'asc' },
      ],
    },
  ],
})
