import {defineConfig} from 'vitest/config';
export default defineConfig({test:{globals:true,environment:'node',include:['tests/verification/unit-farm-guards.test.ts'],maxWorkers:1}});
