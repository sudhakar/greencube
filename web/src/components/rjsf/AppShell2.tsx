import Form from '@rjsf/shadcn'
import validator from '@rjsf/validator-ajv8'
import { useState } from 'react'
import {
  CompactAddButton,
  CompactArrayFieldTemplate,
  CompactArrayFieldTitleTemplate,
  CompactArrayItemTemplate,
  CompactObjectFieldTemplate,
  FieldSelect,
  FlatFormatList,
  FormatSelect,
  MultiFieldSelect,
  PrefixSelect,
  TitleWidget,
  XsBaseInputTemplate,
} from '@/components/widget-config'
import type { WidgetType } from '@/lib/types'
import { getSampleFormData, getSampleSchema, getSampleUiSchema, SAMPLE_WIDGET_TYPES } from './SAMPLE_SCHEMA'

export function AppShell2() {
  const [widgetType, setWidgetType] = useState<WidgetType>('number')
  const [config, setConfig] = useState<Record<string, unknown>>(getSampleFormData('number'))

  const handleTypeChange = (type: WidgetType) => {
    setWidgetType(type)
    setConfig(getSampleFormData(type))
  }

  const schema = getSampleSchema(widgetType)
  const uiSchema = getSampleUiSchema(widgetType)
  const formData = config

  return (
    <div className="w-[480px] min-w-0 bg-background p-2 overflow-auto m-auto mt-20">
      <div className="border rounded-sm p-4 bg-card">
        <div className="flex flex-wrap gap-1 mb-3">
          {SAMPLE_WIDGET_TYPES.map((wt) => (
            <button
              key={wt.type}
              type="button"
              onClick={() => handleTypeChange(wt.type)}
              className={`text-[11px] px-2 py-1 rounded-sm border cursor-pointer ${widgetType === wt.type
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-foreground border-input hover:bg-muted'
                }`}
            >
              {wt.label}
            </button>
          ))}
        </div>

        <Form
          schema={schema}
          formData={formData}
          validator={validator}
          uiSchema={uiSchema}
          formContext={config}
          fields={{ flatFormatList: FlatFormatList as never }}
          widgets={{
            fieldSelect: FieldSelect,
            multiFieldSelect: MultiFieldSelect,
            formatSelect: FormatSelect,
            prefixSelect: PrefixSelect,
            titleWidget: TitleWidget,
          }}
          templates={{
            ArrayFieldTemplate: CompactArrayFieldTemplate,
            ArrayFieldItemTemplate: CompactArrayItemTemplate,
            ArrayFieldTitleTemplate: CompactArrayFieldTitleTemplate,
            ObjectFieldTemplate: CompactObjectFieldTemplate as never,
            BaseInputTemplate: XsBaseInputTemplate,
            ButtonTemplates: { AddButton: CompactAddButton },
          }}
          onChange={(e) => setConfig(e.formData as Record<string, unknown>)}
          className="widget-config-xs"
        >
          <></>
        </Form>
      </div>
    </div>
  )
}
