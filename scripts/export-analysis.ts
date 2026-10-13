import { resolve } from 'node:path';
import { exportAnalysis } from '../src/simulation/analysis-export';
const out=resolve(process.argv[2]||'simulation-results/latest');
console.log(exportAnalysis(out),out);
