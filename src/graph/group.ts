import type { Change, Unit, Graph } from '../types.js'

function findRootDependency(path: string, graph: Graph): string {
  const node = graph.get(path)
  if (!node) return path

  if (node.parents.length === 0 || node.parents[0] === 'ROOT') {
    return path
  }

  return node.parents[0] ?? path
}

export function groupChanges(changes: Change[], goodGraph: Graph, badGraph: Graph): Unit[] {
  const unitMap = new Map<string, Unit>()

  for (const change of changes) {
    const rootPath = findRootDependency(change.path, goodGraph.size > 0 ? goodGraph : badGraph)
    const rootNode = goodGraph.get(rootPath) || badGraph.get(rootPath)
    const rootName = rootNode?.name ?? rootPath

    if (!unitMap.has(rootName)) {
      unitMap.set(rootName, {
        id: `unit:${rootName}`,
        root: rootName,
        changes: []
      })
    }

    unitMap.get(rootName)!.changes.push(change)
  }

  const units = Array.from(unitMap.values())
  units.sort((a, b) => a.root.localeCompare(b.root))

  for (const unit of units) {
    unit.changes.sort((a, b) => a.id.localeCompare(b.id))
  }

  return units
}