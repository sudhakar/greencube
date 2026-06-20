import type { JSONSchema7 } from 'json-schema'
import type { WidgetType } from '@/lib/types'
import { WIDGET_SCHEMAS } from '@/lib/widget-schemas'

export const SAMPLE_WIDGET_TYPES: { type: WidgetType; label: string; desc: string }[] = [
  { type: 'number', label: 'Number', desc: 'Single value with optional trend' },
  { type: 'bar', label: 'Bar Chart', desc: 'Categorical comparison' },
  { type: 'line', label: 'Line Chart', desc: 'Trend over time' },
  { type: 'area', label: 'Area Chart', desc: 'Filled trend' },
  { type: 'pie', label: 'Pie Chart', desc: 'Proportions' },
  { type: 'table', label: 'Table', desc: 'Tabular data' },
]

export const SAMPLE_FORM_DATA: Record<WidgetType, Record<string, unknown>> = {
  number: {
    title: 'Total Revenue',
    valueField: 'orders.revenue',
    valueFormat: 'compact',
    trendField: 'orders.count',
    prefix: '$',
    suffix: '',
    decimals: 0,
  },
  bar: {
    title: 'Sales by Category',
    xField: 'products.category',
    xFormat: 'auto',
    yFields: ['orders.revenue'],
    yFormat: 'compact',
    stacked: false,
    limit: 10,
  },
  line: {
    title: 'Revenue Trend',
    xField: 'orders.createdAt',
    xFormat: 'date-MMM-D',
    yFields: ['orders.revenue'],
    yFormat: 'compact',
    limit: 30,
  },
  area: {
    title: 'Cumulative Growth',
    xField: 'orders.createdAt',
    xFormat: 'date-MMM-D',
    yFields: ['orders.revenue', 'orders.count'],
    yFormat: 'compact',
    stacked: true,
    limit: 30,
  },
  pie: {
    title: 'Market Share',
    labelField: 'products.category',
    valueField: 'orders.revenue',
    valueFormat: 'compact',
    donut: false,
  },
  table: {
    title: 'Order Details',
    columnFormats: [
      { field: 'orders.id', prefix: '', format: 'none', precision: 0 },
      { field: 'orders.revenue', prefix: '$', format: 'compact', precision: 1 },
      { field: 'orders.createdAt', prefix: '', format: 'date-MMM-D-YYYY', precision: 0 },
    ],
  },
}

export const SAMPLE_UI_SCHEMAS: Record<WidgetType, Record<string, unknown>> = {
  number: {
    title: { 'ui:widget': 'titleWidget', 'ui:options': { label: false } },
    valueField: { 'ui:widget': 'fieldSelect', 'ui:options': { fields: ['orders.revenue', 'orders.count', 'products.price'] } },
    trendField: { 'ui:widget': 'fieldSelect', 'ui:options': { fields: ['orders.revenue', 'orders.count', 'products.price'] } },
    valueFormat: { 'ui:widget': 'formatSelect', 'ui:options': { fieldType: 'number' } },
    prefix: { 'ui:widget': 'prefixSelect' },
  },
  bar: {
    title: { 'ui:widget': 'titleWidget', 'ui:options': { label: false } },
    xField: { 'ui:widget': 'fieldSelect', 'ui:options': { fields: ['products.category', 'orders.createdAt', 'products.name'] } },
    yFields: { 'ui:widget': 'multiFieldSelect', 'ui:options': { fields: ['orders.revenue', 'orders.count'] } },
    yFormat: { 'ui:widget': 'formatSelect', 'ui:options': { fieldType: 'number' } },
    xFormat: { 'ui:widget': 'formatSelect', 'ui:options': { fieldType: 'string' } },
  },
  line: {
    title: { 'ui:widget': 'titleWidget', 'ui:options': { label: false } },
    xField: { 'ui:widget': 'fieldSelect', 'ui:options': { fields: ['orders.createdAt', 'products.category', 'products.name'] } },
    yFields: { 'ui:widget': 'multiFieldSelect', 'ui:options': { fields: ['orders.revenue', 'orders.count'] } },
    yFormat: { 'ui:widget': 'formatSelect', 'ui:options': { fieldType: 'number' } },
    xFormat: { 'ui:widget': 'formatSelect', 'ui:options': { fieldType: 'time' } },
  },
  area: {
    title: { 'ui:widget': 'titleWidget', 'ui:options': { label: false } },
    xField: { 'ui:widget': 'fieldSelect', 'ui:options': { fields: ['orders.createdAt', 'products.category'] } },
    yFields: { 'ui:widget': 'multiFieldSelect', 'ui:options': { fields: ['orders.revenue', 'orders.count'] } },
    yFormat: { 'ui:widget': 'formatSelect', 'ui:options': { fieldType: 'number' } },
    xFormat: { 'ui:widget': 'formatSelect', 'ui:options': { fieldType: 'time' } },
  },
  pie: {
    title: { 'ui:widget': 'titleWidget', 'ui:options': { label: false } },
    labelField: { 'ui:widget': 'fieldSelect', 'ui:options': { fields: ['products.category', 'products.name'] } },
    valueField: { 'ui:widget': 'fieldSelect', 'ui:options': { fields: ['orders.revenue', 'orders.count'] } },
    valueFormat: { 'ui:widget': 'formatSelect', 'ui:options': { fieldType: 'number' } },
  },
  table: {
    title: { 'ui:widget': 'titleWidget', 'ui:options': { label: false } },
    columnFormats: { 'ui:field': 'flatFormatList' },
  },
}

export function getSampleSchema(type: WidgetType): JSONSchema7 {
  return WIDGET_SCHEMAS[type]
}

export function getSampleUiSchema(type: WidgetType): Record<string, unknown> {
  return SAMPLE_UI_SCHEMAS[type] ?? {}
}

export function getSampleFormData(type: WidgetType): Record<string, unknown> {
  return SAMPLE_FORM_DATA[type] ?? {}
}
