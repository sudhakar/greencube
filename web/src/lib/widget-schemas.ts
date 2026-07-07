import type { JSONSchema7 } from 'json-schema'
import type { WidgetType } from './types'

export const WIDGET_SCHEMAS: Record<WidgetType, JSONSchema7> = {
  number: {
    type: 'object',
    required: ['valueField'],
    properties: {
      title: { type: 'string', title: 'Title', default: 'Widget Title' },
      titleAlign: { type: 'string', title: 'Align', default: 'center', enum: ['left', 'center', 'right'] },
      valueField: { type: 'string', title: 'Value Field' },
      valueFormat: { type: 'string', title: 'Value Format', default: 'auto' },
      trendField: { type: 'string', title: 'Trend Field' },
      prefix: { type: 'string', title: 'Prefix' },
      suffix: { type: 'string', title: 'Suffix' },
      decimals: { type: 'integer', title: 'Decimals', default: 0 },
    },
  },
  bar: {
    type: 'object',
    required: ['xField', 'yFields'],
    properties: {
      title: { type: 'string', title: 'Title', default: 'Widget Title' },
      titleAlign: { type: 'string', title: 'Align', default: 'center', enum: ['left', 'center', 'right'] },
      xField: { type: 'string', title: 'X-Axis Field' },
      xFormat: { type: 'string', title: 'X-Axis Format', default: 'auto' },
      yFields: { type: 'array', title: 'Y-Axis Fields', items: { type: 'string' } },
      yFormat: { type: 'string', title: 'Y-Axis Format', default: 'auto' },
      stacked: { type: 'boolean', title: 'Stacked', default: false },
      limit: { type: 'integer', title: 'Limit' },
    },
  },
  line: {
    type: 'object',
    required: ['xField', 'yFields'],
    properties: {
      title: { type: 'string', title: 'Title', default: 'Widget Title' },
      titleAlign: { type: 'string', title: 'Align', default: 'center', enum: ['left', 'center', 'right'] },
      xField: { type: 'string', title: 'X-Axis Field' },
      xFormat: { type: 'string', title: 'X-Axis Format', default: 'auto' },
      yFields: { type: 'array', title: 'Y-Axis Fields', items: { type: 'string' } },
      yFormat: { type: 'string', title: 'Y-Axis Format', default: 'auto' },
      limit: { type: 'integer', title: 'Limit' },
    },
  },
  area: {
    type: 'object',
    required: ['xField', 'yFields'],
    properties: {
      title: { type: 'string', title: 'Title', default: 'Widget Title' },
      titleAlign: { type: 'string', title: 'Align', default: 'center', enum: ['left', 'center', 'right'] },
      xField: { type: 'string', title: 'X-Axis Field' },
      xFormat: { type: 'string', title: 'X-Axis Format', default: 'auto' },
      yFields: { type: 'array', title: 'Y-Axis Fields', items: { type: 'string' } },
      yFormat: { type: 'string', title: 'Y-Axis Format', default: 'auto' },
      stacked: { type: 'boolean', title: 'Stacked', default: false },
      limit: { type: 'integer', title: 'Limit' },
    },
  },
  pie: {
    type: 'object',
    required: ['labelField', 'valueField'],
    properties: {
      title: { type: 'string', title: 'Title', default: 'Widget Title' },
      titleAlign: { type: 'string', title: 'Align', default: 'center', enum: ['left', 'center', 'right'] },
      labelField: { type: 'string', title: 'Label Field' },
      valueField: { type: 'string', title: 'Value Field' },
      valueFormat: { type: 'string', title: 'Value Format', default: 'auto' },
      donut: { type: 'boolean', title: 'Donut', default: false },
    },
  },
  table: {
    type: 'object',
    properties: {
      title: { type: 'string', title: 'Title', default: 'Widget Title' },
      titleAlign: { type: 'string', title: 'Align', default: 'center', enum: ['left', 'center', 'right'] },
      columnFormats: {
        type: 'array',
        title: 'Format Column',
        items: {
          type: 'object',
          title: ' ',
          properties: {
            field: { type: 'string' },
            prefix: { type: 'string', default: '' },
            format: { type: 'string', default: 'none' },
            precision: { type: 'integer', default: 0, minimum: 0, maximum: 9 },
          },
          required: ['field'],
        },
      },
    },
  },
}
