/**
 * Data access layer for clients.
 *
 * All nested objects (avatars, brandVoice, proofBank, offerMechanics) are
 * stored as JSON text columns and parsed on read. No raw rows leak outside
 * this module.
 */

import { randomUUID } from 'crypto';
import { getDb } from './connection';
import type { ClientContext, Avatar, BrandVoice, ProofPoint, OfferMechanics } from '../types';
import type { Row } from '@libsql/client';

// ---------------------------------------------------------------------------
// Row → ClientContext mapping
// ---------------------------------------------------------------------------

function rowToClient(row: Row): ClientContext {
  return {
    id: row['id'] as string,
    name: row['name'] as string,
    niche: row['niche'] as string,
    portfolioSummary: row['portfolio_summary'] as string,
    referencePackPath: row['reference_pack_path'] as string,
    avatars: JSON.parse(row['avatars'] as string) as Avatar[],
    brandVoice: JSON.parse(row['brand_voice'] as string) as BrandVoice,
    proofBank: JSON.parse(row['proof_bank'] as string) as ProofPoint[],
    offerMechanics: JSON.parse(row['offer_mechanics'] as string) as OfferMechanics,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getAllClients(): Promise<ClientContext[]> {
  const db = getDb();
  const result = await db.execute('SELECT * FROM clients ORDER BY created_at ASC');
  return result.rows.map(rowToClient);
}

export async function getClientById(id: string): Promise<ClientContext | null> {
  const db = getDb();
  const result = await db.execute({ sql: 'SELECT * FROM clients WHERE id = ?', args: [id] });
  if (result.rows.length === 0) return null;
  return rowToClient(result.rows[0]);
}

export async function createClient(data: Omit<ClientContext, 'id'>): Promise<ClientContext> {
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO clients
      (id, name, niche, portfolio_summary, reference_pack_path,
       avatars, brand_voice, proof_bank, offer_mechanics, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      data.name,
      data.niche,
      data.portfolioSummary,
      data.referencePackPath,
      JSON.stringify(data.avatars),
      JSON.stringify(data.brandVoice),
      JSON.stringify(data.proofBank),
      JSON.stringify(data.offerMechanics),
      now,
    ],
  });

  return { id, ...data };
}

export async function updateClient(client: ClientContext): Promise<ClientContext | null> {
  const db = getDb();
  const result = await db.execute({
    sql: `UPDATE clients
      SET name = ?, niche = ?, portfolio_summary = ?, reference_pack_path = ?,
          avatars = ?, brand_voice = ?, proof_bank = ?, offer_mechanics = ?
      WHERE id = ?`,
    args: [
      client.name,
      client.niche,
      client.portfolioSummary,
      client.referencePackPath,
      JSON.stringify(client.avatars),
      JSON.stringify(client.brandVoice),
      JSON.stringify(client.proofBank),
      JSON.stringify(client.offerMechanics),
      client.id,
    ],
  });

  if (result.rowsAffected === 0) return null;
  return client;
}

export async function deleteClientById(id: string): Promise<void> {
  const db = getDb();
  await db.execute({ sql: 'DELETE FROM clients WHERE id = ?', args: [id] });
}
