# Cache Tools

## cache

Manage the in-memory cache used for tool outputs and intermediate data.

**Operations:**
- `get-stats` - Show cache usage and entry statistics
- `clear` - Clear one key or all entries
- `get-config` - Read cache configuration
- `set-config` - Update cache configuration

**Parameters:**
- `operation` (required): Cache operation
- `key`: Cache key to clear (for `clear`)
- `config`: Configuration payload (for `set-config`)

**Config fields:**
- `maxEntries`: Maximum number of entries
- `maxEntrySizeBytes`: Maximum size per entry
- `defaultTtlMs`: Default time-to-live in milliseconds
