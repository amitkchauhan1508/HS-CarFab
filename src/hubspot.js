import { config } from './config.js';

const { hubspotToken, hubspotBaseUrl } = config;

async function hsFetch(path, options = {}) {
  const res = await fetch(`${hubspotBaseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${hubspotToken}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot ${options.method || 'GET'} ${path} failed: ${res.status} ${text}`);
  }
  return res;
}

const DEAL_PROPS = ['dealname', 'amount', 'closedate', 'createdate', 'dealstage', 'hubspot_owner_id', 'pipeline'];
const CONTACT_PROPS = ['firstname', 'lastname', 'email', 'address', 'city', 'state', 'zip', 'country'];
const COMPANY_PROPS = ['name', 'address', 'city', 'state', 'zip', 'country'];

// note -> deal association (HubSpot-defined)
const NOTE_TO_DEAL_TYPE_ID = 214;

export async function getDeal(dealId) {
  const props = [...DEAL_PROPS];
  if (config.idempotencyProperty) props.push(config.idempotencyProperty);
  if (config.triggerProperty) props.push(config.triggerProperty);
  const params = new URLSearchParams();
  params.set('properties', props.join(','));
  params.set('associations', 'contacts,companies');
  const res = await hsFetch(`/crm/v3/objects/deals/${dealId}?${params}`);
  return res.json();
}

export async function getContact(contactId) {
  const params = new URLSearchParams({ properties: CONTACT_PROPS.join(',') });
  const res = await hsFetch(`/crm/v3/objects/contacts/${contactId}?${params}`);
  return res.json();
}

export async function getCompany(companyId) {
  const params = new URLSearchParams({ properties: COMPANY_PROPS.join(',') });
  const res = await hsFetch(`/crm/v3/objects/companies/${companyId}?${params}`);
  return res.json();
}

export async function uploadFile(buffer, filename) {
  const form = new FormData();
  form.set('file', new Blob([buffer], { type: 'application/pdf' }), filename);
  form.set('folderPath', config.filesFolderPath);
  form.set('options', JSON.stringify({ access: 'PRIVATE', overwrite: false }));
  const res = await hsFetch('/files/v3/files', { method: 'POST', body: form });
  return res.json();
}

export async function attachFileToDeal(dealId, fileId, noteBody) {
  const body = {
    properties: {
      hs_timestamp: Date.now(),
      hs_note_body: noteBody,
      hs_attachment_ids: String(fileId),
    },
    associations: [
      {
        to: { id: String(dealId) },
        types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: NOTE_TO_DEAL_TYPE_ID }],
      },
    ],
  };
  const res = await hsFetch('/crm/v3/objects/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function updateDeal(dealId, properties) {
  const res = await hsFetch(`/crm/v3/objects/deals/${dealId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ properties }),
  });
  return res.json();
}

export async function markGenerated(dealId) {
  if (!config.idempotencyProperty) return;
  try {
    await updateDeal(dealId, { [config.idempotencyProperty]: new Date().toISOString() });
  } catch (err) {
    console.warn(`Could not set idempotency property on deal ${dealId}: ${err.message}`);
  }
}
