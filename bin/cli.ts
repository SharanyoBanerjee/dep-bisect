import { Command } from 'commander'
import { diffCommand } from '../src/cli/diff.js'
import { bisectCommand } from '../src/cli/bisect.js'

const program = new Command()

program
  .name('dep-bisect')
  .description('Find which dependency update broke your build')
  .version('0.0.0')

program.addCommand(diffCommand)
program.addCommand(bisectCommand)

program.parseAsync(process.argv).catch((error) => {
  console.error('Error:', error.message)
  process.exit(1)
})