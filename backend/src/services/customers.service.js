import mongoose from 'mongoose';
import { Token } from '../models/Token.js';
import { Service } from '../models/Service.js';
import { Resource } from '../models/Resource.js';
import { DAY_MS } from '../utils/constants.js';
import { DEFAULT_TIME_ZONE } from '../utils/tokenNumber.js';
import { staffToken } from './token.service.js';

// The owner's Customers page: every token, newest first, with search and filters,
// and the same list as a CSV download.

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const minutes = (from, to) => (from && to ? Math.round((to - from) / 60000) : null);

// Filters shared by the list and the CSV. Always limited to this business.
function filterFor(business, { q, status, serviceId, resourceId, days }, now = new Date()) {
  const filter = { businessId: business._id, createdAt: { $gte: new Date(now.getTime() - days * DAY_MS) } };
  if (status) filter.status = status;
  if (serviceId) filter.serviceId = new mongoose.Types.ObjectId(serviceId);
  if (resourceId) filter.resourceId = new mongoose.Types.ObjectId(resourceId);
  if (q) {
    const text = escapeRegex(q.trim());
    const digits = q.replace(/[\s-]/g, '');
    filter.$or = [
      { 'customer.name': { $regex: text, $options: 'i' } },
      { code: { $regex: `^${text}`, $options: 'i' } },
      ...(/^\d{3,}$/.test(digits) ? [{ 'customer.phone': { $regex: `^${escapeRegex(digits)}` } }] : []),
    ];
  }
  return filter;
}

async function namesFor(business) {
  const [services, resources] = await Promise.all([
    Service.find({ businessId: business._id }).select('name'),
    Resource.find({ businessId: business._id }).select('name'),
  ]);
  const name = (list, id) => (id ? list.find((x) => x._id.equals(id))?.name ?? 'Removed' : null);
  return { service: (id) => name(services, id), resource: (id) => name(resources, id) };
}

// GET /api/admin/customers
export async function listCustomers(business, query, now = new Date()) {
  const filter = filterFor(business, query, now);
  const { page, pageSize } = query;
  const [items, total, names] = await Promise.all([
    Token.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize),
    Token.countDocuments(filter),
    namesFor(business),
  ]);
  return {
    items: items.map((t) => ({
      ...staffToken(t),
      serviceName: names.service(t.serviceId),
      resourceName: names.resource(t.resourceId),
      waitMinutes: minutes(t.createdAt, t.calledAt),
    })),
    page,
    pageSize,
    total,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/* ---------------------------------------------------------------- CSV */

// Quotes a value for CSV, and defuses spreadsheet formulas: a customer named "=HYPERLINK(...)"
// must not run as a formula in the owner's spreadsheet.
export function csvCell(value) {
  if (value == null) return '';
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
const csvRow = (cells) => `${cells.map(csvCell).join(',')}\r\n`;

// GET /api/admin/customers/export.csv. Streams row by row, so even a year of tokens never sits in memory.
export async function streamCustomersCsv(business, query, res, now = new Date()) {
  const zone = business.timeZone || DEFAULT_TIME_ZONE;
  const when = new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const time = (date) => (date ? when.format(date) : '');
  const extraFields = (business.settings.customerFields ?? []).filter((f) => !['name', 'phone'].includes(f.key));
  const names = await namesFor(business);

  res.write('﻿'); // lets Excel read names in any language correctly
  res.write(csvRow(['Token', 'Name', 'Phone', ...extraFields.map((f) => f.label), 'Service', business.labels.resource, 'Status', 'Source', 'Priority', 'Joined', 'Called', 'Finished', 'Wait (min)', 'Rating']));

  const cursor = Token.find(filterFor(business, query, now)).sort({ createdAt: -1, _id: -1 }).lean().cursor();
  for await (const t of cursor) {
    if (res.destroyed) break; // the owner cancelled the download
    const finished = t.doneAt ?? t.cancelledAt;
    const ok = res.write(csvRow([
      t.code, t.customer?.name, t.customer?.phone, ...extraFields.map((f) => t.customer?.[f.key]),
      names.service(t.serviceId), names.resource(t.resourceId), t.status, t.source, t.priority ? 'Yes' : 'No',
      time(t.createdAt), time(t.calledAt), time(finished), minutes(t.createdAt, t.calledAt), t.rating,
    ]));
    if (!ok) await new Promise((resolve) => res.once('drain', resolve)); // wait for slow connections
  }
  await cursor.close();
  res.end();
}
