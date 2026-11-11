/**
 * Lightweight SQL reverse parser: CREATE TABLE statements -> tables + relationships.
 * Handles MySQL / PostgreSQL / SQLite flavoured DDL well enough for diagramming:
 * inline + table-level PRIMARY KEY, UNIQUE, FOREIGN KEY ... REFERENCES, DEFAULT, AUTO_INCREMENT/SERIAL.
 */

import { createColumn } from '../types/diagram.mjs'
import { uid } from './id.mjs'

const stripIdent = (s) => s.trim().replace(/^[`"[]|[`"\]]$/g, '')
/** "schema.table" -> "table" */
const baseName = (s) => stripIdent(s.split('.').pop())

/** Removes -- line comments and block comments (outside of quotes is good enough here). */
function stripComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '')
}

/** Returns the index of the parenthesis matching the one at `start`, honouring quotes. */
function matchParen(str, start) {
  let depth = 0
  let quote = null
  for (let i = start; i < str.length; i++) {
    const ch = str[i]
    if (quote) {
      if (ch === quote && str[i - 1] !== '\\') quote = null
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') quote = ch
    else if (ch === '(') depth++
    else if (ch === ')' && --depth === 0) return i
  }
  return -1
}

/** Splits on commas at parenthesis depth 0 (outside of quotes). */
function splitTopLevel(body) {
  const parts = []
  let depth = 0
  let quote = null
  let cur = ''
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    if (quote) {
      if (ch === quote && body[i - 1] !== '\\') quote = null
    } else if (ch === "'" || ch === '"' || ch === '`') quote = ch
    else if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (ch === ',' && depth === 0) {
      parts.push(cur.trim())
      cur = ''
      continue
    }
    cur += ch
  }
  if (cur.trim()) parts.push(cur.trim())
  return parts
}

const identList = (s) => s.split(',').map((x) => stripIdent(x.trim().split(/\s+/)[0]))

/** Maps a raw SQL type to the canvas data model. */
function mapType(rawType, args) {
  const t = rawType.toLowerCase()
  const out = { type: 'varchar', length: '', autoIncrement: false }
  if (t === 'serial') return { type: 'integer', length: '', autoIncrement: true }
  if (t === 'bigserial') return { type: 'bigint', length: '', autoIncrement: true }
  if (t === 'smallserial') return { type: 'smallint', length: '', autoIncrement: true }
  if (t === 'tinyint' && args === '1') return { ...out, type: 'boolean' }
  if (['int', 'integer', 'mediumint', 'int4'].includes(t)) return { ...out, type: 'integer' }
  if (['bigint', 'int8'].includes(t)) return { ...out, type: 'bigint' }
  if (['smallint', 'tinyint', 'int2'].includes(t)) return { ...out, type: 'smallint' }
  if (['varchar', 'nvarchar', 'varchar2', 'character varying'].includes(t)) return { ...out, type: 'varchar', length: args || '255' }
  if (['char', 'nchar', 'character'].includes(t)) return { ...out, type: args === '36' ? 'uuid' : 'char', length: args === '36' ? '' : args }
  if (['text', 'longtext', 'mediumtext', 'tinytext', 'clob', 'string'].includes(t)) return { ...out, type: 'text' }
  if (['bool', 'boolean', 'bit'].includes(t)) return { ...out, type: 'boolean' }
  if (['timestamp', 'timestamptz'].includes(t)) return { ...out, type: 'timestamp' }
  if (t === 'datetime' || t === 'datetime2') return { ...out, type: 'datetime' }
  if (t === 'date') return { ...out, type: 'date' }
  if (['decimal', 'numeric', 'money'].includes(t)) return { ...out, type: 'decimal', length: args || '10,2' }
  if (['float', 'double', 'real', 'double precision', 'float8', 'float4'].includes(t)) return { ...out, type: 'float' }
  if (['json', 'jsonb'].includes(t)) return { ...out, type: 'json' }
  if (t === 'uuid' || t === 'uniqueidentifier') return { ...out, type: 'uuid' }
  return { ...out, type: 'text' }
}

/** Reads the DEFAULT value token from the remainder of a column definition. */
function readDefault(rest) {
  const m = rest.match(/\bDEFAULT\s+/i)
  if (!m) return ''
  const s = rest.slice(m.index + m[0].length)
  if (s[0] === "'" || s[0] === '"') {
    const end = s.indexOf(s[0], 1)
    return s.slice(0, end + 1)
  }
  if (s[0] === '(') return s.slice(1, matchParen(s, 0))
  const tok = s.match(/^[^\s,]+(\(\d*\))?/)
  return tok && !/^NULL$/i.test(tok[0]) ? tok[0] : ''
}

/**
 * @param {string} sql
 * @returns {{ tables: Array<{tableName:string, columns:any[]}>, foreignKeys: Array<{table:string, column:string, refTable:string, refColumn:string}>, errors: string[] }}
 */
export function parseSQL(sql) {
  const src = stripComments(sql)
  const tables = []
  const foreignKeys = []
  const errors = []
  const re = /CREATE\s+(?:TEMPORARY\s+|TEMP\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([`"[\]\w.]+)\s*\(/gi
  let m

  while ((m = re.exec(src))) {
    const tableName = baseName(m[1])
    const open = m.index + m[0].length - 1
    const close = matchParen(src, open)
    if (close === -1) {
      errors.push(`Unbalanced parentheses in table "${tableName}"`)
      break
    }
    re.lastIndex = close
    const columns = []
    const byName = (n) => columns.find((c) => c.name.toLowerCase() === n.toLowerCase())

    for (const part of splitTopLevel(src.slice(open + 1, close))) {
      const upper = part.toUpperCase()

      // --- table-level constraints -------------------------------------------------
      const constraint = part.replace(/^CONSTRAINT\s+[`"[\]\w]+\s+/i, '')
      let cm
      if ((cm = constraint.match(/^PRIMARY\s+KEY\s*\(([^)]+)\)/i))) {
        identList(cm[1]).forEach((n) => { const c = byName(n); if (c) { c.isPrimary = true; c.isNullable = false } })
        continue
      }
      if ((cm = constraint.match(/^FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+([`"[\]\w.]+)\s*\(([^)]+)\)/i))) {
        const cols = identList(cm[1])
        const refs = identList(cm[3])
        cols.forEach((col, i) => foreignKeys.push({ table: tableName, column: col, refTable: baseName(cm[2]), refColumn: refs[i] ?? refs[0] }))
        continue
      }
      if ((cm = constraint.match(/^UNIQUE(?:\s+(?:KEY|INDEX))?(?:\s+[`"[\]\w]+)?\s*\(([^)]+)\)/i))) {
        const cols = identList(cm[1])
        if (cols.length === 1) { const c = byName(cols[0]); if (c) c.isUnique = true }
        continue
      }
      if (/^(KEY|INDEX|FULLTEXT|SPATIAL|CHECK|CONSTRAINT|EXCLUDE)\b/.test(upper)) continue

      // --- column definition ---------------------------------------------------------
      const colMatch = part.match(/^(`[^`]+`|"[^"]+"|\[[^\]]+\]|\w+)\s+(double\s+precision|character\s+varying|[a-zA-Z_]\w*)\s*(?:\(([^)]*)\))?(.*)$/is)
      if (!colMatch) {
        errors.push(`Could not parse "${part.slice(0, 40)}" in ${tableName}`)
        continue
      }
      const [, rawName, rawType, rawArgs = '', rest = ''] = colMatch
      const mapped = mapType(rawType.replace(/\s+/g, ' '), rawArgs.replace(/\s+/g, ''))
      const restUp = rest.toUpperCase()
      const isPrimary = /\bPRIMARY\s+KEY\b/.test(restUp)
      const col = createColumn({
        name: stripIdent(rawName),
        type: mapped.type,
        length: mapped.length,
        isPrimary,
        isUnique: /\bUNIQUE\b/.test(restUp),
        isAutoIncrement: mapped.autoIncrement || /\b(AUTO_INCREMENT|AUTOINCREMENT|IDENTITY|GENERATED\s+(ALWAYS|BY\s+DEFAULT)\s+AS\s+IDENTITY)\b/.test(restUp),
        isNullable: !isPrimary && !/\bNOT\s+NULL\b/.test(restUp),
        defaultValue: readDefault(rest),
      })
      columns.push(col)

      const inlineRef = rest.match(/\bREFERENCES\s+([`"[\]\w.]+)\s*\(([^)]+)\)/i)
      if (inlineRef) foreignKeys.push({ table: tableName, column: col.name, refTable: baseName(inlineRef[1]), refColumn: stripIdent(inlineRef[2]) })
    }

    tables.push({ tableName, columns })
  }

  if (!tables.length && !errors.length) errors.push('No CREATE TABLE statements found.')
  return { tables, foreignKeys, errors }
}

/**
 * Resolves parsed foreign keys against a list of TableNodes (with ids) into Relationship objects.
 * Also marks child columns as foreign keys.
 */
export function resolveForeignKeys(foreignKeys, tables) {
  const find = (name) => tables.find((t) => t.tableName.toLowerCase() === name.toLowerCase())
  const rels = []
  for (const fk of foreignKeys) {
    const child = find(fk.table)
    const parent = find(fk.refTable)
    const childCol = child?.columns.find((c) => c.name.toLowerCase() === fk.column.toLowerCase())
    const parentCol = parent?.columns.find((c) => c.name.toLowerCase() === fk.refColumn.toLowerCase())
    if (!childCol || !parentCol) continue
    childCol.isForeign = true
    rels.push({
      id: uid('rel'),
      fromTableId: parent.id,
      fromColumnId: parentCol.id,
      toTableId: child.id,
      toColumnId: childCol.id,
      type: childCol.isUnique ? '1:1' : '1:N',
    })
  }
  return rels
}
