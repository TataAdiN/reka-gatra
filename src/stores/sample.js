import { createColumn, createShape, createTable } from '../types/diagram.mjs'
import { uid } from '../utils/id.mjs'

/** Starter diagram shown on first launch. */
export function createSampleDiagram() {
  const c = createColumn
  const users = createTable({
    tableName: 'users',
    position: { x: 40, y: 60 },
    color: '#6366f1',
    columns: [
      c({ name: 'id', type: 'bigint', length: '', isPrimary: true, isAutoIncrement: true }),
      c({ name: 'name', type: 'varchar', length: '255' }),
      c({ name: 'email', type: 'varchar', length: '255', isUnique: true }),
      c({ name: 'created_at', type: 'timestamp', length: '', isNullable: true, defaultValue: 'CURRENT_TIMESTAMP' }),
      c({ name: 'updated_at', type: 'timestamp', length: '', isNullable: true }),
    ],
  })
  const postUserId = c({ name: 'user_id', type: 'bigint', length: '', isForeign: true })
  const posts = createTable({
    tableName: 'posts',
    position: { x: 420, y: 40 },
    color: '#10b981',
    columns: [
      c({ name: 'id', type: 'bigint', length: '', isPrimary: true, isAutoIncrement: true }),
      postUserId,
      c({ name: 'title', type: 'varchar', length: '255' }),
      c({ name: 'body', type: 'text', length: '', isNullable: true }),
      c({ name: 'published', type: 'boolean', length: '', defaultValue: 'false' }),
      c({ name: 'created_at', type: 'timestamp', length: '', isNullable: true }),
      c({ name: 'updated_at', type: 'timestamp', length: '', isNullable: true }),
    ],
  })

  const start = createShape('terminal', { label: 'Register', position: { x: 80, y: 420 } })
  const check = createShape('decision', { label: 'Email unique?', position: { x: 300, y: 393 }, color: '#f59e0b' })
  const save = createShape('process', { label: 'Insert into users', position: { x: 530, y: 413 }, color: '#10b981' })

  return {
    tables: [users, posts],
    relationships: [
      { id: uid('rel'), fromTableId: users.id, fromColumnId: users.columns[0].id, toTableId: posts.id, toColumnId: postUserId.id, type: '1:N' },
    ],
    shapes: [start, check, save],
    connectors: [
      { id: uid('con'), source: start.id, sourceHandle: 'r', target: check.id, targetHandle: 'l', label: '' },
      { id: uid('con'), source: check.id, sourceHandle: 'r', target: save.id, targetHandle: 'l', label: 'yes' },
    ],
  }
}

