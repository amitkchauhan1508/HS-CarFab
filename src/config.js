import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  hubspotToken: required('HUBSPOT_TOKEN'),
  hubspotBaseUrl: process.env.HUBSPOT_BASE_URL || 'https://api.hubapi.com',

  // Destination stage the deal is moved to after the PDF is generated. Optional.
  targetStageId: process.env.TARGET_STAGE_ID || '',

  // Cheap shared-secret check on the webhook (?token=...). Optional.
  webhookToken: process.env.WEBHOOK_TOKEN || '',

  // Deal property used to mark generation and prevent regenerating on re-drag. Optional.
  idempotencyProperty: process.env.IDEMPOTENCY_PROPERTY || '',

  // Checkbox property set via bulk Edit to trigger generation; reset to false after. Optional.
  triggerProperty: process.env.TRIGGER_PROPERTY || 'generate_ebook_letter',

  filesFolderPath: process.env.FILES_FOLDER_PATH || '/ebook-letters',
  companyName: process.env.COMPANY_NAME || 'IQ Capital',
};
