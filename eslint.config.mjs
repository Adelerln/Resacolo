import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [
      '.next/**',
      '.next-corrupt*/**',
      'node_modules/**',
      'out/**',
      'build/**',
      'next-env.d.ts'
    ]
  }
];
