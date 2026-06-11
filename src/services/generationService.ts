import { getDB, persist } from '../lib/database';
import { getDeviceId } from '../lib/deviceId';
import type { Generation, GenerationType } from '../types';

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  (crypto || window.crypto).getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function rowToGeneration(row: Record<string, unknown>): Generation {
  return {
    id: row.id as string,
    device_id: row.device_id as string,
    type: row.type as Generation['type'],
    prompt: row.prompt as string,
    settings_json: JSON.parse((row.settings_json as string) || '{}'),
    output_url: (row.output_url as string) ?? null,
    thumbnail_url: (row.thumbnail_url as string) ?? null,
    status: row.status as Generation['status'],
    error_message: (row.error_message as string) ?? null,
    comfy_job_id: (row.comfy_job_id as string) ?? null,
    progress: row.progress as number,
    created_at: row.created_at as string,
    completed_at: (row.completed_at as string) ?? null,
  };
}

export async function createGeneration(
  type: Generation['type'],
  prompt: string,
  settings: Record<string, unknown>
): Promise<Generation> {
  const db = await getDB();
  const id = generateUUID();
  const deviceId = getDeviceId();
  const now = new Date().toISOString();

  db.run(
    `INSERT INTO generations (id, device_id, type, prompt, settings_json, status, progress, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', 0, ?)`,
    [id, deviceId, type, prompt, JSON.stringify(settings), now]
  );
  await persist();

  return {
    id,
    device_id: deviceId,
    type,
    prompt,
    settings_json: settings,
    output_url: null,
    thumbnail_url: null,
    status: 'pending',
    error_message: null,
    comfy_job_id: null,
    progress: 0,
    created_at: now,
    completed_at: null,
  };
}

export async function updateGeneration(
  id: string,
  updates: Partial<Pick<Generation, 'status' | 'output_url' | 'thumbnail_url' | 'error_message' | 'comfy_job_id' | 'progress' | 'completed_at'>>
): Promise<Generation> {
  const db = await getDB();

  const setClauses: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      setClauses.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (setClauses.length > 0) {
    values.push(id);
    db.run(
      `UPDATE generations SET ${setClauses.join(', ')} WHERE id = ?`,
      values as (string | number | null)[]
    );
    await persist();
  }

  const stmt = db.prepare('SELECT * FROM generations WHERE id = ?');
  stmt.bind([id]);
  if (!stmt.step()) {
    stmt.free();
    throw new Error('Generation not found after update');
  }
  const row = stmt.getAsObject();
  stmt.free();

  return rowToGeneration(row);
}

export async function getGenerations(type?: GenerationType): Promise<Generation[]> {
  const db = await getDB();
  const deviceId = getDeviceId();

  let sql = 'SELECT * FROM generations WHERE device_id = ?';
  const params: string[] = [deviceId];

  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }

  sql += ' ORDER BY created_at DESC';

  const stmt = db.prepare(sql);
  stmt.bind(params);

  const results: Generation[] = [];
  while (stmt.step()) {
    results.push(rowToGeneration(stmt.getAsObject()));
  }
  stmt.free();

  return results;
}

export async function deleteGeneration(id: string): Promise<void> {
  const db = await getDB();
  db.run('DELETE FROM generations WHERE id = ?', [id]);
  await persist();
}

export async function clearHistory(type?: GenerationType): Promise<void> {
  const db = await getDB();
  const deviceId = getDeviceId();

  if (type) {
    db.run('DELETE FROM generations WHERE device_id = ? AND type = ?', [deviceId, type]);
  } else {
    db.run('DELETE FROM generations WHERE device_id = ?', [deviceId]);
  }
  await persist();
}
