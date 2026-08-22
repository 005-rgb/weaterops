import { pool } from './client.js';

export interface Repository<T> {
  findById(id: string): Promise<T | null>;
  create(data: Partial<T>): Promise<T>;
  findMany(filter?: Partial<T>): Promise<T[]>;
  update(id: string, data: Partial<T>): Promise<T | null>;
}

export function createRepository<T>(
  table: string,
  columns: readonly string[],
): Repository<T> {
  const quotedTable = `"${table}"`;
  const allowed = new Set(columns);

  return {
    async findById(id) {
      const result = await pool.query(`SELECT * FROM ${quotedTable} WHERE id = $1`, [id]);
      return (result.rows[0] as T | undefined) ?? null;
    },
    async create(data) {
      const entries = Object.entries(data).filter(([key]) => allowed.has(key));
      if (entries.length === 0) {
        const result = await pool.query(
          `INSERT INTO ${quotedTable} DEFAULT VALUES RETURNING *`,
        );
        return result.rows[0] as T;
      }
      const names = entries.map(([key]) => `"${key}"`);
      const values = entries.map(([, value]) => value);
      const placeholders = values.map((_, index) => `$${index + 1}`);
      const result = await pool.query(
        `INSERT INTO ${quotedTable} (${names.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
        values,
      );
      return result.rows[0];
    },
    async findMany(filter = {}) {
      const entries = Object.entries(filter).filter(([key]) => allowed.has(key));
      const values = entries.map(([, value]) => value);
      const where = entries.length
        ? ` WHERE ${entries.map(([key], index) => `"${key}" = $${index + 1}`).join(' AND ')}`
        : '';
      const result = await pool.query(
        `SELECT * FROM ${quotedTable}${where} ORDER BY created_at DESC`,
        values,
      );
      return result.rows as T[];
    },
    async update(id, data) {
      const entries = Object.entries(data).filter(([key]) => allowed.has(key));
      if (entries.length === 0) return this.findById(id);
      const values = entries.map(([, value]) => value);
      const set = entries.map(([key], index) => `"${key}" = $${index + 1}`).join(', ');
      const result = await pool.query(
        `UPDATE ${quotedTable} SET ${set} WHERE id = $${values.length + 1} RETURNING *`,
        [...values, id],
      );
      return (result.rows[0] as T | undefined) ?? null;
    },
  };
}