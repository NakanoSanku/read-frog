/**
 * Rollback bridge from v092 to v093.
 *
 * v1.47.0 used schema version 93 for a provider-focused migration. A direct
 * upgrade from v1.46.3 to the rollback release must preserve the v092 config
 * exactly, so this frozen step intentionally performs no transformation.
 */
export function migrate(oldConfig: any): any {
  return oldConfig
}
