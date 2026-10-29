const fs = require('fs')
const path = require('path')

const lockfilePath = path.join(__dirname, 'package-lock.json')
const lockfile = JSON.parse(fs.readFileSync(lockfilePath, 'utf-8'))

const lodash = lockfile.packages['node_modules/lodash']
if (lodash && lodash.version === '4.18.1') {
  console.error('FAIL: lodash 4.18.1 breaks the build')
  process.exit(1)
}

console.log('PASS: lodash version is acceptable')
process.exit(0)