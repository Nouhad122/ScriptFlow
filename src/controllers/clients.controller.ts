import type { Request, Response } from 'express';
import {
  getAllClients as dbGetAllClients,
  getClientById as dbGetClientById,
  createClient as dbCreateClient,
  updateClient as dbUpdateClient,
  deleteClientById,
} from '../database/clients.repository';
import type { ClientContext } from '../types';

// ---------------------------------------------------------------------------
// GET /api/clients
// ---------------------------------------------------------------------------

export async function getAllClients(_req: Request, res: Response): Promise<void> {
  try {
    const clients = await dbGetAllClients();
    res.json({ success: true, clients });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Database error while fetching clients',
    });
  }
}

// ---------------------------------------------------------------------------
// GET /api/clients/:id
// ---------------------------------------------------------------------------

export async function getClient(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const client = await dbGetClientById(id);
    if (!client) {
      res.status(404).json({ success: false, error: `No client found with id "${id}"` });
      return;
    }
    res.json({ success: true, client });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Database error while fetching client',
    });
  }
}

// ---------------------------------------------------------------------------
// POST /api/clients
// ---------------------------------------------------------------------------

export async function createClient(req: Request, res: Response): Promise<void> {
  const body = req.body as Partial<Omit<ClientContext, 'id'>>;

  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    res.status(400).json({ success: false, error: 'name is required' });
    return;
  }

  if (!body.niche || typeof body.niche !== 'string' || !body.niche.trim()) {
    res.status(400).json({ success: false, error: 'niche is required' });
    return;
  }

  const data: Omit<ClientContext, 'id'> = {
    name: body.name.trim(),
    niche: body.niche.trim(),
    portfolioSummary: typeof body.portfolioSummary === 'string' ? body.portfolioSummary : '',
    referencePackPath: typeof body.referencePackPath === 'string' ? body.referencePackPath : '',
    avatars: Array.isArray(body.avatars) ? body.avatars : [],
    brandVoice: body.brandVoice && typeof body.brandVoice === 'object'
      ? body.brandVoice
      : { tone: '', speakingStyle: '', doNotUse: [], referenceExamples: [] },
    proofBank: Array.isArray(body.proofBank) ? body.proofBank : [],
    offerMechanics: body.offerMechanics && typeof body.offerMechanics === 'object'
      ? body.offerMechanics
      : { productName: '', price: '', guarantee: '', keyBenefits: [], cta: '' },
  };

  try {
    const client = await dbCreateClient(data);
    res.status(201).json({ success: true, client });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Database error while creating client',
    });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/clients/:id
// ---------------------------------------------------------------------------

export async function updateClient(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const body = req.body as Partial<ClientContext>;

  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    res.status(400).json({ success: false, error: 'name is required' });
    return;
  }

  if (!body.niche || typeof body.niche !== 'string' || !body.niche.trim()) {
    res.status(400).json({ success: false, error: 'niche is required' });
    return;
  }

  const client: ClientContext = {
    id,
    name: body.name.trim(),
    niche: body.niche.trim(),
    portfolioSummary: typeof body.portfolioSummary === 'string' ? body.portfolioSummary : '',
    referencePackPath: typeof body.referencePackPath === 'string' ? body.referencePackPath : '',
    avatars: Array.isArray(body.avatars) ? body.avatars : [],
    brandVoice: body.brandVoice && typeof body.brandVoice === 'object'
      ? body.brandVoice
      : { tone: '', speakingStyle: '', doNotUse: [], referenceExamples: [] },
    proofBank: Array.isArray(body.proofBank) ? body.proofBank : [],
    offerMechanics: body.offerMechanics && typeof body.offerMechanics === 'object'
      ? body.offerMechanics
      : { productName: '', price: '', guarantee: '', keyBenefits: [], cta: '' },
  };

  try {
    const updated = await dbUpdateClient(client);
    if (!updated) {
      res.status(404).json({ success: false, error: `No client found with id "${id}"` });
      return;
    }
    res.json({ success: true, client: updated });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Database error while updating client',
    });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/clients/:id
// ---------------------------------------------------------------------------

export async function deleteClient(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    await deleteClientById(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Database error while deleting client',
    });
  }
}
