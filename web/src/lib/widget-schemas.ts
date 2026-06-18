import type { JSONSchema7 } from 'json-schema'
import type { WidgetType } from './types'

export const WIDGET_SCHEMAS: Record<WidgetType, JSONSchema7> = {
  number: {
    type: 'object',
    required: ['valueField'],
    properties: {
      valueField: { type: 'string', title: 'Value Field' },
      trendField: { type: 'string', title: 'Trend Field' },
      prefix: { type: 'string', title: 'Prefix' },
      suffix: { type: 'string', title: 'Suffix' },
      decimals: { type: 'integer', title: 'Decimals', default: 0 },
    },
  },
  gauge: {
    type: 'object',
    required: ['valueField'],
    properties: {
      valueField: { type: 'string', title: 'Value Field' },
      min: { type: 'number', title: 'Min', default: 0 },
      max: { type: 'number', title: 'Max', default: 100 },
    },
  },
  bar: {
    type: 'object',
    required: ['xField', 'yFields'],
    properties: {
      xField: { type: 'string', title: 'X-Axis Field' },
      yFields: { type: 'array', title: 'Y-Axis Fields', items: { type: 'string' } },
      stacked: { type: 'boolean', title: 'Stacked', default: false },
      limit: { type: 'integer', title: 'Limit' },
    },
  },
  line: {
    type: 'object',
    required: ['xField', 'yFields'],
    properties: {
      xField: { type: 'string', title: 'X-Axis Field' },
      yFields: { type: 'array', title: 'Y-Axis Fields', items: { type: 'string' } },
      limit: { type: 'integer', title: 'Limit' },
    },
  },
  area: {
    type: 'object',
    required: ['xField', 'yFields'],
    properties: {
      xField: { type: 'string', title: 'X-Axis Field' },
      yFields: { type: 'array', title: 'Y-Axis Fields', items: { type: 'string' } },
      stacked: { type: 'boolean', title: 'Stacked', default: false },
      limit: { type: 'integer', title: 'Limit' },
    },
  },
  pie: {
    type: 'object',
    required: ['labelField', 'valueField'],
    properties: {
      labelField: { type: 'string', title: 'Label Field' },
      valueField: { type: 'string', title: 'Value Field' },
      donut: { type: 'boolean', title: 'Donut', default: false },
    },
  },
  metric: {
    type: 'object',
    properties: {
      fields: {
        type: 'array',
        title: 'Metrics',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string', title: 'Label' },
            valueField: { type: 'string', title: 'Value Field' },
            prefix: { type: 'string', title: 'Prefix' },
            suffix: { type: 'string', title: 'Suffix' },
          },
          required: ['label', 'valueField'],
        },
      },
    },
  },
  table: {
    type: 'object',
    properties: {},
  },
}
