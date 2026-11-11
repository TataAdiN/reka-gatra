/**
 * Pure code generators: TableNode -> SQL DDL / descriptive text / Markdown / Laravel migration.
 *
 * Every generator accepts an optional context `{ tables, relationships, dialect }` so it can
 * resolve foreign-key targets. Without a context they still work on a single table in isolation.
 */

import { LENGTH_TYPES } from '../types/diagram.mjs'

/** @typedef {import('../types/diagram.mjs').TableNode} TableNode */
/** @typedef {import('../types/diagram.mjs').Column} Column */
/** @typedef {import('../types/diagram.mjs').Relationship} Relationship */
/** @typedef {{ tables?: TableNode[], relationships?: Relationship[], dialect?: 'mysql'|'postgresql' }} GenContext */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SQL_KEYWORD_DEFAULTS = /^(CURRENT_TIMESTAMP(\(\d*\))?|CURRENT_DATE|CURRENT_TIME|NOW\(\)|NULL|TRUE|FALSE|UUID\(\)|gen_random_uuid\(\))$/i

const isNumeric = (v) => /^-?\d+(\.\d+)?$/.test(v)
const isQuoted = (v) => /^'.*'$/s.test(v) || /^".*"$/s.test(v)
const unquote = (v) => (isQuoted(v) ? v.slice(1, -1) : v)

/** Formats a default value for SQL: keywords/numbers raw, everything else single-quoted. */
export function formatSqlDefault(value) {
  const v = String(value).trim()
  if (SQL_KEYWORD_DEFAULTS.test(v) || isNumeric(v) || /\w+\(.*\)$/.test(v)) return v
  if (isQuoted(v)) return `'${unquote(v).replace(/'/g, "''")}'`
  return `'${v.replace(/'/g, "''")}'`
}

/** Display type such as `varchar(255)` or `decimal(10,2)`. */
export function displayType(col) {
  return col.length && LENGTH_TYPES.includes(col.type) ? `${col.type}(${col.length})` : col.type
}

/** Finds the relationship where this column is the child (FK) side, plus the referenced table/column. */
function findReference(table, col, ctx) {
  const rels = ctx?.relationships ?? []
  const tables = ctx?.tables ?? []
  const rel = rels.find((r) => r.toTableId === table.id && r.toColumnId === col.id && r.type !== 'N:M')
  if (!rel) return null
  const refTable = tables.find((t) => t.id === rel.fromTableId)
  const refCol = refTable?.columns.find((c) => c.id === rel.fromColumnId)
  return refTable && refCol ? { rel, refTable, refCol } : null
}

/** Maps a model type to a SQL type string for the chosen dialect. */
function sqlType(col, dialect) {
  const pg = dialect === 'postgresql'
  const len = col.length ? `(${col.length})` : ''
  switch (col.type) {
    case 'integer': return pg && col.isAutoIncrement ? 'SERIAL' : 'INT'
    case 'bigint': return pg && col.isAutoIncrement ? 'BIGSERIAL' : 'BIGINT'
    case 'smallint': return pg && col.isAutoIncrement ? 'SMALLSERIAL' : 'SMALLINT'
    case 'varchar': return `VARCHAR${len || '(255)'}`
    case 'char': return `CHAR${len || '(1)'}`
    case 'decimal': return `DECIMAL${len || '(10,2)'}`
    case 'float': return pg ? 'DOUBLE PRECISION' : 'DOUBLE'
    case 'datetime': return pg ? 'TIMESTAMP' : 'DATETIME'
    case 'json': return pg ? 'JSONB' : 'JSON'
    case 'uuid': return pg ? 'UUID' : 'CHAR(36)'
    default: return col.type.toUpperCase()
  }
}

/** Orders tables so referenced (parent) tables come before the tables pointing at them. */
export function sortTablesByDependency(tables, relationships = []) {
  const deps = new Map(tables.map((t) => [t.id, new Set()]))
  for (const r of relationships) {
    if (r.type !== 'N:M' && r.fromTableId !== r.toTableId && deps.has(r.toTableId)) {
      deps.get(r.toTableId).add(r.fromTableId)
    }
  }
  const out = []
  const state = new Map() // 1 = visiting, 2 = done
  const visit = (t) => {
    if (state.get(t.id) === 2) return
    if (state.get(t.id) === 1) return // cycle: keep current order
    state.set(t.id, 1)
    for (const depId of deps.get(t.id)) {
      const dep = tables.find((x) => x.id === depId)
      if (dep) visit(dep)
    }
    state.set(t.id, 2)
    out.push(t)
  }
  tables.forEach(visit)
  return out
}

// ---------------------------------------------------------------------------
// SQL DDL
// ---------------------------------------------------------------------------

/**
 * @param {TableNode} table
 * @param {GenContext} [ctx]
 */
export function generateSQL(table, ctx = {}) {
  const dialect = ctx.dialect ?? 'mysql'
  const pkCols = table.columns.filter((c) => c.isPrimary)
  const inlinePk = pkCols.length === 1

  const lines = table.columns.map((col) => {
    let def = `    ${col.name} ${sqlType(col, dialect)}`
    if (col.isAutoIncrement && dialect === 'mysql') def += ' AUTO_INCREMENT'
    if (col.isPrimary && inlinePk) def += ' PRIMARY KEY'
    if (col.isUnique && !col.isPrimary) def += ' UNIQUE'
    if (!col.isNullable && !(col.isPrimary && inlinePk)) def += ' NOT NULL'
    if (col.defaultValue !== undefined && col.defaultValue !== '') {
      def += ` DEFAULT ${formatSqlDefault(col.defaultValue)}`
    }
    return def
  })

  if (pkCols.length > 1) {
    lines.push(`    PRIMARY KEY (${pkCols.map((c) => c.name).join(', ')})`)
  }

  for (const col of table.columns) {
    const ref = findReference(table, col, ctx)
    if (ref) {
      lines.push(`    FOREIGN KEY (${col.name}) REFERENCES ${ref.refTable.tableName}(${ref.refCol.name})`)
    }
  }

  let sql = `CREATE TABLE ${table.tableName} (\n${lines.join(',\n')}\n);`

  const manyToMany = (ctx.relationships ?? []).filter(
    (r) => r.type === 'N:M' && (r.fromTableId === table.id || r.toTableId === table.id),
  )
  for (const r of manyToMany) {
    const other = (ctx.tables ?? []).find((t) => t.id === (r.fromTableId === table.id ? r.toTableId : r.fromTableId))
    if (other) sql += `\n-- N:M with ${other.tableName}: requires a pivot table`
  }
  return sql
}

/** All tables in dependency order as a single SQL script. */
export function generateAllSQL(tables, relationships = [], dialect = 'mysql') {
  const ctx = { tables, relationships, dialect }
  const header = `-- Generated by Reka Gatra Schema Canvas\n-- Dialect: ${dialect}\n-- ${new Date().toISOString()}`
  return [header, ...sortTablesByDependency(tables, relationships).map((t) => generateSQL(t, ctx))].join('\n\n') + '\n'
}

// ---------------------------------------------------------------------------
// Descriptive text / Markdown
// ---------------------------------------------------------------------------

function columnFlags(table, col, ctx) {
  const flags = []
  if (col.isPrimary) flags.push('PK')
  if (col.isAutoIncrement) flags.push('Auto Increment')
  if (col.isForeign) {
    const ref = findReference(table, col, ctx)
    flags.push(ref ? `FK -> ${ref.refTable.tableName}.${ref.refCol.name}` : 'FK')
  }
  if (col.isUnique && !col.isPrimary) flags.push('Unique')
  if (!col.isNullable && !col.isPrimary) flags.push('Not Null')
  if (col.defaultValue) flags.push(`Default: ${col.defaultValue}`)
  return flags
}

/**
 * Descriptive text format (copy-friendly, e.g. for prompts / docs).
 * @param {TableNode} table
 * @param {GenContext} [ctx]
 */
export function generateMarkdown(table, ctx = {}) {
  let md = `Table Name: ${table.tableName}\nColumns:\n`
  for (const col of table.columns) {
    md += `  - ${col.name} | ${displayType(col)} | ${columnFlags(table, col, ctx).join(', ')}\n`
  }
  return md
}

/** Rich Markdown document (headings + tables) for the whole canvas. */
export function generateAllMarkdown(tables, relationships = []) {
  const ctx = { tables, relationships }
  let md = `# Database Schema\n\n_${tables.length} tables, ${relationships.length} relationships_\n\n`
  for (const t of sortTablesByDependency(tables, relationships)) {
    md += `## ${t.tableName}\n\n| Column | Type | Constraints |\n| --- | --- | --- |\n`
    for (const c of t.columns) {
      md += `| \`${c.name}\` | ${displayType(c)} | ${columnFlags(t, c, ctx).join(', ') || '-'} |\n`
    }
    md += '\n'
  }
  if (relationships.length) {
    md += `## Relationships\n\n`
    for (const r of relationships) {
      const ft = tables.find((t) => t.id === r.fromTableId)
      const tt = tables.find((t) => t.id === r.toTableId)
      const fc = ft?.columns.find((c) => c.id === r.fromColumnId)
      const tc = tt?.columns.find((c) => c.id === r.toColumnId)
      if (ft && tt && fc && tc) md += `- \`${ft.tableName}.${fc.name}\` **${r.type}** \`${tt.tableName}.${tc.name}\`\n`
    }
  }
  return md
}

// ---------------------------------------------------------------------------
// Laravel migration
// ---------------------------------------------------------------------------

function phpDefault(col) {
  const v = String(col.defaultValue).trim()
  if (/^CURRENT_TIMESTAMP(\(\d*\))?$|^NOW\(\)$/i.test(v)) return '->useCurrent()'
  if (/^NULL$/i.test(v)) return '->nullable()'
  if (col.type === 'boolean') return `->default(${/^(1|true)$/i.test(v) ? 'true' : 'false'})`
  if (isNumeric(v)) return `->default(${v})`
  if (isNumeric(unquote(v)) && ['integer', 'bigint', 'smallint', 'decimal', 'float'].includes(col.type)) return `->default(${unquote(v)})`
  return `->default('${unquote(v).replace(/'/g, "\\'")}')`
}

function laravelColumn(table, col, ctx) {
  const n = `'${col.name}'`
  const ref = col.isForeign ? findReference(table, col, ctx) : null

  // Primary auto-increment keys.
  if (col.isPrimary && col.isAutoIncrement) {
    if (col.type === 'bigint') return col.name === 'id' ? '$table->id();' : `$table->id(${n});`
    if (col.type === 'integer') return `$table->increments(${n});`
    if (col.type === 'smallint') return `$table->smallIncrements(${n});`
  }

  // Foreign keys.
  if (col.isForeign && (col.type === 'bigint' || col.type === 'uuid')) {
    let line = col.type === 'uuid' ? `$table->foreignUuid(${n})` : `$table->foreignId(${n})`
    if (col.isNullable) line += '->nullable()'
    if (ref) {
      line += ref.refCol.name === 'id'
        ? `->constrained('${ref.refTable.tableName}')`
        : `->constrained('${ref.refTable.tableName}', '${ref.refCol.name}')`
    }
    if (col.isUnique) line += '->unique()'
    return line + ';'
  }

  let line
  switch (col.type) {
    case 'integer': line = `$table->integer(${n})`; break
    case 'bigint': line = `$table->bigInteger(${n})`; break
    case 'smallint': line = `$table->smallInteger(${n})`; break
    case 'varchar': line = col.length && col.length !== '255' ? `$table->string(${n}, ${col.length})` : `$table->string(${n})`; break
    case 'char': line = col.length ? `$table->char(${n}, ${col.length})` : `$table->char(${n})`; break
    case 'text': line = `$table->text(${n})`; break
    case 'boolean': line = `$table->boolean(${n})`; break
    case 'timestamp': line = `$table->timestamp(${n})`; break
    case 'datetime': line = `$table->dateTime(${n})`; break
    case 'date': line = `$table->date(${n})`; break
    case 'decimal': {
      const [p, s] = (col.length || '8,2').split(',').map((x) => x.trim())
      line = `$table->decimal(${n}, ${p}, ${s ?? 2})`
      break
    }
    case 'float': line = `$table->double(${n})`; break
    case 'json': line = `$table->json(${n})`; break
    case 'uuid': line = `$table->uuid(${n})`; break
    default: line = `$table->string(${n})`
  }

  if (col.isPrimary && !col.isAutoIncrement && table.columns.filter((c) => c.isPrimary).length === 1) line += '->primary()'
  if (col.isAutoIncrement && !col.isPrimary) line += '->autoIncrement()'
  if (col.isNullable) line += '->nullable()'
  if (col.isUnique && !col.isPrimary) line += '->unique()'
  if (col.defaultValue) line += phpDefault(col)
  if (ref) line += `;\n    $table->foreign(${n})->references('${ref.refCol.name}')->on('${ref.refTable.tableName}')`
  return line + ';'
}

/** Laravel `Schema::create` snippet for a single table. */
export function generateLaravel(table, ctx = {}) {
  const cols = table.columns
  const byName = (name) => cols.find((c) => c.name === name)
  const createdAt = byName('created_at')
  const updatedAt = byName('updated_at')
  const deletedAt = byName('deleted_at')
  const isTs = (c) => c && (c.type === 'timestamp' || c.type === 'datetime') && !c.isPrimary
  const collapseTimestamps = isTs(createdAt) && isTs(updatedAt)
  const collapseSoftDeletes = isTs(deletedAt) && deletedAt.isNullable

  const lines = []
  let timestampsEmitted = false
  for (const col of cols) {
    if (collapseTimestamps && (col === createdAt || col === updatedAt)) {
      if (!timestampsEmitted) lines.push('$table->timestamps();')
      timestampsEmitted = true
      continue
    }
    if (collapseSoftDeletes && col === deletedAt) {
      lines.push('$table->softDeletes();')
      continue
    }
    lines.push(laravelColumn(table, col, ctx))
  }

  const pks = cols.filter((c) => c.isPrimary && !c.isAutoIncrement)
  if (pks.length > 1) lines.push(`$table->primary([${pks.map((c) => `'${c.name}'`).join(', ')}]);`)

  return `Schema::create('${table.tableName}', function (Blueprint $table) {\n${lines.map((l) => `    ${l}`).join('\n')}\n});`
}

/** A complete, runnable Laravel migration file containing every table. */
export function generateAllLaravel(tables, relationships = []) {
  const ctx = { tables, relationships }
  const sorted = sortTablesByDependency(tables, relationships)
  const indent = (s, n) => s.split('\n').map((l) => ' '.repeat(n) + l).join('\n')
  const ups = sorted.map((t) => indent(generateLaravel(t, ctx), 8)).join('\n\n')
  const downs = [...sorted].reverse().map((t) => `        Schema::dropIfExists('${t.tableName}');`).join('\n')
  return `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    public function up(): void
    {
${ups}
    }

    public function down(): void
    {
${downs}
    }
};
`
}

// ---------------------------------------------------------------------------
// Unified entry points
// ---------------------------------------------------------------------------

export const FORMATS = {
  sql: { label: 'SQL DDL', ext: 'sql', mime: 'text/sql' },
  markdown: { label: 'Markdown', ext: 'md', mime: 'text/markdown' },
  laravel: { label: 'Laravel Migration', ext: 'php', mime: 'text/x-php' },
}

/** Single table in the requested format. */
export function generateTable(format, table, ctx = {}) {
  if (format === 'sql') return generateSQL(table, ctx)
  if (format === 'laravel') return generateLaravel(table, ctx)
  return generateMarkdown(table, ctx)
}

/** Whole canvas in the requested format. */
export function generateAll(format, tables, relationships = [], dialect = 'mysql') {
  if (format === 'sql') return generateAllSQL(tables, relationships, dialect)
  if (format === 'laravel') return generateAllLaravel(tables, relationships)
  return generateAllMarkdown(tables, relationships)
}

/** Triggers a browser download of text content. */
export function downloadText(filename, content, mime = 'text/plain') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
