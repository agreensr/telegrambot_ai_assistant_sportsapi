/**
 * Base Repository Class
 * Provides common CRUD operations for all repositories.
 *
 * Implements the Repository pattern for data access abstraction.
 * All specific repositories should extend this class.
 */

import { supabase } from '../config/database.js';
import { logger } from '../utils/logger.js';

/**
 * Base Repository with generic CRUD operations
 */
export class BaseRepository {
  /**
   * @param {string} tableName - The database table name
   */
  constructor(tableName) {
    this.tableName = tableName;
  }

  /**
   * Find a single record by ID
   */
  async findById(id) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        logger.error(`${this.tableName} findById error:`, error);
        return null;
      }

      return data;
    } catch (error) {
      logger.error(`${this.tableName} findById exception:`, error);
      return null;
    }
  }

  /**
   * Find records by field value
   */
  async findBy(field, value, options = {}) {
    try {
      let query = supabase
        .from(this.tableName)
        .select('*')
        .eq(field, value);

      // Apply ordering if specified
      if (options.orderBy) {
        query = query.order(options.orderBy, { ascending: options.ascending ?? true });
      }

      // Apply limit if specified
      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) {
        logger.error(`${this.tableName} findBy error:`, error);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error(`${this.tableName} findBy exception:`, error);
      return [];
    }
  }

  /**
   * Find multiple records with filters
   */
  async findWhere(filters, options = {}) {
    try {
      let query = supabase
        .from(this.tableName)
        .select('*');

      // Apply all filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });

      // Apply ordering if specified
      if (options.orderBy) {
        query = query.order(options.orderBy, { ascending: options.ascending ?? true });
      }

      // Apply limit if specified
      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) {
        logger.error(`${this.tableName} findWhere error:`, error);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error(`${this.tableName} findWhere exception:`, error);
      return [];
    }
  }

  /**
   * Get all records with optional filters
   */
  async getAll(options = {}) {
    try {
      let query = supabase
        .from(this.tableName)
        .select('*');

      // Apply ordering if specified
      if (options.orderBy) {
        query = query.order(options.orderBy, { ascending: options.ascending ?? true });
      }

      // Apply limit if specified
      if (options.limit) {
        query = query.limit(options.limit);
      }

      // Apply range for pagination
      if (options.offset !== undefined && options.limit) {
        query = query.range(options.offset, options.offset + options.limit - 1);
      }

      const { data, error } = await query;

      if (error) {
        logger.error(`${this.tableName} getAll error:`, error);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error(`${this.tableName} getAll exception:`, error);
      return [];
    }
  }

  /**
   * Create a new record
   */
  async create(record) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .insert(record)
        .select()
        .single();

      if (error) {
        logger.error(`${this.tableName} create error:`, error);
        return null;
      }

      logger.debug(`${this.tableName} created: id=${data.id}`);
      return data;
    } catch (error) {
      logger.error(`${this.tableName} create exception:`, error);
      return null;
    }
  }

  /**
   * Create multiple records
   */
  async createMany(records) {
    if (!records || records.length === 0) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .insert(records)
        .select();

      if (error) {
        logger.error(`${this.tableName} createMany error:`, error);
        return [];
      }

      logger.debug(`${this.tableName} created ${data?.length || 0} records`);
      return data || [];
    } catch (error) {
      logger.error(`${this.tableName} createMany exception:`, error);
      return [];
    }
  }

  /**
   * Update a record by ID
   */
  async update(id, updates) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        logger.error(`${this.tableName} update error:`, error);
        return null;
      }

      logger.debug(`${this.tableName} updated: id=${id}`);
      return data;
    } catch (error) {
      logger.error(`${this.tableName} update exception:`, error);
      return null;
    }
  }

  /**
   * Update records by field value
   */
  async updateBy(field, value, updates) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .update(updates)
        .eq(field, value)
        .select();

      if (error) {
        logger.error(`${this.tableName} updateBy error:`, error);
        return [];
      }

      logger.debug(`${this.tableName} updated ${data?.length || 0} records where ${field}=${value}`);
      return data || [];
    } catch (error) {
      logger.error(`${this.tableName} updateBy exception:`, error);
      return [];
    }
  }

  /**
   * Upsert record(s) - insert or update on conflict
   */
  async upsert(records, onConflict = 'id') {
    if (!records || records.length === 0) {
      return [];
    }

    // Ensure array format
    const recordsArray = Array.isArray(records) ? records : [records];

    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .upsert(recordsArray, { onConflict })
        .select();

      if (error) {
        logger.error(`${this.tableName} upsert error:`, error);
        return [];
      }

      logger.debug(`${this.tableName} upserted ${data?.length || 0} records`);
      return data || [];
    } catch (error) {
      logger.error(`${this.tableName} upsert exception:`, error);
      return [];
    }
  }

  /**
   * Delete a record by ID
   */
  async delete(id) {
    try {
      const { error } = await supabase
        .from(this.tableName)
        .delete()
        .eq('id', id);

      if (error) {
        logger.error(`${this.tableName} delete error:`, error);
        return false;
      }

      logger.debug(`${this.tableName} deleted: id=${id}`);
      return true;
    } catch (error) {
      logger.error(`${this.tableName} delete exception:`, error);
      return false;
    }
  }

  /**
   * Delete records by field value
   */
  async deleteBy(field, value) {
    try {
      const { error } = await supabase
        .from(this.tableName)
        .delete()
        .eq(field, value);

      if (error) {
        logger.error(`${this.tableName} deleteBy error:`, error);
        return false;
      }

      logger.debug(`${this.tableName} deleted records where ${field}=${value}`);
      return true;
    } catch (error) {
      logger.error(`${this.tableName} deleteBy exception:`, error);
      return false;
    }
  }

  /**
   * Count records matching filters
   */
  async count(filters = {}) {
    try {
      let query = supabase
        .from(this.tableName)
        .select('*', { count: 'exact', head: true });

      // Apply all filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });

      const { count, error } = await query;

      if (error) {
        logger.error(`${this.tableName} count error:`, error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      logger.error(`${this.tableName} count exception:`, error);
      return 0;
    }
  }

  /**
   * Check if record exists
   */
  async exists(filters) {
    const count = await this.count(filters);
    return count > 0;
  }

  /**
   * Bulk upsert with chunking (handles large datasets)
   */
  async bulkUpsert(records, onConflict = 'id', chunkSize = 100) {
    if (!records || records.length === 0) {
      return { total: 0, successful: 0, failed: 0 };
    }

    const results = [];
    let failed = 0;

    // Process in chunks
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      const chunkResult = await this.upsert(chunk, onConflict);

      if (chunkResult.length > 0) {
        results.push(...chunkResult);
      } else {
        failed += chunk.length;
      }

      // Small delay between chunks to avoid overwhelming the database
      if (i + chunkSize < records.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return {
      total: records.length,
      successful: results.length,
      failed
    };
  }
}

export default BaseRepository;
