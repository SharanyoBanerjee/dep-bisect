import type { Graph, Change } from '../types.js'

export function diffGraphs(goodGraph: Graph, badGraph: Graph): Change[] {
  const changes: Change[] = []
  const allPaths = new Set([...goodGraph.keys(), ...badGraph.keys()])

  for (const path of allPaths) {
    const goodNode = goodGraph.get(path)
    const badNode = badGraph.get(path)

    if (goodNode && !badNode) {
      changes.push({
        id: `removed:${path}`,
        name: goodNode.name,
        from: goodNode.version,
        kind: 'removed',
        path
      })
    } else if (!goodNode && badNode) {
      changes.push({
        id: `added:${path}`,
        name: badNode.name,
        to: badNode.version,
        kind: 'added',
        path
      })
    } else if (goodNode && badNode && goodNode.version !== badNode.version) {
      changes.push({
        id: `bumped:${path}`,
        name: goodNode.name,
        from: goodNode.version,
        to: badNode.version,
        kind: 'bumped',
        path
      })
    }
  }

  changes.sort((a, b) => a.id.localeCompare(b.id))
  return changes
}