import { config } from './config.js';
import * as hs from './hubspot.js';
import { generateLetterPdf } from './render.js';

// Guards against the same deal being processed twice concurrently (rapid re-drag).
const inFlight = new Set();

function fmtDate(value) {
  if (!value) return '';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  return dt.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtAmount(value) {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
}

export async function processDeal(dealId) {
  if (inFlight.has(dealId)) {
    console.log(`Deal ${dealId} already in flight, skipping`);
    return;
  }
  inFlight.add(dealId);
  try {
    const deal = await hs.getDeal(dealId);
    const props = deal.properties || {};

    if (config.idempotencyProperty && props[config.idempotencyProperty]) {
      console.log(`Deal ${dealId} already generated (${config.idempotencyProperty}), skipping`);
      return;
    }

    const contactId = deal.associations?.contacts?.results?.[0]?.id;
    const companyId = deal.associations?.companies?.results?.[0]?.id;
    const contact = contactId ? (await hs.getContact(contactId)).properties || {} : {};
    const company = companyId ? (await hs.getCompany(companyId)).properties || {} : {};

    const firstname = contact.firstname || '';
    const lastname = contact.lastname || '';
    const fullname =
      [firstname, lastname].filter(Boolean).join(' ') || company.name || props.dealname || 'Customer';

    const street = contact.address || company.address || '';
    const city = (contact.city || company.city || '').toUpperCase();
    const region = [city, contact.state || company.state].filter(Boolean).join(', ');
    const cityLine = [region, contact.zip || company.zip].filter(Boolean).join(' ');

    const tokens = {
      firstname,
      lastname,
      fullname,
      address: street,
      cityLine,
      city: contact.city || company.city || '',
      state: contact.state || company.state || '',
      zip: contact.zip || company.zip || '',
      country: contact.country || company.country || '',
      companyName: config.companyName,
      dealName: props.dealname || '',
      amount: fmtAmount(props.amount),
      closeDate: fmtDate(props.closedate),
      date: fmtDate(Date.now()),
    };

    const pdf = await generateLetterPdf(tokens);

    const safeName = fullname.replace(/[^\w-]+/g, '_');
    const filename = `eBook_Letter_${safeName}_${dealId}.pdf`;
    const file = await hs.uploadFile(pdf, filename);
    await hs.attachFileToDeal(dealId, file.id, `eBook letter generated for ${fullname}.`);
    // Stamp idempotency BEFORE moving the stage: the move re-triggers the drag
    // workflow, and the second webhook must see the stamp and skip.
    await hs.markGenerated(dealId);

    if (config.targetStageId && props.dealstage !== config.targetStageId) {
      await hs.updateDeal(dealId, { dealstage: config.targetStageId });
    }
    if (config.triggerProperty && props[config.triggerProperty] && props[config.triggerProperty] !== 'false') {
      await hs.updateDeal(dealId, { [config.triggerProperty]: false });
    }

    console.log(`Deal ${dealId}: attached ${filename} (file ${file.id})`);
  } catch (err) {
    console.error(`Deal ${dealId} processing failed:`, err);
  } finally {
    inFlight.delete(dealId);
  }
}
