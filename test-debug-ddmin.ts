import { ddmin } from './src/search/ddmin.js'
import type { Unit, Outcome } from './src/types.js'

function createUnits(count: number): Unit[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `unit:${i + 1}`,
    root: `pkg${i + 1}`,
    changes: [{ id: `change:${i + 1}`, name: `pkg${i + 1}`, kind: 'bumped' as const, path: `pkg${i + 1}`, from: '1.0.0', to: '2.0.0' }]
  }))
}

async function testSingle() {
  console.log('Starting test...')
  const units = createUnits(8)
  const culpritIndex = 3
  
  let callCount = 0
  const test = async (unitIds: string[]): Promise<Outcome> => {
    callCount++
    console.log(`Test call ${callCount}: ${unitIds.join(',')}`)
    return unitIds.includes(`unit:${culpritIndex + 1}`) ? 'fail' : 'pass'
  }

  console.log('Calling ddmin...')
  const result = await ddmin({ units, test })
  console.log('Result:', result)
}

testSingle().catch(console.error)