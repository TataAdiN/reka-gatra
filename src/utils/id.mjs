let counter = 0

/** Short, collision-resistant id for client-side entities. */
export function uid(prefix = 'id') {
  counter = (counter + 1) % 1e6
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}${counter.toString(36)}`
}

