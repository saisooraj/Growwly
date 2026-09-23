// Builds an unsigned iOS `.shortcut` file (an XML property list) for the
// "quick add" flow: Ask amount → Ask description → pick category → POST to
// /api/ios-shortcut/transaction.
//
// Unsigned shortcuts import only when "Allow Untrusted Shortcuts" is enabled
// (Settings → Shortcuts). The settings page bakes in the user's origin + token
// so there is nothing to paste after import.

const OBJ = '￼' // object-replacement char — the attachment placeholder

function uuid(): string {
  try {
    return crypto.randomUUID().toUpperCase()
  } catch {
    return 'XXXXXXXX-XXXX-4XXX-YXXX-XXXXXXXXXXXX'.replace(/[XY]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'X' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    }).toUpperCase()
  }
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** A WFTextTokenString holding a single variable reference. */
function varToken(name: string): string {
  return `<dict>
  <key>Value</key>
  <dict>
    <key>attachmentsByRange</key>
    <dict>
      <key>{0, 1}</key>
      <dict>
        <key>Type</key><string>Variable</string>
        <key>VariableName</key><string>${esc(name)}</string>
      </dict>
    </dict>
    <key>string</key><string>${OBJ}</string>
  </dict>
  <key>WFSerializationType</key><string>WFTextTokenString</string>
</dict>`
}

/** A WFTextTokenString holding a plain literal. */
function literalToken(value: string): string {
  return `<dict>
  <key>Value</key><dict><key>string</key><string>${esc(value)}</string></dict>
  <key>WFSerializationType</key><string>WFTextTokenString</string>
</dict>`
}

function dictItem(key: string, valueToken: string): string {
  return `<dict>
  <key>WFItemType</key><integer>0</integer>
  <key>WFKey</key>${literalToken(key)}
  <key>WFValue</key>${valueToken}
</dict>`
}

function action(identifier: string, params: Record<string, string>): string {
  const entries = Object.entries(params)
    .map(([k, v]) => `      <key>${k}</key>\n      ${v.replace(/\n/g, '\n      ')}`)
    .join('\n')
  return `    <dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>${identifier}</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
${entries}
      </dict>
    </dict>`
}

export interface BuildShortcutOpts {
  origin: string
  token: string
  categories: string[]
}

export function buildQuickAddShortcut({ origin, token, categories }: BuildShortcutOpts): string {
  const askAmount = uuid()
  const askDesc = uuid()
  const listUuid = uuid()
  const chooseUuid = uuid()

  const endpoint = `${origin.replace(/\/$/, '')}/api/ios-shortcut/transaction`

  const actionOutput = (outputUuid: string) => `<dict>
  <key>Value</key>
  <dict>
    <key>OutputUUID</key><string>${outputUuid}</string>
    <key>Type</key><string>ActionOutput</string>
  </dict>
  <key>WFSerializationType</key><string>WFTextTokenAttachment</string>
</dict>`

  const listItems = categories
    .map((c) => `        <string>${esc(c)}</string>`)
    .join('\n')

  const jsonBody = `<dict>
  <key>Value</key>
  <dict>
    <key>WFDictionaryFieldValueItems</key>
    <array>
${dictItem('token', literalToken(token))}
${dictItem('amount', varToken('sw_amount'))}
${dictItem('description', varToken('sw_desc'))}
${dictItem('category', varToken('sw_cat'))}
    </array>
  </dict>
  <key>WFSerializationType</key><string>WFDictionaryFieldValue</string>
</dict>`

  const actions = [
    action('is.workflow.actions.ask', {
      WFInputType: '<string>Number</string>',
      WFAskActionPrompt: '<string>Amount (₹)</string>',
      UUID: `<string>${askAmount}</string>`,
    }),
    action('is.workflow.actions.setvariable', {
      WFVariableName: '<string>sw_amount</string>',
      WFInput: actionOutput(askAmount),
    }),
    action('is.workflow.actions.ask', {
      WFInputType: '<string>Text</string>',
      WFAskActionPrompt: '<string>What was it for?</string>',
      UUID: `<string>${askDesc}</string>`,
    }),
    action('is.workflow.actions.setvariable', {
      WFVariableName: '<string>sw_desc</string>',
      WFInput: actionOutput(askDesc),
    }),
    action('is.workflow.actions.list', {
      WFItems: `<array>\n${listItems}\n      </array>`,
      UUID: `<string>${listUuid}</string>`,
    }),
    action('is.workflow.actions.choosefromlist', {
      WFInput: actionOutput(listUuid),
      WFChooseFromListActionPrompt: '<string>Category</string>',
      UUID: `<string>${chooseUuid}</string>`,
    }),
    action('is.workflow.actions.setvariable', {
      WFVariableName: '<string>sw_cat</string>',
      WFInput: actionOutput(chooseUuid),
    }),
    action('is.workflow.actions.downloadurl', {
      WFURL: `<string>${esc(endpoint)}</string>`,
      WFHTTPMethod: '<string>POST</string>',
      WFHTTPBodyType: '<string>JSON</string>',
      WFJSONValues: jsonBody,
    }),
    action('is.workflow.actions.showresult', {
      Text: literalToken('Saved to Growwly ✅'),
    }),
  ].join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>WFWorkflowClientVersion</key><string>1146.14</string>
  <key>WFWorkflowMinimumClientVersion</key><integer>900</integer>
  <key>WFWorkflowMinimumClientVersionString</key><string>900</string>
  <key>WFWorkflowHasOutputFallback</key><false/>
  <key>WFWorkflowHasShortcutInputVariables</key><false/>
  <key>WFWorkflowIcon</key>
  <dict>
    <key>WFWorkflowIconStartColor</key><integer>4292093695</integer>
    <key>WFWorkflowIconGlyphNumber</key><integer>59761</integer>
  </dict>
  <key>WFWorkflowImportQuestions</key><array/>
  <key>WFWorkflowTypes</key>
  <array>
    <string>NCWidget</string>
    <string>ActionExtension</string>
  </array>
  <key>WFWorkflowInputContentItemClasses</key>
  <array>
    <string>WFAppStoreAppContentItem</string>
    <string>WFArticleContentItem</string>
    <string>WFContactContentItem</string>
    <string>WFDateContentItem</string>
    <string>WFEmailAddressContentItem</string>
    <string>WFGenericFileContentItem</string>
    <string>WFImageContentItem</string>
    <string>WFiTunesProductContentItem</string>
    <string>WFLocationContentItem</string>
    <string>WFDCMapsLinkContentItem</string>
    <string>WFAVAssetContentItem</string>
    <string>WFPDFContentItem</string>
    <string>WFPhoneNumberContentItem</string>
    <string>WFRichTextContentItem</string>
    <string>WFSafariWebPageContentItem</string>
    <string>WFStringContentItem</string>
    <string>WFURLContentItem</string>
  </array>
  <key>WFWorkflowActions</key>
  <array>
${actions}
  </array>
</dict>
</plist>
`
}
